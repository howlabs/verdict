// verdict gate policy — patch vs suite adequacy modes

const fs = require('fs');
const path = require('path');
const { env } = require('./verdict-runtime.js');

const MODES = new Set(['advisory', 'strict', 'require-test-update']);
const SUITE = new Set(['advisory', 'required', 'off']);

function loadGateConfig(cwd) {
  const defaults = {
    mode: (env('GATE_MODE') || 'strict').toLowerCase(),
    patch_correctness: 'required',
    suite_adequacy: (env('SUITE_ADEQUACY') || 'required').toLowerCase(),
    mutant_survival_threshold: Number(env('MAX_SURVIVAL_RATE') ?? env('MAX_ADEQUACY') ?? 60),
  };

  for (const rel of ['.verdict/gate.json', 'verdict.gate.json']) {
    const p = path.join(cwd || '.', rel);
    if (!fs.existsSync(p)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j.mode) defaults.mode = String(j.mode).toLowerCase();
      if (j.patch_correctness) defaults.patch_correctness = j.patch_correctness;
      if (j.suite_adequacy) defaults.suite_adequacy = String(j.suite_adequacy).toLowerCase();
      if (j.mutant_survival_threshold != null) {
        const t = Number(j.mutant_survival_threshold);
        defaults.mutant_survival_threshold = t <= 1 ? t * 100 : t;
      }
      break;
    } catch { /* ignore */ }
  }

  if (!MODES.has(defaults.mode)) defaults.mode = 'strict';
  if (!SUITE.has(defaults.suite_adequacy)) defaults.suite_adequacy = 'required';
  return defaults;
}

function pctToFraction(pct) {
  if (pct == null) return null;
  return Math.round(pct * 10) / 1000;
}

function fractionToPct(frac) {
  if (frac == null) return null;
  return Math.round(frac * 1000) / 10;
}

module.exports = { loadGateConfig, pctToFraction, fractionToPct, MODES, SUITE };