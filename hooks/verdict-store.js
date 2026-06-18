const fs = require('fs');
const path = require('path');
const { ARTIFACT_DIR } = require('./brand.js');

function dir(cwd) {
  return path.join(cwd, ARTIFACT_DIR);
}

function resolveReadPath(cwd, name) {
  return path.join(dir(cwd), name);
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
  return path.join(dir(cwd), 'held-out');
}

module.exports = { dir, read, write, appendLine, heldOutDir, resolveReadPath };