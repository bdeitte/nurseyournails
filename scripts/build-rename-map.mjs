#!/usr/bin/env node
// Throwaway migration script — deleted after rename migration completes.
// Scans src/ for builder-generated identifiers and emits scripts/rename-map.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'scripts/rename-map.json');

const PAGES = [
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

const ID_RE = /#vZa[a-f0-9]+/g;
const CLASS_RE = /\.vwb-[a-z0-9_-]+/g;
const VAR_RE = /--vwb-[a-z0-9_-]+/g;
const HTML_ID_RE = /\bid="(vZa[a-f0-9]+)"/g;
const HTML_CLASS_RE = /class="([^"]*)"/g;

const collected = new Set();

function scan(text) {
  for (const m of text.matchAll(ID_RE)) collected.add(m[0]);
  for (const m of text.matchAll(CLASS_RE)) collected.add(m[0]);
  for (const m of text.matchAll(VAR_RE)) collected.add(m[0]);
  for (const m of text.matchAll(HTML_ID_RE)) collected.add('#' + m[1]);
  for (const m of text.matchAll(HTML_CLASS_RE)) {
    for (const tok of m[1].split(/\s+/)) {
      if (/^vwb-/.test(tok)) collected.add('.' + tok);
    }
  }
}

const css = await fs.readFile(path.join(SRC, 'assets/css/site.css'), 'utf8');
scan(css);
for (const rel of PAGES) {
  scan(await fs.readFile(path.join(SRC, rel), 'utf8'));
}

const sorted = [...collected].sort();
const map = {};
for (const name of sorted) map[name] = name; // identity mapping — fill in by hand
await fs.writeFile(OUT, JSON.stringify(map, null, 2) + '\n');
console.log(`Wrote ${sorted.length} identifiers to ${path.relative(ROOT, OUT)}`);
