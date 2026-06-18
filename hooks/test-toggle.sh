#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$HOME/.claude/.verdict-active"
rm -f "$STATE"

echo '{"prompt":"/verdict off"}' | node "$ROOT/hooks/verdict-mode-tracker.js" >/dev/null
echo '{"tool_name":"Bash","tool_input":{"command":"grep x src.py"},"cwd":"/tmp"}' \
  | node "$ROOT/hooks/hacking-detector.js" | grep -q '^{}$' && echo "off: hooks silent ✓"

echo '{"prompt":"/verdict lite"}' | node "$ROOT/hooks/verdict-mode-tracker.js" >/dev/null
echo '{"tool_name":"Bash","tool_input":{"command":"grep x src.py"},"cwd":"/tmp"}' \
  | node "$ROOT/hooks/hacking-detector.js" | grep -q VERDICT && echo "lite: post hook ✓"
echo '{"cwd":"/tmp"}' | node "$ROOT/hooks/stop-judge.js" | grep -q '^{}$' && echo "lite: stop skipped ✓"

echo '{"prompt":"/verdict on"}' | node "$ROOT/hooks/verdict-mode-tracker.js" >/dev/null
echo '{"tool_name":"Bash","tool_input":{"command":"grep x src.py"},"cwd":"/tmp"}' \
  | node "$ROOT/hooks/hacking-detector.js" | grep -q VERDICT && echo "on: post hook ✓"

echo "toggle: ok"