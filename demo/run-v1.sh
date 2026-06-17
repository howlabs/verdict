#!/usr/bin/env bash
# xiao v1 — taxonomy + judge + regression moat (docs.md §7 v1)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HARD="$ROOT/demo/hard"

rm -rf "$HARD"/**/__pycache__ "$HARD/.xiao/flags.jsonl" "$HARD/.xiao/verdict.json" "$HARD/.xiao/regression.jsonl"
echo '{"tool_name":"Bash","tool_input":{"command":"rg x src/"},"cwd":"'"$HARD"'"}' | node "$ROOT/hooks/hacking-detector.js" >/dev/null

echo "=== v1 Stop pipeline ==="
echo '{"cwd":"'"$HARD"'"}' | node "$ROOT/hooks/stop-judge.js" | grep -q "taxonomy" && echo "  ✓ stop"

node -e "
const v=require('$HARD/.xiao/verdict.json');
const need=['taxonomy','judge_score','judge_feedback','sub_questions','gate_block'];
for (const k of need) if(v[k]===undefined) { console.error('missing',k); process.exit(1); }
console.log('  judge_score:', v.judge_score);
console.log('  taxonomy:', v.taxonomy.primary);
console.log('  tags:', v.taxonomy.tags.join(','));
console.log('  feedback:', v.judge_feedback.slice(0,80)+'...');
"

echo "=== regression moat ==="
test -f "$HARD/.xiao/regression.jsonl" && echo "  ✓ local regression.jsonl"
node "$ROOT/hooks/regression-summary.js" "$HARD" | node -e "
let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
  const s=JSON.parse(d); if(s.runs<1) process.exit(1); console.log('  runs:', s.runs);
})"

node "$ROOT/hooks/judge.js" --check && echo "  ✓ judge unit"
echo "=== v1 PASS ==="