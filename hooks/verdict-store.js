const fs = require('fs');
const path = require('path');
const { ARTIFACT_DIR, LEGACY_ARTIFACT_DIR } = require('./brand.js');

function legacyDir(cwd) {
  return path.join(cwd, LEGACY_ARTIFACT_DIR);
}

function dir(cwd) {
  return path.join(cwd, ARTIFACT_DIR);
}

function resolveReadPath(cwd, name) {
  const primary = path.join(dir(cwd), name);
  if (fs.existsSync(primary)) return primary;
  const legacy = path.join(legacyDir(cwd), name);
  if (fs.existsSync(legacy)) return legacy;
  return primary;
}

function read(cwd, name, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(resolveReadPath(cwd, name), 'utf8'));
  } catch {
    return fallback;
  }
}

function write(cwd, name, data) {
  const d = dir(cwd);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, name), JSON.stringify(data, null, 2) + '\n');
}

function appendLine(cwd, name, obj) {
  const d = dir(cwd);
  fs.mkdirSync(d, { recursive: true });
  fs.appendFileSync(path.join(d, name), JSON.stringify(obj) + '\n');
}

function heldOutDir(cwd) {
  const primary = path.join(dir(cwd), 'held-out');
  if (fs.existsSync(primary)) return primary;
  const legacy = path.join(legacyDir(cwd), 'held-out');
  if (fs.existsSync(legacy)) return legacy;
  return primary;
}

module.exports = { dir, legacyDir, read, write, appendLine, heldOutDir, resolveReadPath };