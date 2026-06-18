# verdict

Judgment layer for Claude Code. CI merges when visible tests pass — verdict checks whether that means anything.

## Install

```bash
claude plugin install .
```

Or add this repo to a Claude Code marketplace (`/.claude-plugin/marketplace.json`).

## Use

| Command | Effect |
|---------|--------|
| `/verdict on` | Pre + Post + Stop gate |
| `/verdict lite` | PostToolUse flags only |
| `/verdict off` | Disabled |

State: `~/.claude/.verdict-active`. Artifacts: `.verdict/` in the project.

Optional gate policy: `verdict.gate.json` (`suite_adequacy`: `required` or `advisory`).

## Verify plugin

```bash
npm test
```

## Reports

```bash
node hooks/report.js . --ci
node hooks/report.js . --pr
node hooks/plugin-compare.js .
```

## Requirements

- **Python 3.9+** for `.py` mutation (`ast.unparse` in `hooks/mutation-ast.py`)
- **Node.js** for hooks and JS/TS token mutation

## Held-out and mutation tiers

| Tier | Held-out | Mutation |
|------|----------|----------|
| **Default** | Rule-based: spec bullets → keyword-presence pytest in `.verdict/held-out/` | Python: stdlib AST; JS/TS: token-scan (skips strings, comments, regex literals) |
| **Recommended** | Set `VERDICT_LLM=1` — `claude -p` generates behavioral held-out tests from spec | — |

Rule-based held-out checks that keywords from the spec appear in source — not full behavior. A weak visible suite can still pass held-out while mutants survive. Use LLM held-out when you need behavioral coverage without hand-writing tests.