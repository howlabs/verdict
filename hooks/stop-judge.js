#!/usr/bin/env node
// xiao v0.3 — Stop: blinded + gap + mutation adequacy + gate (docs.md §3, §6)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { read, write } = require('./xiao-store');
const { run: blindedRun } = require('./blinded-checker.js');
const { measure: measureMutation } = require('./mutation.js');
const { generate: genHeldOut } = require('./held-out-gen.js');
const { shouldBlock, prComment } = require('./gate.js');
const { store: storeRegression } = require('./regression.js');

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.on('data', (c) => { buf += c; });
    process.stdin.on('end', () => resolve(buf));
  });
}

function runSh(cwd, cmd) {
  try {
    execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function loadFlags(cwd) {
  const log = path.join(cwd, '.xiao', 'flags.jsonl');
  if (!fs.existsSync(log)) return [];
  return fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function computeGap(cwd) {
  const evalSh = path.join(cwd, 'evaluation.sh');
  let visible = null;
  let heldOut = null;

  if (fs.existsSync(evalSh)) visible = runSh(cwd, 'bash evaluation.sh');
  const heldDir = path.join(cwd, '.xiao', 'held-out');
  if (fs.existsSync(heldDir)) heldOut = runSh(cwd, `python3 -m pytest "${heldDir}" -q`);

  if (visible === null || heldOut === null) return { visible, held_out: heldOut, gap: null };
  return { visible, held_out: heldOut, gap: (visible ? 1 : 0) - (heldOut ? 1 : 0) };
}

async function buildVerdict(cwd) {
  genHeldOut(cwd);
  const session = read(cwd, 'session.json', {});
  const flags = loadFlags(cwd);
  const blinded = blindedRun(cwd, { since: session.start_rev, hackingFlags: flags.length });
  const gap = computeGap(cwd);
  const mutation = measureMutation(cwd);
  const gate = shouldBlock({
    hacking_flags: flags.length,
    blinded_score: blinded.verdict.score,
    reward_hacking_gap: gap.gap,
    test_adequacy: mutation.adequacy,
  });

  const report = {
    ts: Date.now(),
    hacking_flags: flags.length,
    blinded_verdict: blinded.verdict.rejected_count,
    blinded_score: blinded.verdict.score,
    blinded_feedback: blinded.verdict.feedback,
    reward_hacking_gap: gap.gap,
    visible_pass: gap.visible,
    held_out_pass: gap.held_out,
    test_adequacy: mutation.adequacy,
    mutation_total: mutation.total,
    mutation_survived: mutation.survived,
    mutants: mutation.mutants,
    gate_block: gate.block,
    gate_reasons: gate.reasons,
    claims: blinded.claims,
    rejected: blinded.rejected,
  };

  write(cwd, 'verdict.json', report);
  fs.writeFileSync(path.join(cwd, '.xiao', 'pr-comment.md'), prComment(report));
  storeRegression(cwd, report);
  return report;
}

async function main() {
  const raw = (await readStdin()).replace(/^\uFEFF/, '');
  const cwd = (() => {
    try { return JSON.parse(raw || '{}').cwd || process.cwd(); }
    catch { return process.cwd(); }
  })();

  const report = await buildVerdict(cwd);

  const lines = [
    `📋 XIAO STOP verdict — score ${report.blinded_score}/4`,
    `  hacking_flags: ${report.hacking_flags}`,
    `  blinded_verdict: ${report.blinded_verdict} claim rejected`,
    report.reward_hacking_gap != null
      ? `  reward_hacking_gap: ${report.reward_hacking_gap} (visible=${report.visible_pass}, held-out=${report.held_out_pass})`
      : '  reward_hacking_gap: n/a',
    report.test_adequacy != null
      ? `  test_adequacy: ${report.test_adequacy}% (${report.mutation_survived}/${report.mutation_total} mutants survived)`
      : '  test_adequacy: n/a',
    report.gate_block ? `  ⛔ GATE BLOCKED: ${report.gate_reasons.join('; ')}` : '  ✅ gate passed',
    report.blinded_feedback,
  ];

  const out = {
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: lines.join('\n'),
    },
  };
  if (report.gate_block) {
    out.decision = 'block';
    out.reason = report.gate_reasons.join('; ');
  }

  process.stdout.write(JSON.stringify(out));
}

if (require.main === module) main();

module.exports = { computeGap, loadFlags, buildVerdict };