#!/usr/bin/env node
// verdict — CLI report + PR comment + CI JSON

const fs = require('fs');
const path = require('path');
const { prComment } = require('./gate.js');
const { buildCaseStudy } = require('./verdict-schema.js');

const cwd = process.argv[2] || process.cwd();
const mode = process.argv.includes('--pr') ? 'pr'
  : process.argv.includes('--ci') ? 'ci'
    : process.argv.includes('--case-study') ? 'case-study'
      : 'full';
const { dir, resolveReadPath } = require('./verdict-store');
const base = dir(cwd);

function readJson(name) {
  try { return JSON.parse(fs.readFileSync(resolveReadPath(cwd, name), 'utf8')); }
  catch { return null; }
}

const flags = (() => {
  const { legacyDir } = require('./verdict-store');
  const out = [];
  for (const log of [path.join(base, 'flags.jsonl'), path.join(legacyDir(cwd), 'flags.jsonl')]) {
    if (!fs.existsSync(log)) continue;
    for (const line of fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean)) {
      out.push(JSON.parse(line));
    }
  }
  return out;
})();

const byType = {};
for (const f of flags) byType[f.type] = (byType[f.type] || 0) + 1;

const verdict = readJson('verdict.json');
const session = readJson('session.json');
const compare = readJson('plugin-compare.json');

function buildCiPayload() {
  if (compare?.ci_only && compare?.verdict) return compare;

  if (!verdict?.patch_correctness) {
    return {
      ci_only: { visible_pass: verdict?.visible_pass, would_merge: verdict?.visible_pass },
      verdict: { gate: { decision: verdict?.gate_block ? 'block' : 'pass' } },
    };
  }

  return {
    ci_only: {
      visible_pass: verdict.patch_correctness.visible_pass,
      would_merge: verdict.patch_correctness.visible_pass,
    },
    verdict: {
      patch_correctness: verdict.patch_correctness,
      suite_adequacy: verdict.suite_adequacy,
      agent_runtime: verdict.agent_runtime,
      gate: verdict.gate,
    },
    taxonomy: verdict.taxonomy?.primary,
    judge_feedback: verdict.judge_feedback,
    _metrics_legend: {
      mutant_survival_rate: '0–1; high=bad',
      test_adequacy_score: '0–1; high=good (= mutation_kill_rate)',
    },
  };
}

const ci = buildCiPayload();
const gateBlocked = ci.verdict?.gate?.decision === 'block'
  || verdict?.gate?.decision === 'block'
  || verdict?.gate_block;

if (mode === 'case-study') {
  const study = readJson('case-study.json') || buildCaseStudy(cwd, verdict || {});
  console.log(JSON.stringify(study, null, 2));
  process.exit(gateBlocked ? 1 : 0);
}

if (mode === 'pr') {
  const md = fs.existsSync(path.join(base, 'pr-comment.md'))
    ? fs.readFileSync(path.join(base, 'pr-comment.md'), 'utf8')
    : prComment(verdict || ci);
  process.stdout.write(md);
  process.exit(gateBlocked ? 1 : 0);
}

if (mode === 'ci') {
  console.log(JSON.stringify(ci, null, 2));
  process.exit(gateBlocked ? 1 : 0);
}

const report = {
  ...ci,
  by_type: byType,
  flags,
  session_tools: session?.tool_count ?? null,
  verdict,
};

console.log(JSON.stringify(report, null, 2));
process.exit(gateBlocked ? 1 : 0);