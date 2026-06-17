#!/usr/bin/env node
// xiao — SessionStart: announce active mode

const { getMode, isEnabled } = require('./xiao-runtime');

const mode = getMode();
if (!isEnabled()) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: 'xiao: OFF (judgment hooks disabled). Use /xiao on to enable.',
    },
  }));
} else if (mode === 'lite') {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: 'xiao: LITE — PostToolUse hacking flags only.',
    },
  }));
} else {
  process.stdout.write('{}');
}