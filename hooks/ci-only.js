#!/usr/bin/env node
// Plain CI — visible tests only (what merges without verdict)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function runSh(cwd, cmd) {
  try {
    execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function check(cwd) {
  const evalSh = path.join(cwd, 'evaluation.sh');
  if (!fs.existsSync(evalSh)) {
    return {
      pass: null,
      would_merge: null,
      command: null,
      scope: 'visible_only',
      checks_run: [],
      checks_skipped: ['held_out', 'mutation', 'hacking_flags', 'blinded_judge', 'agent_runtime'],
    };
  }

  const pass = runSh(cwd, 'bash evaluation.sh');
  return {
    pass,
    would_merge: pass,
    command: 'bash evaluation.sh',
    scope: 'visible_only',
    checks_run: ['visible_tests'],
    checks_skipped: ['held_out', 'mutation', 'hacking_flags', 'blinded_judge', 'agent_runtime'],
    label: 'CI without verdict (visible suite only)',
  };
}

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  console.log(JSON.stringify(check(cwd), null, 2));
  process.exit(check(cwd).pass ? 0 : 1);
}

module.exports = { check };