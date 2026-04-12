#!/usr/bin/env node
// Removes whitespace-only lines and trailing whitespace from HTML files.
// Safe: none of the pages contain <pre>/<textarea>/<code>, and any
// `white-space: pre-line` elements are already on a single line.

import { readFileSync, writeFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: clean-whitespace.mjs <file> [...]');
  process.exit(1);
}

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const cleaned = before
    .split('\n')
    .map(line => line.replace(/[ \t]+$/, ''))
    .filter(line => line.length > 0)
    .join('\n') + '\n';
  writeFileSync(file, cleaned);
  const beforeLines = before.split('\n').length;
  const afterLines = cleaned.split('\n').length;
  console.log(`${file}: ${beforeLines} -> ${afterLines} lines`);
}
