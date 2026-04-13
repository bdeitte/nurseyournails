#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const MANIFEST = JSON.parse(
  await fs.readFile(path.join(PUBLIC, 'assets/images/variants.json'), 'utf8'),
);

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

const IMG_RE = /<img\b[^>]*\bsrc="(\.\.\/)?assets\/images\/([^"]+)"[^>]*>/g;

function buildPicture(wholeTag, prefix, filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const entry = MANIFEST[base];
  if (!entry) return wholeTag;

  const srcset = entry.variants
    .map((v) => `${prefix || ''}${v.path} ${v.width}w`)
    .join(', ');

  return `<picture><source type="image/webp" srcset="${srcset}" sizes="100vw">${wholeTag}</picture>`;
}

let totalWraps = 0;
for (const rel of PAGES) {
  const file = path.join(PUBLIC, rel);
  let html = await fs.readFile(file, 'utf8');
  let wrapsInFile = 0;

  html = html.replace(IMG_RE, (match, prefix, filename, offset, full) => {
    const lastOpen = full.lastIndexOf('<picture', offset);
    const lastClose = full.lastIndexOf('</picture>', offset);
    if (lastOpen > lastClose) return match;
    if (filename.startsWith('f55b6d7ad9')) return match;

    const wrapped = buildPicture(match, prefix, filename);
    if (wrapped !== match) wrapsInFile++;
    return wrapped;
  });

  if (wrapsInFile) {
    await fs.writeFile(file, html);
    console.log(`${rel}: wrapped ${wrapsInFile} img(s)`);
    totalWraps += wrapsInFile;
  }
}

console.log(`Total: ${totalWraps} imgs wrapped`);
