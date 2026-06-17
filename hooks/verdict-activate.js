#!/usr/bin/env node
// verdict — SessionStart: announce active mode

const { getMode, isEnabled, toggleHelp } = require('./verdict-runtime');
const { NAME, CMD } = require('./brand.js');

const mode = getMode();
if (!isEnabled()) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `${NAME}: OFF (judgment hooks disabled). Use ${CMD} on to enable.`,
    },
  }));
} else if (mode === 'lite') {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `${NAME}: LITE — PostToolUse hacking flags only.`,
    },
  }));
} else {
  process.stdout.write('{}');
}