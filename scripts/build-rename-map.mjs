#!/usr/bin/env node
// Throwaway migration script — deleted after rename migration completes.
// Scans src/ for builder-generated identifiers and emits scripts/rename-map.json
// with proposed semantic names.
//
// Scope:
// 1. Scope IDs matching /v[A-Za-z][a-f0-9]{10,}/ — builder-generated DOM IDs
//    and the CSS selectors that target them. Renamed to <page>-s<NN> in
//    document order, except the cross-page page wrapper which becomes
//    `page-wrapper`.
// 2. Custom properties matching /--theme-color-\d+/ — the 10-slot theme
//    palette. Renamed to semantic names based on their hex values.
//
// Utility classes like .vwb-* are intentionally NOT renamed: they're
// isolated inside each page's inline <style> block and context is local.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'scripts/rename-map.json');

const PAGES = [
  { rel: 'index.html', slug: 'home' },
  { rel: 'about-me/index.html', slug: 'about-me' },
  { rel: 'foot-care/index.html', slug: 'foot-care' },
  { rel: 'gallery/index.html', slug: 'gallery' },
  { rel: 'manicures/index.html', slug: 'manicures' },
  { rel: 'my-business/index.html', slug: 'my-business' },
  { rel: 'new-client-special/index.html', slug: 'new-client-special' },
  { rel: 'price-list/index.html', slug: 'price-list' },
  { rel: 'products/index.html', slug: 'products' },
  { rel: 'reviews/index.html', slug: 'reviews' },
];

const PAGE_WRAPPER_ID = 'vZa50e4ddb495f46f9ebda28b1faa18b8';

// Matches v + [A-Za-z] + hex. Length ≥ 11 to avoid matching short builder
// tokens; real builder IDs are 32-char hashes.
const ID_RE = /v[A-Za-z][a-f0-9]{10,}/g;
// Matches --theme-color-N where N is a positive integer.
const THEME_VAR_RE = /--theme-color-(\d+)/g;

// Hex → semantic name. Values discovered by reading src/index.html root vars.
const THEME_COLOR_NAMES = {
  1: 'color-black',       // #000000
  2: 'color-navy',        // #1e184a
  3: 'color-gray',        // #969696
  4: 'color-slate',       // #59779d
  5: 'color-gold',        // #cfa24a
  6: 'color-white',       // #FFFFFF
  7: 'color-gray-light',  // #D5D5D5
  8: 'color-gray-medium', // #868686
  9: 'color-gray-dark',   // #464646
  10: 'color-black',      // #000000 (duplicate of 1, collapses to same name)
};

const map = {};

// --- Pass 1: read every page, record per-page ordered IDs and a count of
// how many pages each ID appears in.
const pageIds = new Map(); // slug -> ordered unique IDs
const pageCount = new Map(); // id -> number of pages it appears in
for (const { rel, slug } of PAGES) {
  const text = await fs.readFile(path.join(SRC, rel), 'utf8');
  const seen = new Set();
  const ordered = [];
  for (const m of text.matchAll(ID_RE)) {
    if (!seen.has(m[0])) {
      seen.add(m[0]);
      ordered.push(m[0]);
    }
  }
  pageIds.set(slug, ordered);
  for (const id of seen) pageCount.set(id, (pageCount.get(id) ?? 0) + 1);
}

// --- Pass 2: IDs appearing on ≥ 2 pages are shared chrome (nav, footer,
// CTA). Assign them shared-sNN names in the order they're first seen in
// the home page. IDs appearing on exactly 1 page get <slug>-sNN names in
// that page's document order.
const sharedIds = [];
const firstSeen = new Map();
for (const { slug } of PAGES) {
  for (const id of pageIds.get(slug)) {
    if (!firstSeen.has(id)) firstSeen.set(id, slug);
  }
}
for (const [id, count] of pageCount) {
  if (count >= 2) sharedIds.push(id);
}
// Preserve home-page document order for shared IDs where possible; fall
// back to first-seen page order for the rest.
const homeOrder = new Map();
pageIds.get('home').forEach((id, i) => homeOrder.set(id, i));
sharedIds.sort((a, b) => {
  const ai = homeOrder.has(a) ? homeOrder.get(a) : Infinity;
  const bi = homeOrder.has(b) ? homeOrder.get(b) : Infinity;
  return ai - bi;
});
let sharedN = 1;
for (const id of sharedIds) {
  if (id === PAGE_WRAPPER_ID) {
    map[id] = 'page-wrapper';
    continue;
  }
  const nn = String(sharedN).padStart(2, '0');
  map[id] = `shared-s${nn}`;
  sharedN++;
}

for (const { slug } of PAGES) {
  let n = 1;
  for (const id of pageIds.get(slug)) {
    if (map[id]) continue; // already named (shared or page-wrapper)
    const nn = String(n).padStart(2, '0');
    map[id] = `${slug}-s${nn}`;
    n++;
  }
}

// --- Theme color vars: scan src/ CSS + all pages' inline <style> blocks.
const themeVars = new Set();
const filesToScan = [
  path.join(SRC, 'assets/css/site.css'),
  ...PAGES.map((p) => path.join(SRC, p.rel)),
];
for (const f of filesToScan) {
  const text = await fs.readFile(f, 'utf8');
  for (const m of text.matchAll(THEME_VAR_RE)) {
    themeVars.add(m[0]);
  }
}
for (const v of [...themeVars].sort()) {
  const n = parseInt(v.match(/\d+$/)[0], 10);
  const name = THEME_COLOR_NAMES[n];
  if (!name) throw new Error(`Unmapped theme color index: ${v}`);
  map[v] = `--${name}`;
}

// --- Emit the map.
const sorted = Object.keys(map).sort();
const out = {};
for (const k of sorted) out[k] = map[k];
await fs.writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

const idCount = sorted.filter((k) => !k.startsWith('--')).length;
const varCount = sorted.filter((k) => k.startsWith('--')).length;
console.log(`Wrote ${sorted.length} entries (${idCount} scope IDs, ${varCount} theme vars) to ${path.relative(ROOT, OUT)}`);
