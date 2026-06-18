#!/usr/bin/env node
// verdict — Stop: full judgment pipeline

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { read, write, dir, heldOutDir } = require('./verdict-store');
const { run: blindedRun } = require('./blinded-checker.js');
const { measure: measureMutation } = require('./mutation.js');
const { generate: genHeldOut } = require('./held-out-gen.js');
const { prComment } = require('./gate.js');
const { store: storeRegression } = require('./regression.js');
const { classify } = require('./taxonomy.js');
const { judge, llmVerifyClaim } = require('./judge.js');
const { findSpec } = require('./blinded-checker.js');
const {
  loadAgentRuntime,
  buildStructuredVerdict,
  formatStopLines,
  buildCaseStudy,
} = require('./verdict-schema.js');

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
  const log = path.join(dir(cwd), 'flags.jsonl');
  if (!fs.existsSync(log)) return [];
  return fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function heldOutCmd(cwd) {
  const heldDir = heldOutDir(cwd);
  if (!fs.existsSync(heldDir)) return null;
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.vitest) return 'npm run test:held-out';
      if (deps.jest) return 'npx jest --testPathPattern=held-out --passWithNoTests';
    } catch { /* fall through */ }
  }
  return `python3 -m pytest "${heldDir}" -q`;
}

function computeGap(cwd) {
  const evalSh = path.join(cwd, 'evaluation.sh');
  let visible = null;
  let heldOut = null;
  if (fs.existsSync(evalSh)) visible = runSh(cwd, 'bash evaluation.sh');
  const heldCmd = heldOutCmd(cwd);
  if (heldCmd) heldOut = runSh(cwd, heldCmd);
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
    mutant_survival_rate: mutation.mutant_survival_rate,
    mutation_kill_rate: mutation.mutation_kill_rate,
    test_adequacy: mutation.mutant_survival_rate,
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

  const agent_runtime = loadAgentRuntime(cwd);
  const structured = buildStructuredVerdict({
    cwd,
    gap,
    mutation,
    flags,
    judged,
    taxonomy,
    flatMetrics: metrics,
    blinded,
    llmReviews,
    session,
    agent_runtime,
  });

  if (!judged.pass && structured.gate.decision !== 'block') {
    structured.gate.decision = 'block';
    structured.gate.block = true;
    structured.gate.reasons.push(`judge_score=${judged.judge_score}<3`);
    structured.gate_block = true;
    structured.gate_reasons = structured.gate.reasons;
  }

  const report = {
    ts: Date.now(),
    ...structured,
  };

  write(cwd, 'verdict.json', report);
  fs.writeFileSync(path.join(dir(cwd), 'case-study.json'), JSON.stringify(buildCaseStudy(cwd, report), null, 2));
  fs.writeFileSync(path.join(dir(cwd), 'pr-comment.md'), prComment(report));
  storeRegression(cwd, report);
  return report;
}

async function main() {
  const { isEnabled, isFull, emptyOut } = require('./verdict-runtime');
  if (!isEnabled() || !isFull()) return emptyOut();
  const raw = (await readStdin()).replace(/^\uFEFF/, '');
  const cwd = (() => {
    try { return JSON.parse(raw || '{}').cwd || process.cwd(); }
    catch { return process.cwd(); }
  })();

  const report = await buildVerdict(cwd);

  const lines = formatStopLines(report);

  const out = {
    hookSpecificOutput: { hookEventName: 'Stop', additionalContext: lines.join('\n') },
  };
  if (report.gate.decision === 'block') {
    out.decision = 'block';
    out.reason = report.gate.reasons.join('; ');
  }
  process.stdout.write(JSON.stringify(out));
}

if (require.main === module) main();

module.exports = { computeGap, loadFlags, buildVerdict };