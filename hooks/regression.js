// verdict — regression dataset per repo

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { appendLine, read, dir } = require('./verdict-store');
const { GLOBAL_REGRESSION, LEGACY_GLOBAL_REGRESSION } = require('./brand.js');

function repoId(cwd) {
  try {
    const url = execSync('git remote get-url origin 2>/dev/null', { cwd, encoding: 'utf8' }).trim();
    return url.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  } catch {
    return cwd.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  }
}

function store(cwd, verdict) {
  const entry = {
    ts: verdict.ts || Date.now(),
    repo: repoId(cwd),
    hacking_flags: verdict.hacking_flags,
    blinded_verdict: verdict.blinded_verdict,
    blinded_score: verdict.blinded_score,
    judge_score: verdict.judge_score,
    reward_hacking_gap: verdict.reward_hacking_gap,
    mutant_survival_rate: verdict.mutant_survival_rate ?? verdict.test_adequacy,
    mutation_kill_rate: verdict.mutation_kill_rate,
    patch_pass: verdict.patch_correctness?.pass,
    suite_pass: verdict.suite_adequacy?.pass,
    gate_decision: verdict.gate?.decision ?? (verdict.gate_block ? 'block' : 'pass'),
    test_adequacy: verdict.test_adequacy,
    taxonomy: verdict.taxonomy,
    gate_block: verdict.gate_block ?? verdict.gate?.block,
    feedback: verdict.judge_feedback,
    session_tools: read(cwd, 'session.json', {})?.tool_count,
  };

  appendLine(cwd, 'regression.jsonl', entry);

  const home = process.env.HOME || '/tmp';
  const globalDir = path.join(home, GLOBAL_REGRESSION, 'regression');
  const legacyDir = path.join(home, LEGACY_GLOBAL_REGRESSION, 'regression');
  fs.mkdirSync(globalDir, { recursive: true });
  const globalFile = path.join(globalDir, `${entry.repo}.jsonl`);
  fs.appendFileSync(globalFile, JSON.stringify({ ...entry, cwd }) + '\n');
}

function summarize(cwd) {
  const log = path.join(dir(cwd), 'regression.jsonl');
  if (!fs.existsSync(log)) return { runs: 0 };
  const rows = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const gaps = rows.map((r) => r.reward_hacking_gap).filter((g) => g != null);
  const survival = rows.map((r) => r.mutant_survival_rate ?? r.test_adequacy).filter((a) => a != null);
  return {
    runs: rows.length,
    avg_gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
    avg_mutant_survival_rate: survival.length ? survival.reduce((a, b) => a + b, 0) / survival.length : null,
    blocks: rows.filter((r) => (r.gate_decision || (r.gate_block ? 'block' : 'pass')) === 'block').length,
    taxonomies: rows.reduce((acc, r) => {
      const t = r.taxonomy?.primary || 'unknown';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {}),
  };
}

module.exports = { store, summarize, repoId };