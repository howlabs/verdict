#!/usr/bin/env node
// verdict — UserPromptSubmit: /verdict on|off|lite

const { setMode, getMode, emptyOut } = require('./verdict-runtime');
const { NAME_UPPER, CMD } = require('./brand.js');

const CMD_RE = /^[/@$]verdict\b/;

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const prompt = (data.prompt || '').trim().toLowerCase();
    let changed = null;

    if (CMD_RE.test(prompt)) {
      const arg = (prompt.split(/\s+/)[1] || 'on').replace(/^:/, '');
      if (arg === 'off') {
        setMode('off');
        changed = 'off';
      } else if (arg === 'lite') {
        setMode('lite');
        changed = 'lite';
      } else if (arg === 'on' || arg === 'full' || arg === 'status') {
        if (arg === 'status') changed = getMode();
        else { setMode('on'); changed = 'on'; }
      } else {
        setMode('on');
        changed = 'on';
      }
    }

    if (/\b(stop verdict|verdict off)\b/i.test(prompt)) {
      setMode('off');
      changed = 'off';
    }

    if (changed) {
      const msg = changed === 'off'
        ? `${NAME_UPPER} OFF — judgment hooks disabled`
        : changed === 'lite'
          ? `${NAME_UPPER} LITE — PostToolUse flags only, no Stop gate`
          : changed === 'on'
            ? `${NAME_UPPER} ON — full judgment layer (Pre/Post/Stop)`
            : `${NAME_UPPER} status: ${getMode()} (${CMD})`;
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: msg,
        },
      }));
    } else emptyOut();
  } catch {
    emptyOut();
  }
});