#!/usr/bin/env node
// verdict — ConVerTest-lite: held-out from spec (rule-based + optional LLM)

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { findSpec } = require('./blinded-checker.js');

const STOP = new Set([
  'must', 'should', 'require', 'shall', 'that', 'this', 'with', 'from', 'into',
  'when', 'then', 'than', 'have', 'been', 'will', 'also', 'each', 'only', 'using',
]);

function listSrcFiles(cwd) {
  const out = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory() && !/test|node_modules|\.verdict|\.xiao|__pycache__/.test(ent.name)) walk(p);
      else if (ent.isFile() && /\.(py|ts|js)$/.test(p) && !/test/i.test(p)) out.push(path.relative(cwd, p).replace(/\\/g, '/'));
    }
  }
  walk(path.join(cwd, 'src'));
  if (!out.length) walk(cwd);
  return out.slice(0, 8);
}

function parseBullet(line) {
  const text = line.trim().replace(/^[-*]\s*/, '');
  const quoted = [...text.matchAll(/`([^`]+)`|'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2] || m[3]);
  const ids = [...text.matchAll(/\b([A-Za-z_][A-Za-z0-9_]{2,})\b/g)]
    .map((m) => m[1])
    .filter((w) => !STOP.has(w.toLowerCase()));
  const keywords = [...new Set([...quoted, ...ids])].slice(0, 5);
  return { text, keywords };
}

function isTrivialTestBody(body) {
  return !body || !/def test_/m.test(body) || /assert\s+True\b/.test(body);
}

function buildRuleTests(bullets, srcFiles) {
  const blocks = [];
  bullets.forEach((line, i) => {
    const { text, keywords } = parseBullet(line);
    if (!keywords.length) return;
    const note = text.replace(/\s+/g, ' ').slice(0, 200);
    blocks.push(`
def test_held_out_spec_${i}():
    # spec: ${note.replace(/#/g, '')}
    combined = ""
    for rel in ${JSON.stringify(srcFiles)}:
        p = ROOT / rel
        if p.is_file():
            combined += p.read_text(encoding="utf-8", errors="ignore")
    missing = [k for k in ${JSON.stringify(keywords)} if k not in combined]
    assert not missing, f"spec requires {missing!r} in source, not just visible tests"
`);
  });
  return blocks.join('\n');
}

function llmHeldOutTests(spec, srcFiles, cwd) {
  const { env } = require('./verdict-runtime.js');
  if (env('LLM') !== '1') return null;
  const sample = srcFiles.slice(0, 2).map((rel) => {
    const p = path.join(cwd, rel);
    return fs.existsSync(p) ? `--- ${rel} ---\n${fs.readFileSync(p, 'utf8').slice(0, 1200)}` : '';
  }).filter(Boolean).join('\n\n');
  const prompt = `Write pytest held-out tests from SPEC only (blinded — do not assume patch). `
    + `Output ONLY valid Python test functions, no markdown. Each test must assert behavior or keywords from spec, NOT assert True.\n\n`
    + `SPEC:\n${spec.slice(0, 2500)}\n\nSOURCE (read-only context):\n${sample}`;
  const r = spawnSync('claude', ['-p', prompt, '--max-turns', '1'], { encoding: 'utf8', timeout: 90000 });
  if (r.status !== 0 || r.error) return null;
  const body = (r.stdout || '').trim().replace(/^```(?:python)?\s*/m, '').replace(/```\s*$/m, '').trim();
  if (isTrivialTestBody(body)) return null;
  return body;
}

function generate(cwd) {
  const specPath = findSpec(cwd);
  const { dir } = require('./verdict-store');
  const outDir = path.join(dir(cwd), 'held-out');
  if (!specPath) return { generated: 0, reason: 'no spec' };

  const spec = fs.readFileSync(specPath, 'utf8');
  const bullets = spec.split('\n').filter((l) => /^[-*]/.test(l.trim())).slice(0, 8);
  if (!bullets.length) return { generated: 0, reason: 'no bullets' };

  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, 'auto_from_spec.py');
  if (fs.existsSync(target)) return { generated: 0, reason: 'already exists', path: target };

  const srcFiles = listSrcFiles(cwd);
  const llmBody = llmHeldOutTests(spec, srcFiles, cwd);
  const ruleBody = buildRuleTests(bullets, srcFiles);
  if (!llmBody && !ruleBody.trim()) return { generated: 0, reason: 'no constraints parsed' };

  const header = `"""verdict ConVerTest-lite — generated from spec, không dùng patch làm oracle."""
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[2]
`;
  const content = llmBody
    ? `${header}\n${llmBody}\n`
    : `${header}${ruleBody}\n`;
  if (isTrivialTestBody(content.replace(header, ''))) {
    return { generated: 0, reason: 'only trivial assertions' };
  }
  fs.writeFileSync(target, content);
  return { generated: 1, path: target, mode: llmBody ? 'llm' : 'rules' };
}

if (require.main === module && process.argv.includes('--check')) {
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xiao-held-'));
  fs.mkdirSync(path.join(tmp, '.verdict'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.verdict', 'spec.md'), '# spec\n- rate_limiter must use window_sec\n');
  fs.writeFileSync(path.join(tmp, 'src', 'rate_limiter.py'), 'window_sec = 60\ndef allow(): return True\n');
  const r = generate(tmp);
  if (r.generated !== 1) throw new Error(`held-out gen failed: ${JSON.stringify(r)}`);
  const body = fs.readFileSync(r.path, 'utf8');
  if (!body.includes('assert') || body.includes('assert True')) throw new Error('held-out still trivial');
  if (!body.includes('window_sec')) throw new Error('held-out missing spec keyword');
  console.log('ok');
}

if (require.main === module && !process.argv.includes('--check')) {
  const cwd = process.argv[2] || process.cwd();
  console.log(JSON.stringify(generate(cwd), null, 2));
}

module.exports = { generate, parseBullet, buildRuleTests };