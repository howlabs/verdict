// xiao v0.3 — regression dataset per repo (docs.md §4 STORE, moat seed)

const { appendLine } = require('./xiao-store');

function store(cwd, verdict) {
  appendLine(cwd, 'regression.jsonl', {
    ts: verdict.ts || Date.now(),
    hacking_flags: verdict.hacking_flags,
    blinded_verdict: verdict.blinded_verdict,
    blinded_score: verdict.blinded_score,
    reward_hacking_gap: verdict.reward_hacking_gap,
    test_adequacy: verdict.test_adequacy,
    gate_block: verdict.gate_block,
  });
}

module.exports = { store };