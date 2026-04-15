#!/usr/bin/env node
// Throwaway migration script — deleted after rename migration completes.
// Applies scripts/rename-map.json to every HTML and CSS file under src/.
//
// Safety notes:
// - Renames are sorted by key length descending so --theme-color-10 is
//   rewritten before --theme-color-1 (the shorter key is a prefix of the
//   longer one, so longest-match-first avoids partial rewrites).
// - Scope IDs are 32-char hex hashes with no substring risk, so a naive
//   global string replace is safe. They appear as `#<id>` in CSS and
//   `id="<id>"` in HTML — both contexts rewrite correctly because the
//   bare ID is what gets replaced.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const MAP = path.join(ROOT, 'scripts/rename-map.json');

const FILES = [
  'assets/css/site.css',
  'index.html',
  'about-me/index.html',
  'foot-care/index.html',
  'gallery/index.html',
  'manicures/index.html',
  'my-business/index.html',
  'new-client-special/index.html',
  'price-list/index.html',
  'products/index.html',
  'reviews/index.html',
];

const map = JSON.parse(await fs.readFile(MAP, 'utf8'));

// Sort by key length descending. --theme-color-10 (16 chars) must be
// processed before --theme-color-1 (15 chars).
const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);

function replaceAll(text, from, to) {
  if (!text.includes(from)) return { text, count: 0 };
  const parts = text.split(from);
  return { text: parts.join(to), count: parts.length - 1 };
}

const totals = {};
for (const rel of FILES) {
  const p = path.join(SRC, rel);
  let text = await fs.readFile(p, 'utf8');
  let fileTotal = 0;
  for (const [from, to] of entries) {
    const { text: next, count } = replaceAll(text, from, to);
    if (count) {
      text = next;
      fileTotal += count;
      totals[from] = (totals[from] ?? 0) + count;
    }
  }
  await fs.writeFile(p, text);
  console.log(`  ${fileTotal.toString().padStart(5)}  ${rel}`);
}

const unused = entries.filter(([k]) => !(k in totals));
console.log(`\nApplied ${Object.values(totals).reduce((a, b) => a + b, 0)} replacements across ${entries.length} rename entries.`);
if (unused.length) {
  console.log(`\nWARNING: ${unused.length} rename entries had no matches:`);
  for (const [k, v] of unused) console.log(`  ${k} → ${v}`);
}
