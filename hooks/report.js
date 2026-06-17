#!/usr/bin/env node
// xiao — CLI report from .xiao/flags.jsonl (docs.md §6)

const fs = require('fs');
const path = require('path');

const cwd = process.argv[2] || process.cwd();
const log = path.join(cwd, '.xiao', 'flags.jsonl');

if (!fs.existsSync(log)) {
  console.log(JSON.stringify({ hacking_flags: 0, flags: [] }, null, 2));
  process.exit(0);
}

const flags = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const byType = {};
for (const f of flags) byType[f.type] = (byType[f.type] || 0) + 1;

const report = {
  hacking_flags: flags.length,
  by_type: byType,
  flags,
};
console.log(JSON.stringify(report, null, 2));