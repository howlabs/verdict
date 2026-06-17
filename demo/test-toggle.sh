#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$HOME/.claude/.xiao-active"
rm -f "$STATE"

echo '{"prompt":"/xiao off"}' | node "$ROOT/hooks/xiao-mode-tracker.js" >/dev/null
echo '{"tool_name":"Bash","tool_input":{"command":"grep x src.py"},"cwd":"/tmp"}' \
  | node "$ROOT/hooks/hacking-detector.js" | grep -q '^{}$' && echo "off: hooks silent ✓"

echo '{"prompt":"/xiao lite"}' | node "$ROOT/hooks/xiao-mode-tracker.js" >/dev/null
echo '{"tool_name":"Bash","tool_input":{"command":"grep x src.py"},"cwd":"/tmp"}' \
  | node "$ROOT/hooks/hacking-detector.js" | grep -q XIAO && echo "lite: post hook ✓"
echo '{"cwd":"/tmp"}' | node "$ROOT/hooks/stop-judge.js" | grep -q '^{}$' && echo "lite: stop skipped ✓"

echo '{"prompt":"/xiao on"}' | node "$ROOT/hooks/xiao-mode-tracker.js" >/dev/null
echo '{"tool_name":"Bash","tool_input":{"command":"grep x src.py"},"cwd":"/tmp"}' \
  | node "$ROOT/hooks/hacking-detector.js" | grep -q XIAO && echo "on: post hook ✓"

echo "toggle: ok"