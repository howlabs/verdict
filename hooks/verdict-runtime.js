// verdict — global on/off state (ponytail-style)

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  STATE_FILE,
  LEGACY_STATE_FILE,
  CMD,
  LEGACY_CMD,
  NAME_UPPER,
} = require('./brand.js');

const VALID = new Set(['on', 'off', 'lite']);

function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function statePath() {
  const dir = claudeDir();
  const next = path.join(dir, STATE_FILE);
  const legacy = path.join(dir, LEGACY_STATE_FILE);
  if (fs.existsSync(next)) return next;
  if (fs.existsSync(legacy)) return legacy;
  return next;
}

function getMode() {
  try {
    const m = fs.readFileSync(statePath(), 'utf8').trim().toLowerCase();
    return VALID.has(m) ? m : 'on';
  } catch {
    return 'on';
  }
}

function setMode(mode) {
  const m = (mode || 'on').toLowerCase();
  if (!VALID.has(m)) return getMode();
  fs.mkdirSync(claudeDir(), { recursive: true });
  fs.writeFileSync(path.join(claudeDir(), STATE_FILE), m);
  return m;
}

function clearMode() {
  for (const f of [STATE_FILE, LEGACY_STATE_FILE]) {
    try { fs.unlinkSync(path.join(claudeDir(), f)); } catch {}
  }
}

function isEnabled() {
  return getMode() !== 'off';
}

function isFull() {
  return getMode() === 'on';
}

function isLite() {
  return getMode() === 'lite';
}

function emptyOut() {
  process.stdout.write('{}');
}

function env(key, fallback = undefined) {
  const v = process.env[`VERDICT_${key}`];
  if (v != null && v !== '') return v;
  const legacy = process.env[`XIAO_${key}`];
  if (legacy != null && legacy !== '') return legacy;
  return fallback;
}

function toggleHelp() {
  return `${NAME_UPPER}: use ${CMD} on|lite|off (alias ${LEGACY_CMD})`;
}

module.exports = {
  getMode,
  setMode,
  clearMode,
  isEnabled,
  isFull,
  isLite,
  emptyOut,
  env,
  toggleHelp,
  VALID,
};