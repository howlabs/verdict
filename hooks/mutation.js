#!/usr/bin/env node
// xiao v0.3 — STING-lite: % mutants survived = test weakness (docs.md §5③)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ponytail: token swaps only; AST mutants in v1
const RULES = [
  [/int\(now\)/g, 'int(now + 99)'],
  [/<=/g, '<'],
  [/return count <=/g, 'return count <'],
];

function listPyFiles(cwd) {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory() && !/test|__pycache__|\.xiao/.test(ent.name)) walk(p);
      else if (ent.isFile() && p.endsWith('.py') && !/test/i.test(p)) out.push(p);
    }
  }
  walk(path.join(cwd, 'src'));
  if (!out.length) walk(cwd);
  return out.slice(0, 5);
}

function testCmd(cwd) {
  if (fs.existsSync(path.join(cwd, 'evaluation.sh'))) return 'bash evaluation.sh';
  if (fs.existsSync(path.join(cwd, 'tests'))) return 'python3 -m pytest tests/ -q';
  return null;
}

function runTests(cwd, cmd) {
  try {
    execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function measure(cwd) {
  const cmd = testCmd(cwd);
  if (!cmd) return { adequacy: null, total: 0, survived: 0, mutants: [] };

  const files = listPyFiles(cwd);
  let total = 0;
  let survived = 0;
  const mutants = [];

  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    for (const [pat, repl] of RULES) {
      if (!pat.test(original)) continue;
      const mutant = original.replace(pat, repl);
      if (mutant === original) continue;
      total += 1;
      let pass = false;
      try {
        fs.writeFileSync(file, mutant);
        pass = runTests(cwd, cmd);
      } finally {
        fs.writeFileSync(file, original);
        for (const d of [path.join(cwd, 'src'), path.join(cwd, 'tests'), cwd]) {
          try { fs.rmSync(path.join(d, '__pycache__'), { recursive: true }); } catch {}
        }
      }
      if (pass) survived += 1;
      mutants.push({ file: path.relative(cwd, file), rule: String(pat), survived: pass });
      if (total >= 12) break;
    }
    if (total >= 12) break;
  }

  const adequacy = total ? Math.round((survived / total) * 1000) / 10 : null;
  return { adequacy, total, survived, mutants };
}

if (require.main === module && process.argv.includes('--check')) {
  const os = require('os');
  const tmp = path.join(os.tmpdir(), 'xiao-mut');
  fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'src', 'm.py'), 'def ok():\n    x = 1\n    return x <= 2\n');
  fs.writeFileSync(path.join(tmp, 'tests', 'test_m.py'), 'from src.m import ok\ndef test_f():\n    assert ok() is True\n');
  const r = measure(tmp);
  if (r.total < 1 || r.adequacy === null) throw new Error('mutation check failed');
  console.log('ok');
}

module.exports = { measure };