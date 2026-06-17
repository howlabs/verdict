const fs = require('fs');
const path = require('path');

function dir(cwd) {
  return path.join(cwd, '.xiao');
}

function read(cwd, name, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir(cwd), name), 'utf8'));
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
  fs.mkdirSync(dir(cwd), { recursive: true });
  fs.appendFileSync(path.join(dir(cwd), name), JSON.stringify(obj) + '\n');
}

module.exports = { dir, read, write, appendLine };