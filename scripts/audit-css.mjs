#!/usr/bin/env node
import { PurgeCSS } from 'purgecss';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const CSS_FILE = path.join(PUBLIC, 'assets/css/site.css');
const REPORT = path.join(ROOT, 'css-audit-report.json');

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

const contentPaths = PAGES.map((p) => path.join(PUBLIC, p));
const rawCss = await fs.readFile(CSS_FILE, 'utf8');

const result = await new PurgeCSS().purge({
  content: contentPaths,
  css: [{ raw: rawCss }],
  rejected: true,
  safelist: {
    // classes toggled at runtime by the builder's JS — keep them even if no static HTML references them
    greedy: [/^show$/, /^active$/, /^open$/, /^dropdown/, /^mobile-navigation/, /^pswp/],
  },
});

const first = result[0];
const report = {
  generatedAt: new Date().toISOString(),
  cssFile: path.relative(ROOT, CSS_FILE),
  usedSelectorCount: (first.css.match(/[{,]/g) || []).length,
  rejectedSelectors: first.rejected || [],
  purgedCssLength: first.css.length,
  originalCssLength: rawCss.length,
};
await fs.writeFile(REPORT, JSON.stringify(report, null, 2));
console.log(`Audit written to ${path.relative(ROOT, REPORT)}`);
console.log(`Original CSS: ${rawCss.length} bytes`);
console.log(`Used CSS:     ${first.css.length} bytes`);
console.log(`Rejected selectors: ${(first.rejected || []).length}`);
