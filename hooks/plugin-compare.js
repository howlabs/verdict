#!/usr/bin/env node
// Canonical A/B: ci_only vs verdict (patch / suite / gate / delta)

const fs = require('fs');
const path = require('path');
const { check: ciOnly } = require('./ci-only.js');
const { buildVerdict } = require('./stop-judge.js');
const { getMode, setMode } = require('./verdict-runtime.js');
const { buildCaseStudy } = require('./verdict-schema.js');
const { dir } = require('./verdict-store.js');

function hookSilentWhenOff(cwd) {
  const prev = getMode();
  setMode('off');
  const { spawnSync } = require('child_process');
  const r = spawnSync('node', [path.join(__dirname, 'stop-judge.js')], {
    input: JSON.stringify({ cwd }),
    encoding: 'utf8',
  });
  setMode(prev);
  const out = (r.stdout || '').trim();
  return out === '{}' || out === '';
}

function buildDelta(ci, verdictBlock) {
  const ciMerge = ci.would_merge === true;
  const verdictMerge = verdictBlock.gate?.decision === 'pass';
  const lines = [];

  if (ciMerge && !verdictMerge) {
    if (verdictBlock.patch_correctness?.pass === false) {
      lines.push('CI would merge; verdict blocks — patch incorrect or reward-hacking gap.');
    } else if (verdictBlock.suite_adequacy?.pass === false) {
      lines.push('CI would merge; verdict blocks — patch correct but visible test suite under-constrained.');
    } else if (verdictBlock.gate?.decision === 'inconclusive') {
      lines.push('CI would merge; verdict inconclusive — held-out or mutation signals not measured.');
    } else {
      lines.push(`CI would merge; verdict blocks — ${verdictBlock.gate?.summary || verdictBlock.gate?.reasons?.join('; ')}`);
    }
  } else if (!ciMerge && verdictMerge) {
    lines.push('CI fails visible tests; verdict gate pass (unusual).');
  } else if (ciMerge && verdictMerge) {
    lines.push('Both CI and verdict would allow merge.');
  } else {
    lines.push('Both CI and verdict block.');
  }

  return {
    summary: lines[0],
    details: lines,
    disagreement: ciMerge !== verdictMerge,
    ci_would_merge: ciMerge,
    verdict_would_merge: verdictMerge,
    ci_would_merge_but_verdict_blocks: ciMerge && !verdictMerge,
  };
}

function canonicalPayload(cwd, report, ci) {
  const verdict = {
    patch_correctness: report.patch_correctness,
    suite_adequacy: report.suite_adequacy,
    agent_runtime: report.agent_runtime,
    gate: {
      decision: report.gate.decision,
      summary: report.gate.summary,
      reason: report.gate.summary,
      reasons: report.gate.reasons,
      warnings: report.gate.warnings,
      config: report.gate.config,
    },
  };

  return {
    task: path.basename(cwd),
    cwd,
    hooks_off_returns_empty: hookSilentWhenOff(cwd),
    ci_only: {
      visible_pass: ci.pass,
      would_merge: ci.would_merge,
      scope: ci.scope,
      checks_run: ci.checks_run,
    },
    verdict,
    delta: buildDelta({ would_merge: ci.would_merge, pass: ci.pass }, verdict),
    case_study: buildCaseStudy(cwd, report),
    _metrics_legend: {
      mutant_survival_rate: '0–1 fraction; high = bad',
      mutation_kill_rate: '0–1 fraction; high = good',
      test_adequacy_score: 'same as mutation_kill_rate; high = good',
    },
  };
}

async function compare(cwd) {
  const ci = ciOnly(cwd);
  const prevMode = getMode();
  setMode('on');
  const report = await buildVerdict(cwd);
  setMode(prevMode);
  return canonicalPayload(cwd, report, ci);
}

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  const outPath = process.argv.includes('--write')
    ? path.join(dir(cwd), 'plugin-compare.json')
    : null;

  compare(cwd).then((result) => {
    const json = JSON.stringify(result, null, 2);
    if (outPath) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, json);
    }
    console.log(json);
    const failOnDelta = process.argv.includes('--fail-on-delta');
    process.exit(failOnDelta && result.delta.disagreement ? 1 : 0);
  });
}

module.exports = { compare, canonicalPayload, buildDelta, hookSilentWhenOff };