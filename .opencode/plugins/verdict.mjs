// verdict — OpenCode adapter
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { detect } = require(path.join(root, 'hooks/hacking-detector.js'));

function runHook(script, payload) {
  const r = spawnSync(process.execPath, [path.join(root, 'hooks', script)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  try { return JSON.parse(r.stdout || '{}'); } catch { return {}; }
}

export default async () => ({
  'tool.execute.after': async (input) => {
    const tool = (input?.tool || '').toLowerCase();
    if (!['bash', 'edit', 'write', 'strreplace'].includes(tool)) return;
    const cwd = input.cwd || process.cwd();
    const payload = {
      tool_name: tool.charAt(0).toUpperCase() + tool.slice(1),
      tool_input: input.args || input.input || {},
      cwd,
      hook_event_name: 'PostToolUse',
    };
    if (tool === 'bash') payload.tool_input = { command: input.args?.command || input.input?.command || '' };
    detect(payload);
    runHook('pre-tool-use.js', { ...payload, hook_event_name: 'PreToolUse' });
  },
});