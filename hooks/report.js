#!/usr/bin/env node
// xiao — full report (docs.md §6)

const fs = require('fs');
const path = require('path');

const cwd = process.argv[2] || process.cwd();
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

const report = {
  hacking_flags: flags.length,
  by_type: byType,
  flags,
  blinded_verdict: verdict?.blinded_verdict ?? null,
  blinded_score: verdict?.blinded_score ?? null,
  reward_hacking_gap: verdict?.reward_hacking_gap ?? null,
  visible_pass: verdict?.visible_pass ?? null,
  held_out_pass: verdict?.held_out_pass ?? null,
  test_adequacy: verdict?.test_adequacy ?? null,
  session_tools: session?.tool_count ?? null,
  verdict,
};

console.log(JSON.stringify(report, null, 2));