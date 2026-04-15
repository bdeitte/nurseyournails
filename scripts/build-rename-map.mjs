#!/usr/bin/env node
// Throwaway migration script — deleted after rename migration completes.
// Scans src/ for builder-generated identifiers and emits scripts/rename-map.json
// with proposed semantic names.
//
// Scope:
// 1. Hash-like scope IDs. Any `id="..."` attribute whose value matches
//    /^[A-Za-z]{1,2}[a-f0-9]{30,32}$/ is a builder-generated scope ID.
//    This catches v-prefixed builder IDs (vZa..., vC..., vx...) AND the
//    v-page-root hash IDs that have no `v` prefix (d803ea1b..., Y8b0...,
//    pbe08..., Cb2a...). IDs are discovered from HTML attributes in body
//    DOM order after stripping <style> blocks; CSS selectors reference
//    these same IDs but inline <style> blocks appear before the body, so
//    scanning raw text would yield CSS-selector order instead of DOM
//    order. Renames:
//      - Cross-page chrome (present on ≥ 2 pages) → shared-sNN, with the
//        outer page wrapper getting the dedicated name `page-wrapper`.
//      - Page-local sections → <page-slug>-sNN in body DOM order.
// 2. Theme color custom properties /--theme-color-\d+/ → semantic names
//    based on hex values (--color-black, --color-navy, etc.).
//
// Utility classes (.vwb-*) are intentionally NOT renamed — they live
// inside each page's inline <style> block, so context is already local.
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

// Hash-like scope ID: 1-2 leading letters + 30-32 hex chars.
const HASH_ID_RE = /^[A-Za-z]{1,2}[a-f0-9]{30,32}$/;
const STYLE_BLOCK_RE = /<style[^>]*>[\s\S]*?<\/style>/g;
const HTML_ID_ATTR_RE = /\sid="([^"]+)"/g;
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

// --- Pass 1: collect IDs from each page's HTML body in DOM order.
const pageIds = new Map(); // slug -> ordered unique hash IDs (body order)
const pageCount = new Map(); // id -> number of pages it appears in
for (const { rel, slug } of PAGES) {
  const text = await fs.readFile(path.join(SRC, rel), 'utf8');
  // Strip inline <style> blocks so id attribute order reflects body DOM
  // order rather than CSS selector order.
  const body = text.replace(STYLE_BLOCK_RE, '');
  const seen = new Set();
  const ordered = [];
  for (const m of body.matchAll(HTML_ID_ATTR_RE)) {
    const id = m[1];
    if (!HASH_ID_RE.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  pageIds.set(slug, ordered);
  for (const id of seen) pageCount.set(id, (pageCount.get(id) ?? 0) + 1);
}

// --- Pass 2: IDs on ≥ 2 pages are shared chrome; IDs on exactly 1 page
// are section-local. Shared IDs are ordered by first appearance in home
// (preserving nav → footer DOM flow). Page-local IDs use per-page body
// order.
const homeOrder = new Map();
pageIds.get('home').forEach((id, i) => homeOrder.set(id, i));

const sharedIds = [];
for (const [id, count] of pageCount) {
  if (count >= 2) sharedIds.push(id);
}
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
