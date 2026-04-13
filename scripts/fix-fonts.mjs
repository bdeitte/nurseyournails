import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'fs/promises';
import path from 'path';

const OLD = '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Archivo+Narrow"><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Alata">';

const NEW = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Alata&family=Archivo+Narrow&display=swap" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alata&family=Archivo+Narrow&display=swap"></noscript>';

const files = [
  'public/index.html',
  'public/new-client-special/index.html',
  'public/products/index.html',
  'public/gallery/index.html',
  'public/foot-care/index.html',
  'public/price-list/index.html',
  'public/about-me/index.html',
  'public/manicures/index.html',
  'public/my-business/index.html',
  'public/reviews/index.html',
];

let changed = 0;
for (const rel of files) {
  const abs = path.resolve('/Users/briandeitte/nurseyournails', rel);
  const content = readFileSync(abs, 'utf8');
  if (!content.includes(OLD)) {
    console.error(`MISSING pattern in ${rel}`);
    process.exit(1);
  }
  const updated = content.replace(OLD, NEW);
  writeFileSync(abs, updated, 'utf8');
  console.log(`Updated: ${rel}`);
  changed++;
}
console.log(`\nDone. ${changed} files updated.`);
