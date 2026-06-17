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

Alias: `/xiao`. State: `~/.claude/.verdict-active`. Artifacts: `.verdict/` in the project.

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

Legacy env: `XIAO_*` still works; prefer `VERDICT_*`.