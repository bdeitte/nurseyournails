#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle, browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';
import { minify as minifyHtml } from 'html-minifier-terser';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'public');

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

const MINIFY_OPTS = {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
  removeRedundantAttributes: true,
  sortAttributes: true,
  sortClassName: true,
};

async function cleanPublicHtmlAndCss() {
  for (const rel of PAGES) {
    const p = path.join(OUT, rel);
    await fs.rm(p, { force: true });
  }
  await fs.rm(path.join(OUT, 'assets/css/site.css'), { force: true });
}

async function buildCss() {
  const srcCss = path.join(SRC, 'assets/css/site.css');
  const outCss = path.join(OUT, 'assets/css/site.css');
  await fs.mkdir(path.dirname(outCss), { recursive: true });
  const { code } = bundle({
    filename: srcCss,
    minify: true,
    targets: browserslistToTargets(browserslist('>= 0.25%')),
  });
  await fs.writeFile(outCss, code);
}

async function buildHtml() {
  for (const rel of PAGES) {
    const srcFile = path.join(SRC, rel);
    const outFile = path.join(OUT, rel);
    const source = await fs.readFile(srcFile, 'utf8');
    const minified = await minifyHtml(source, MINIFY_OPTS);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, minified);
  }
}

async function copyStatic() {
  for (const name of ['robots.txt', 'sitemap.xml']) {
    await fs.copyFile(path.join(SRC, name), path.join(OUT, name));
  }
}

async function sanityCheck() {
  for (const rel of PAGES) {
    const stat = await fs.stat(path.join(OUT, rel));
    if (stat.size === 0) throw new Error(`empty output: ${rel}`);
  }
  const imgDir = path.join(OUT, 'assets/images');
  const entries = await fs.readdir(imgDir);
  if (entries.length === 0) throw new Error(`public/assets/images is empty — aborting`);
}

await cleanPublicHtmlAndCss();
await buildCss();
await buildHtml();
await copyStatic();
await sanityCheck();
console.log(`Built ${PAGES.length} pages + site.css + static files`);
