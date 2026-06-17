#!/usr/bin/env node
// xiao v0.2 — PreToolUse: snapshot repo + track tool intent (docs.md §3)

const { execSync } = require('child_process');
const { read, write } = require('./xiao-store');

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.on('data', (c) => { buf += c; });
    process.stdin.on('end', () => resolve(buf));
  });
}

function gitRev(cwd) {
  try { return execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim(); }
  catch { return null; }
}

async function main() {
  const { isFull, emptyOut } = require('./xiao-runtime');
  if (!isFull()) return emptyOut();
  const raw = (await readStdin()).replace(/^\uFEFF/, '');
  if (!raw.trim()) return;
  let data;
  try { data = JSON.parse(raw); } catch { return; }

  const cwd = data.cwd || process.cwd();
  const session = read(cwd, 'session.json', {
    start_rev: gitRev(cwd),
    tool_count: 0,
    started_at: Date.now(),
  });

  session.tool_count += 1;
  session.last_tool = {
    name: data.tool_name,
    input: data.tool_input,
    at: Date.now(),
  };
  if (!session.start_rev) session.start_rev = gitRev(cwd);

  write(cwd, 'session.json', session);
  process.stdout.write('{}');
}

if (require.main === module) main();