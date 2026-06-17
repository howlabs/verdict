#!/usr/bin/env node
// xiao v1 — Stop: full judgment pipeline (docs.md §4–6)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { read, write } = require('./xiao-store');
const { run: blindedRun } = require('./blinded-checker.js');
const { measure: measureMutation } = require('./mutation.js');
const { generate: genHeldOut } = require('./held-out-gen.js');
const { shouldBlock, prComment } = require('./gate.js');
const { store: storeRegression } = require('./regression.js');
const { classify } = require('./taxonomy.js');
const { judge, llmVerifyClaim } = require('./judge.js');
const { findSpec } = require('./blinded-checker.js');

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

  const metrics = {
    hacking_flags: flags.length,
    blinded_verdict: blinded.verdict.rejected_count,
    blinded_score: blinded.verdict.score,
    reward_hacking_gap: gap.gap,
    visible_pass: gap.visible,
    held_out_pass: gap.held_out,
    test_adequacy: mutation.adequacy,
  };

  const taxonomy = classify(metrics, flags);
  const judged = judge(metrics, flags, blinded, taxonomy);

  // optional LLM sub-verify rejected claims (verifier bootstrap path)
  const specPath = findSpec(cwd);
  const specText = specPath ? fs.readFileSync(specPath, 'utf8') : '';
  const llmReviews = [];
  for (const rej of blinded.rejected.slice(0, 3)) {
    const fp = path.join(cwd, rej.file || '');
    const content = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
    const rv = llmVerifyClaim(specText, rej, content);
    if (rv) llmReviews.push({ claim: rej.id, ...rv });
  }

  const gate = shouldBlock({ ...metrics, judge_score: judged.judge_score });

  const report = {
    ts: Date.now(),
    ...metrics,
    blinded_feedback: blinded.verdict.feedback,
    mutation_total: mutation.total,
    mutation_survived: mutation.survived,
    mutants: mutation.mutants,
    taxonomy,
    judge_score: judged.judge_score,
    judge_pass: judged.pass,
    judge_feedback: judged.feedback,
    sub_questions: judged.sub_questions,
    llm_reviews: llmReviews,
    gate_block: gate.block || !judged.pass,
    gate_reasons: gate.block ? gate.reasons : (!judged.pass ? [`judge_score=${judged.judge_score}<3`] : []),
    claims: blinded.claims,
    rejected: blinded.rejected,
  };

  write(cwd, 'verdict.json', report);
  fs.writeFileSync(path.join(cwd, '.xiao', 'pr-comment.md'), prComment(report));
  storeRegression(cwd, report);
  return report;
}

async function main() {
  const { isEnabled, isFull, emptyOut } = require('./xiao-runtime');
  if (!isEnabled() || !isFull()) return emptyOut();
  const raw = (await readStdin()).replace(/^\uFEFF/, '');
  const cwd = (() => {
    try { return JSON.parse(raw || '{}').cwd || process.cwd(); }
    catch { return process.cwd(); }
  })();

  const report = await buildVerdict(cwd);

  const lines = [
    `📋 XIAO v1 verdict — judge ${report.judge_score}/4 | taxonomy: ${report.taxonomy.primary}`,
    `  hacking_flags: ${report.hacking_flags}`,
    `  reward_hacking_gap: ${report.reward_hacking_gap ?? 'n/a'}`,
    `  test_adequacy: ${report.test_adequacy != null ? report.test_adequacy + '%' : 'n/a'}`,
    `  blinded_verdict: ${report.blinded_verdict} rejected`,
    report.gate_block ? `  ⛔ BLOCKED: ${report.gate_reasons.join('; ')}` : '  ✅ passed',
    report.judge_feedback,
  ];

  const out = {
    hookSpecificOutput: { hookEventName: 'Stop', additionalContext: lines.join('\n') },
  };
  if (report.gate_block) {
    out.decision = 'block';
    out.reason = report.gate_reasons.join('; ');
  }
  process.stdout.write(JSON.stringify(out));
}

if (require.main === module) main();

module.exports = { computeGap, loadFlags, buildVerdict };