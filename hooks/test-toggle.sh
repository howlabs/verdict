#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$HOME/.claude/.verdict-active"
LEGACY="$HOME/.claude/.xiao-active"
rm -f "$STATE" "$LEGACY"

echo '{"prompt":"/verdict off"}' | node "$ROOT/hooks/verdict-mode-tracker.js" >/dev/null
echo '{"tool_name":"Bash","tool_input":{"command":"grep x src.py"},"cwd":"/tmp"}' \
  | node "$ROOT/hooks/hacking-detector.js" | grep -q '^{}$' && echo "off: hooks silent ✓"

echo '{"prompt":"/verdict lite"}' | node "$ROOT/hooks/verdict-mode-tracker.js" >/dev/null
echo '{"tool_name":"Bash","tool_input":{"command":"grep x src.py"},"cwd":"/tmp"}' \
  | node "$ROOT/hooks/hacking-detector.js" | grep -q VERDICT && echo "lite: post hook ✓"
echo '{"cwd":"/tmp"}' | node "$ROOT/hooks/stop-judge.js" | grep -q '^{}$' && echo "lite: stop skipped ✓"

echo '{"prompt":"/xiao on"}' | node "$ROOT/hooks/verdict-mode-tracker.js" >/dev/null
echo '{"tool_name":"Bash","tool_input":{"command":"grep x src.py"},"cwd":"/tmp"}' \
  | node "$ROOT/hooks/hacking-detector.js" | grep -q VERDICT && echo "on: post hook ✓ (alias /xiao)"

echo "toggle: ok"