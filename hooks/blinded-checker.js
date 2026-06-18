#!/usr/bin/env node
// verdict — Blinded Checker: 3-phase MARCH-lite
// Proposer sees diff → claims. Checker sees spec+repo only. Judge scores.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SPEC_CANDIDATES = ['.verdict/spec.md', '.verdict/spec.txt', 'SPEC.md'];

function findSpec(cwd) {
  for (const rel of SPEC_CANDIDATES) {
    const p = path.join(cwd, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function gitDiff(cwd, since) {
  try {
    const range = since ? `${since}..HEAD` : 'HEAD';
    return execSync(`git diff ${range} 2>/dev/null || git diff HEAD`, { cwd, encoding: 'utf8' });
  } catch {
    try { return execSync('git diff HEAD', { cwd, encoding: 'utf8' }); }
    catch { return ''; }
  }
}

// Phase 1 — Proposer (sees patch)
function proposer(diff) {
  const claims = [];
  const files = [...diff.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1]);
  const reqs = [...diff.matchAll(/^\+.*(?:def |function |class |return |assert )(.+)$/gm)]
    .map((m) => m[0].slice(1).trim())
    .slice(0, 8);

  for (const file of [...new Set(files)].filter((f) => !/test|spec/i.test(f))) {
    claims.push({ id: `file:${file}`, file, asserted: `modified ${file}`, kind: 'file' });
  }
  for (const line of reqs) {
    claims.push({ id: `line:${line.slice(0, 40)}`, file: files[0] || 'unknown', asserted: line, kind: 'behavior' });
  }
  return claims.slice(0, 12);
}

// Phase 2 — Checker MÙ (spec + repo file content, NO diff)
function checker(specText, claims, cwd) {
  const rejected = [];
  const specLower = specText.toLowerCase();

  for (const claim of claims) {
    if (claim.kind === 'file') {
      const mentioned = specLower.includes(claim.file.toLowerCase())
        || specLower.includes(path.basename(claim.file).toLowerCase());
      if (!mentioned && specText.length > 200) {
        rejected.push({ ...claim, reason: 'file không được spec đề cập' });
      }
      continue;
    }

    const fp = path.join(cwd, claim.file);
    if (!fs.existsSync(fp)) {
      rejected.push({ ...claim, reason: 'file không tồn tại trong repo' });
      continue;
    }
    const content = fs.readFileSync(fp, 'utf8');
    const keywords = (claim.asserted.match(/\b[a-z_]{4,}\b/gi) || []).slice(0, 5);
    const specHits = keywords.filter((k) => specLower.includes(k.toLowerCase())).length;
    const codeHits = keywords.filter((k) => content.includes(k)).length;
    if (keywords.length >= 2 && specHits >= 1 && codeHits === 0) {
      rejected.push({ ...claim, reason: 'spec yêu cầu behavior nhưng code không chứa keyword liên quan' });
    }
  }
  return rejected;
}

// Phase 3 — Judge (rubric 1–4)
function judge(claims, rejected, hackingFlags) {
  const rejectN = rejected.length;
  const hackPenalty = Math.min(2, Math.floor(hackingFlags / 2));
  let score = 4 - rejectN - hackPenalty;
  if (score < 1) score = 1;
  return {
    score,
    rejected_count: rejectN,
    claims_total: claims.length,
    feedback: rejectN
      ? `Checker mù bác ${rejectN}/${claims.length} claim dù test có thể xanh. Xem lại spec vs implementation.`
      : 'Claims khớp spec (blinded check).',
  };
}

function run(cwd, opts = {}) {
  const specPath = findSpec(cwd);
  const specText = specPath ? fs.readFileSync(specPath, 'utf8') : '';
  const diff = opts.diff ?? gitDiff(cwd, opts.since);
  const claims = proposer(diff);
  const rejected = checker(specText, claims, cwd);
  const verdict = judge(claims, rejected, opts.hackingFlags || 0);
  return { specPath, claims, rejected, verdict, diff_empty: !diff.trim() };
}

if (require.main === module && process.argv.includes('--check')) {
  const tmp = path.join(require('os').tmpdir(), 'verdict-blind-check');
  fs.mkdirSync(path.join(tmp, '.verdict'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.verdict', 'spec.md'), '# spec\nrate_limiter.py must use window_sec\n');
  fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'src', 'rate_limiter.py'), 'def allow(): return True\n');
  const diff = '+++ b/src/other.py\n+def foo(): return 1\n';
  const r = run(tmp, { diff, hackingFlags: 0 });
  if (r.rejected.length < 1) throw new Error('expected at least 1 rejection');
  console.log('ok');
}

module.exports = { run, proposer, checker, judge, findSpec };