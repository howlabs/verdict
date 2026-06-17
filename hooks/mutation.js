#!/usr/bin/env node
// verdict — STING-lite: mutant survival = test weakness

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ponytail: token swaps only; AST mutants in v1
const PY_RULES = [
  [/int\(now\)/g, 'int(now + 99)'],
  [/<=/g, '<'],
  [/return count <=/g, 'return count <'],
];

const TS_RULES = [
  [/clock\.now\(\)/g, 'Date.now()'],
  [/writeAtomic/g, 'read'],
  [/expiresAt > clock\.now\(\)/g, 'expiresAt > 0'],
  [/JSON\.parse/g, 'JSON.parse /*mut*/'],
];

function listSourceFiles(cwd) {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory() && !/test|__pycache__|node_modules|\.xiao/.test(ent.name)) walk(p);
      else if (ent.isFile() && /\.(py|ts)$/.test(p) && !/test/i.test(p)) out.push(p);
    }
  }
  walk(path.join(cwd, 'src'));
  if (!out.length) walk(cwd);
  return out.slice(0, 5);
}

function rulesFor(file) {
  return file.endsWith('.ts') ? TS_RULES : PY_RULES;
}

function testCmd(cwd) {
  if (fs.existsSync(path.join(cwd, 'evaluation.sh'))) return 'bash evaluation.sh';
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts?.test) return 'npm test';
    } catch { /* fall through */ }
  }
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
  const suiteScope = cmd && /evaluation\.sh|tests\//.test(cmd) ? 'visible' : 'default';
  if (!cmd) {
    return {
      mutant_survival_rate: null,
      mutation_kill_rate: null,
      total: 0,
      survived: 0,
      killed: 0,
      mutants: [],
      suite_scope: suiteScope,
    };
  }

  const files = listSourceFiles(cwd);
  let total = 0;
  let survived = 0;
  const mutants = [];

  for (const file of files) {
    const original = fs.readFileSync(file, 'utf8');
    for (const [pat, repl] of rulesFor(file)) {
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

  const mutant_survival_rate = total ? Math.round((survived / total) * 1000) / 10 : null;
  const mutation_kill_rate = mutant_survival_rate != null
    ? Math.round((100 - mutant_survival_rate) * 10) / 10
    : null;
  return {
    mutant_survival_rate,
    mutation_kill_rate,
    total,
    survived,
    killed: total - survived,
    mutants,
    suite_scope: suiteScope,
    // deprecated alias — high = bad (mutants survived)
    adequacy: mutant_survival_rate,
  };
}

if (require.main === module && process.argv.includes('--check')) {
  const os = require('os');
  const tmp = path.join(os.tmpdir(), 'xiao-mut');
  fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'src', 'm.py'), 'def ok():\n    x = 1\n    return x <= 2\n');
  fs.writeFileSync(path.join(tmp, 'tests', 'test_m.py'), 'from src.m import ok\ndef test_f():\n    assert ok() is True\n');
  const r = measure(tmp);
  if (r.total < 1 || r.mutant_survival_rate === null) throw new Error('mutation check failed');
  console.log('ok');
}

module.exports = { measure };