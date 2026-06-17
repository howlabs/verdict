#!/usr/bin/env bash
# xiao v0.3 — mutation adequacy + PR comment + gate (docs.md §6)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HARD="$ROOT/demo/hard"

rm -rf "$HARD/.xiao/flags.jsonl" "$HARD/.xiao/verdict.json" "$HARD/.xiao/regression.jsonl" "$HARD"/**/__pycache__
echo '{"tool_name":"Bash","tool_input":{"command":"rg x src/"},"cwd":"'"$HARD"'"}' | node "$ROOT/hooks/hacking-detector.js" >/dev/null

echo "=== Stop verdict (v0.3) ==="
echo '{"cwd":"'"$HARD"'"}' | node "$ROOT/hooks/stop-judge.js" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const j=JSON.parse(d);
  console.log(j.hookSpecificOutput.additionalContext);
  if(j.decision==='block') console.log('GATE: block (expected on weak tests + gap)');
})"

echo ""
echo "=== §6 signals ==="
node -e "
const r=JSON.parse(require('fs').readFileSync('$HARD/.xiao/verdict.json','utf8'));
for (const k of ['hacking_flags','reward_hacking_gap','test_adequacy','blinded_verdict','gate_block']) {
  console.log(' ', k+':', r[k]);
}
if (r.reward_hacking_gap===null || r.test_adequacy===null) process.exit(1);
"

echo ""
echo "=== PR comment preview ==="
head -15 "$HARD/.xiao/pr-comment.md"

echo ""
node "$ROOT/hooks/mutation.js" --check && echo "mutation: ok"
echo "=== v0.3 PASS ==="