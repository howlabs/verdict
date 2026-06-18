#!/usr/bin/env node
// verdict — mutation via stdlib ast (py) + token scan (js/ts)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const JS_FLIPS = [
  ['<=', '<'],
  ['>=', '>'],
  ['===', '!=='],
  ['!==', '==='],
  ['==', '!='],
  ['!=', '=='],
  ['&&', '||'],
  ['||', '&&'],
];

const BOOL_FLIPS = [
  [/\btrue\b/g, 'false'],
  [/\bfalse\b/g, 'true'],
];

function pyBin() {
  for (const bin of ['python3', 'python']) {
    try {
      execSync(`${bin} --version`, { stdio: 'pipe' });
      return bin;
    } catch { /* next */ }
  }
  return null;
}

function listSourceFiles(cwd) {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory() && !/test|__pycache__|node_modules|\.verdict|\.xiao/.test(ent.name)) walk(p);
      else if (ent.isFile() && /\.(py|ts|js|mjs|cjs)$/.test(p) && !/test/i.test(p)) out.push(p);
    }
  }
  walk(path.join(cwd, 'src'));
  if (!out.length) walk(cwd);
  return out.slice(0, 5);
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

function pyMutants(file, limit) {
  const py = pyBin();
  if (!py) return [];
  const script = path.join(__dirname, 'mutation-ast.py');
  try {
    const out = execSync(`"${py}" "${script}" list "${file}" ${limit}`, { encoding: 'utf8' });
    return JSON.parse(out.trim() || '[]');
  } catch {
    return [];
  }
}

function scanCodeSpans(code) {
  const spans = [];
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    if (rest.startsWith('//')) {
      const end = code.indexOf('\n', i);
      i = end === -1 ? code.length : end + 1;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 2;
      continue;
    }
    const m = rest.match(/^(['"`])/);
    if (m) {
      const q = m[1];
      let j = i + 1;
      while (j < code.length) {
        if (code[j] === '\\') { j += 2; continue; }
        if (code[j] === q) { j += 1; break; }
        j += 1;
      }
      i = j;
      continue;
    }
    spans.push(i);
    i += 1;
  }
  return new Set(spans);
}

function jsMutants(code, limit = 12) {
  const codeIdx = scanCodeSpans(code);
  const mutants = [];
  const seen = new Set();

  for (const [from, to] of JS_FLIPS) {
    let pos = 0;
    while (pos < code.length && mutants.length < limit) {
      const idx = code.indexOf(from, pos);
      if (idx === -1) break;
      pos = idx + from.length;
      if (!codeIdx.has(idx)) continue;
      const mutant = code.slice(0, idx) + to + code.slice(idx + from.length);
      if (mutant === code || seen.has(mutant)) continue;
      seen.add(mutant);
      mutants.push({ rule: `js:${from}->${to}`, source: mutant });
    }
  }

  for (const [pat, repl] of BOOL_FLIPS) {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(code)) && mutants.length < limit) {
      if (!codeIdx.has(m.index)) continue;
      const mutant = code.slice(0, m.index) + repl + code.slice(m.index + m[0].length);
      if (mutant === code || seen.has(mutant)) continue;
      seen.add(mutant);
      mutants.push({ rule: `js:${m[0]}->${repl}`, source: mutant });
    }
  }
  return mutants.slice(0, limit);
}

function mutantsFor(file, limit) {
  const original = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.py')) return pyMutants(file, limit).map((m) => ({ ...m, original }));
  if (/\.(ts|js|mjs|cjs)$/.test(file)) return jsMutants(original, limit).map((m) => ({ ...m, original }));
  return [];
}

function backupWrite(cwd, file, content, original) {
  const rel = path.relative(cwd, file);
  const backup = path.join(cwd, '.verdict', '.mut-backup', rel);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.writeFileSync(backup, original);
  fs.writeFileSync(file, content);
}

function restoreFile(file, original) {
  fs.writeFileSync(file, original);
}

function clearCaches(cwd) {
  for (const d of [path.join(cwd, 'src'), path.join(cwd, 'tests'), cwd]) {
    try { fs.rmSync(path.join(d, '__pycache__'), { recursive: true }); } catch {}
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
  const max = 12;

  for (const file of files) {
    const list = mutantsFor(file, max - total);
    for (const m of list) {
      if (total >= max) break;
      total += 1;
      let pass = false;
      try {
        backupWrite(cwd, file, m.source, m.original);
        pass = runTests(cwd, cmd);
      } finally {
        restoreFile(file, m.original);
        clearCaches(cwd);
      }
      if (pass) survived += 1;
      mutants.push({ file: path.relative(cwd, file), rule: m.rule, survived: pass });
    }
    if (total >= max) break;
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
  const jsTmp = path.join(os.tmpdir(), 'xiao-mut-js');
  fs.mkdirSync(path.join(jsTmp, 'src'), { recursive: true });
  fs.writeFileSync(path.join(jsTmp, 'src', 'm.js'), 'export function ok(x) { return x <= 2; }\n');
  const jm = jsMutants(fs.readFileSync(path.join(jsTmp, 'src', 'm.js'), 'utf8'));
  if (jm.length < 1) throw new Error('js mutation check failed');
  console.log('ok');
}

module.exports = { measure, jsMutants, pyMutants, mutantsFor };