#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

const PAGES = [
  'index.html',
  'about-me/index.html',
  'foot-care/index.html',
  'gallery/index.html',
  'manicures/index.html',
  'my-business/index.html',
  'new-client-special/index.html',
  'products/index.html',
  'reviews/index.html',
];

const NAV_OPEN_RE = /<nav class="full-screen-navigation[^"]*"[^>]*>/;

let total = 0;
for (const rel of PAGES) {
  const file = path.join(SRC, rel);
  let html = await fs.readFile(file, 'utf8');

  const openMatch = html.match(NAV_OPEN_RE);
  if (!openMatch) continue;
  const openIdx = openMatch.index;
  const openEnd = openIdx + openMatch[0].length;
  const closeIdx = html.indexOf('</nav>', openEnd);
  if (closeIdx === -1) continue;

  const inner = html.slice(openEnd, closeIdx);
  if (inner.startsWith('<ul')) continue;

  const wrapped = `<ul class="nav-list">${inner}</ul>`;
  html = html.slice(0, openEnd) + wrapped + html.slice(closeIdx);
  await fs.writeFile(file, html);
  console.log(`${rel}: wrapped nav children in <ul>`);
  total++;
}
console.log(`Total: ${total} files updated`);
