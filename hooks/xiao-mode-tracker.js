#!/usr/bin/env node
// xiao — UserPromptSubmit: /xiao on|off|lite (ponytail-style)

const { setMode, getMode, emptyOut } = require('./xiao-runtime');

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input.replace(/^\uFEFF/, ''));
    const prompt = (data.prompt || '').trim().toLowerCase();
    let changed = null;

    if (/^[/@$]xiao\b/.test(prompt)) {
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

    if (/\b(stop xiao|xiao off)\b/i.test(prompt)) {
      setMode('off');
      changed = 'off';
    }

    if (changed) {
      const msg = changed === 'off'
        ? 'XIAO OFF — judgment hooks disabled'
        : changed === 'lite'
          ? 'XIAO LITE — PostToolUse flags only, no Stop gate'
          : changed === 'on'
            ? 'XIAO ON — full judgment layer (Pre/Post/Stop)'
            : `XIAO status: ${getMode()}`;
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