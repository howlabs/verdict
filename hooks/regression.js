// xiao v1 — regression dataset per repo (docs.md §4 STORE, moat)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { appendLine, read, dir } = require('./xiao-store');

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
    test_adequacy: verdict.test_adequacy,
    taxonomy: verdict.taxonomy,
    gate_block: verdict.gate_block,
    feedback: verdict.judge_feedback,
    session_tools: read(cwd, 'session.json', {})?.tool_count,
  };

  appendLine(cwd, 'regression.jsonl', entry);

  const globalFile = path.join(process.env.HOME || '/tmp', '.xiao', 'regression', `${entry.repo}.jsonl`);
  fs.mkdirSync(path.dirname(globalFile), { recursive: true });
  fs.appendFileSync(globalFile, JSON.stringify({ ...entry, cwd }) + '\n');
}

function summarize(cwd) {
  const log = path.join(dir(cwd), 'regression.jsonl');
  if (!fs.existsSync(log)) return { runs: 0 };
  const rows = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const gaps = rows.map((r) => r.reward_hacking_gap).filter((g) => g != null);
  const adequacy = rows.map((r) => r.test_adequacy).filter((a) => a != null);
  return {
    runs: rows.length,
    avg_gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
    avg_adequacy: adequacy.length ? adequacy.reduce((a, b) => a + b, 0) / adequacy.length : null,
    blocks: rows.filter((r) => r.gate_block).length,
    taxonomies: rows.reduce((acc, r) => {
      const t = r.taxonomy?.primary || 'unknown';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {}),
  };
}

module.exports = { store, summarize, repoId };