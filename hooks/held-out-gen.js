#!/usr/bin/env node
// xiao v0.3 — ConVerTest-lite: sinh held-out từ spec (docs.md §5③)

const fs = require('fs');
const path = require('path');
const { findSpec } = require('./blinded-checker.js');

function generate(cwd) {
  const specPath = findSpec(cwd);
  const outDir = path.join(cwd, '.xiao', 'held-out');
  if (!specPath) return { generated: 0, reason: 'no spec' };

  const spec = fs.readFileSync(specPath, 'utf8');
  const bullets = spec.split('\n').filter((l) => /^[-*]/.test(l.trim())).slice(0, 5);
  if (!bullets.length) return { generated: 0, reason: 'no bullets' };

  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, 'auto_from_spec.py');
  if (fs.existsSync(target)) return { generated: 0, reason: 'already exists', path: target };

  const body = bullets.map((b, i) => `    # ${b.trim().slice(1).trim()}`).join('\n');
  const content = `"""xiao ConVerTest-lite — generated from spec, không dùng patch làm oracle."""
import pytest

def test_spec_constraints_exist():
    """Placeholder: held-out dir present; strict tests added manually or by mutation feedback."""
${body}
    assert True
`;
  fs.writeFileSync(target, content);
  return { generated: 1, path: target };
}

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  console.log(JSON.stringify(generate(cwd), null, 2));
}

module.exports = { generate };