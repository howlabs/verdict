#!/usr/bin/env node
// xiao — CLI report + PR comment + CI JSON (docs.md §6)

const fs = require('fs');
const path = require('path');
const { prComment } = require('./gate.js');

const cwd = process.argv[2] || process.cwd();
const mode = process.argv.includes('--pr') ? 'pr' : process.argv.includes('--ci') ? 'ci' : 'full';
const base = path.join(cwd, '.xiao');

function readJson(name) {
  try { return JSON.parse(fs.readFileSync(path.join(base, name), 'utf8')); }
  catch { return null; }
}

const flags = (() => {
  const log = path.join(base, 'flags.jsonl');
  if (!fs.existsSync(log)) return [];
  return fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
})();

const byType = {};
for (const f of flags) byType[f.type] = (byType[f.type] || 0) + 1;

const verdict = readJson('verdict.json');
const session = readJson('session.json');

const ci = {
  hacking_flags: flags.length,
  blinded_verdict: verdict?.blinded_verdict ?? null,
  blinded_score: verdict?.blinded_score ?? null,
  reward_hacking_gap: verdict?.reward_hacking_gap ?? null,
  test_adequacy: verdict?.test_adequacy ?? null,
  visible_pass: verdict?.visible_pass ?? null,
  held_out_pass: verdict?.held_out_pass ?? null,
  gate_block: verdict?.gate_block ?? false,
  gate_reasons: verdict?.gate_reasons ?? [],
};

if (mode === 'pr') {
  const md = fs.existsSync(path.join(base, 'pr-comment.md'))
    ? fs.readFileSync(path.join(base, 'pr-comment.md'), 'utf8')
    : prComment({ ...ci, blinded_feedback: verdict?.blinded_feedback });
  process.stdout.write(md);
  process.exit(ci.gate_block ? 1 : 0);
}

if (mode === 'ci') {
  console.log(JSON.stringify(ci, null, 2));
  process.exit(ci.gate_block ? 1 : 0);
}

const report = {
  ...ci,
  by_type: byType,
  flags,
  session_tools: session?.tool_count ?? null,
  mutation: {
    total: verdict?.mutation_total ?? null,
    survived: verdict?.mutation_survived ?? null,
  },
  verdict,
};

console.log(JSON.stringify(report, null, 2));
process.exit(ci.gate_block ? 1 : 0);