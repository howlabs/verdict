#!/usr/bin/env node
// xiao v0.2 — Stop: blinded checker + evaluation.sh + gap (docs.md §3, §6)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { read, write } = require('./xiao-store');
const { run: blindedRun } = require('./blinded-checker.js');

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
  if (fs.existsSync(heldDir)) {
    heldOut = runSh(cwd, `python3 -m pytest "${heldDir}" -q`);
  }

  if (visible === null || heldOut === null) return { visible, held_out: heldOut, gap: null };

  const gap = (visible ? 1 : 0) - (heldOut ? 1 : 0);
  return { visible, held_out: heldOut, gap };
}

async function main() {
  const raw = (await readStdin()).replace(/^\uFEFF/, '');
  const cwd = (() => {
    try { return JSON.parse(raw || '{}').cwd || process.cwd(); }
    catch { return process.cwd(); }
  })();

  const session = read(cwd, 'session.json', {});
  const flags = loadFlags(cwd);
  const blinded = blindedRun(cwd, {
    since: session.start_rev,
    hackingFlags: flags.length,
  });
  const gap = computeGap(cwd);

  const report = {
    ts: Date.now(),
    hacking_flags: flags.length,
    blinded_verdict: blinded.verdict.rejected_count,
    blinded_score: blinded.verdict.score,
    blinded_feedback: blinded.verdict.feedback,
    reward_hacking_gap: gap.gap,
    visible_pass: gap.visible,
    held_out_pass: gap.held_out,
    test_adequacy: null, // ponytail: v0.3 mutation engine
    claims: blinded.claims,
    rejected: blinded.rejected,
  };

  write(cwd, 'verdict.json', report);

  const lines = [
    `📋 XIAO STOP verdict — score ${report.blinded_score}/4`,
    `  hacking_flags: ${report.hacking_flags}`,
    `  blinded_verdict: ${report.blinded_verdict} claim rejected`,
    gap.gap !== null ? `  reward_hacking_gap: ${gap.gap} (visible=${gap.visible}, held-out=${gap.held_out})` : '  reward_hacking_gap: n/a (cần evaluation.sh + .xiao/held-out/)',
    report.blinded_feedback,
  ];

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: lines.join('\n'),
    },
  }));
}

if (require.main === module) main();

module.exports = { computeGap, loadFlags };