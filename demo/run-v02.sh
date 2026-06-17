#!/usr/bin/env bash
# docs.md compliance smoke — v0.2 modules
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HARD="$ROOT/demo/hard"

chmod +x "$HARD/evaluation.sh"
rm -rf "$HARD/.xiao/flags.jsonl" "$HARD/.xiao/verdict.json" "$HARD/.xiao/session.json"

echo "=== 1) PreToolUse snapshot ==="
echo '{"tool_name":"Bash","tool_input":{"command":"echo x"},"cwd":"'"$HARD"'","hook_event_name":"PreToolUse"}' \
  | node "$ROOT/hooks/pre-tool-use.js"
test -f "$HARD/.xiao/session.json" && echo "  ✓ session.json"

echo "=== 2) PostToolUse hacking ==="
echo '{"tool_name":"Bash","tool_input":{"command":"rg foo src/"},"cwd":"'"$HARD"'"}' \
  | node "$ROOT/hooks/hacking-detector.js" | grep -q XIAO && echo "  ✓ flag"

echo "=== 3) Stop — blinded + evaluation.sh + gap ==="
echo '{"cwd":"'"$HARD"'","hook_event_name":"Stop"}' \
  | node "$ROOT/hooks/stop-judge.js" | grep -q "XIAO STOP" && echo "  ✓ stop verdict"

node "$ROOT/hooks/report.js" "$HARD" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const r=JSON.parse(d);
  const ok = r.hacking_flags>=1 && r.blinded_verdict!==null && r.reward_hacking_gap!==null;
  console.log('  hacking_flags:', r.hacking_flags);
  console.log('  blinded_verdict:', r.blinded_verdict);
  console.log('  reward_hacking_gap:', r.reward_hacking_gap);
  if(!ok) process.exit(1);
  console.log('  ✓ docs.md §6 signals present');
})"

echo "=== 4) blinded-checker unit ==="
node "$ROOT/hooks/blinded-checker.js" --check && echo "  ✓ blinded ok"

echo "=== ALL v0.2 compliance PASS ==="