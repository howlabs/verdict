#!/usr/bin/env node
// xiao v1 — regression moat stats per repo

const { summarize } = require('./regression.js');

const cwd = process.argv[2] || process.cwd();
console.log(JSON.stringify(summarize(cwd), null, 2));