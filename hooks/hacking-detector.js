#!/usr/bin/env node
// xiao MVP — PostToolUse reward-hacking detector (docs.md §5②)

const fs = require('fs');
const path = require('path');

// ponytail: naive regex heuristics; upgrade to AST + eval.sh gate in v0.2
const STRING_MATCH = /\b(grep|rg|ag|sed|awk|perl\s+-[np]e)\b/i;
const EXEC = /\b(npm\s+test|pnpm\s+test|yarn\s+test|pytest|cargo\s+test|go\s+test|jest|vitest|mvn\s+test|gradle\s+test|dotnet\s+test|make\s+test|evaluation\.sh|\.\/.*test)\b/i;
const TEST_PATH = /(?:^|\/)(tests?\/|__tests__\/|.*_(test|spec)\.|.*\.(test|spec)\.(js|ts|tsx|jsx|py|rs|go|java))/i;

function readStdin() {
  return new Promise((resolve) => {
    let buf = '';
    process.stdin.on('data', (c) => { buf += c; });
    process.stdin.on('end', () => resolve(buf));
  });
}

function stateDir(cwd) {
  return path.join(cwd, '.xiao');
}

function appendFlag(cwd, flag) {
  const dir = stateDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'flags.jsonl'), JSON.stringify(flag) + '\n');
}

function detect(data) {
  const cwd = data.cwd || process.cwd();
  const name = data.tool_name || '';
  const input = data.tool_input || {};
  const flags = [];

  if (name === 'Bash') {
    const cmd = String(input.command || '');
    if (cmd && STRING_MATCH.test(cmd) && !EXEC.test(cmd)) {
      flags.push({
        type: 'HACK_STRING_MATCH',
        detail: 'so chuỗi thay vì thực thi (grep/sed, không build/test)',
        cmd,
      });
    }
  }

  const file = input.file_path || input.path || '';
  if (file && TEST_PATH.test(file) && /^(Edit|Write|StrReplace)$/.test(name)) {
    flags.push({
      type: 'HACK_TEST_EDIT',
      detail: 'sửa file test — có thể chỉnh test cho xanh',
      file,
    });
  }

  for (const f of flags) {
    appendFlag(cwd, { ts: Date.now(), ...f, tool: name });
  }
  return flags;
}

function hookOut(flags) {
  if (!flags.length) {
    process.stdout.write('{}');
    return;
  }
  const lines = flags.map((f) => `🚨 XIAO ${f.type}: ${f.detail}`);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: lines.join('\n'),
    },
  }));
}

async function main() {
  const raw = (await readStdin()).replace(/^\uFEFF/, '');
  if (!raw.trim()) return;
  try {
    hookOut(detect(JSON.parse(raw)));
  } catch {
    process.stdout.write('{}');
  }
}

// --- self-check (ponytail: one runnable check, no framework) ---
function selfCheck() {
  const cases = [
    [{ tool_name: 'Bash', tool_input: { command: 'grep foo src.py' }, cwd: '/tmp' }, 1],
    [{ tool_name: 'Bash', tool_input: { command: 'pytest -q' }, cwd: '/tmp' }, 0],
    [{ tool_name: 'Edit', tool_input: { file_path: 'tests/foo_test.py' }, cwd: '/tmp' }, 1],
    [{ tool_name: 'Edit', tool_input: { file_path: 'src/foo.py' }, cwd: '/tmp' }, 0],
  ];
  for (const [input, want] of cases) {
    const got = detect(input).length;
    if (got !== want) throw new Error(`want ${want} flags, got ${got}: ${JSON.stringify(input)}`);
  }
  console.log('ok');
}

if (require.main === module && process.argv.includes('--check')) {
  selfCheck();
} else if (require.main === module) {
  main();
}

module.exports = { detect, TEST_PATH, STRING_MATCH, EXEC };