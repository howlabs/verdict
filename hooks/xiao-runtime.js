// xiao — global on/off state (ponytail-style)

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE = '.xiao-active';
const VALID = new Set(['on', 'off', 'lite']);

function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function statePath() {
  return path.join(claudeDir(), STATE);
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
  fs.writeFileSync(statePath(), m);
  return m;
}

function clearMode() {
  try { fs.unlinkSync(statePath()); } catch {}
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

module.exports = { getMode, setMode, clearMode, isEnabled, isFull, isLite, emptyOut, VALID };