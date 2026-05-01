#!/usr/bin/env node
// One-shot: rewrite HTML image references from old hashed filenames to new
// nested paths under public/assets/images/, per docs/superpowers/plans/asset-rename-manifest.md.
// Also strips dead --image-2 / --image-4 CSS custom property declarations.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifestPath = path.join(repoRoot, 'docs/superpowers/plans/asset-rename-manifest.md');
const pages = [
  'public/index.html',
  'public/about-me/index.html',
  'public/foot-care/index.html',
  'public/gallery/index.html',
  'public/manicures/index.html',
  'public/my-business/index.html',
  'public/products/index.html',
  'public/reviews/index.html',
];

// Hashes that must be stripped, not rewritten.
const DELETE_HASHES = new Set(['91dc85305c', '2caf406982']);

function parseManifest(md) {
  const map = new Map();
  // Table rows look like: | hash | ext | new path | notes |
  // We want hash -> new path. Skip the Delete section (no new path column).
  const lines = md.split('\n');
  let section = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(.*)$/);
    if (h) {
      section = h[1].trim();
      continue;
    }
    if (!line.startsWith('|')) continue;
    // Skip header separator
    if (/^\|\s*-/.test(line)) continue;
    // Skip the Delete section, which has 3 data columns not 4
    if (section && section.startsWith('Delete')) continue;
    const cells = line.split('|').map((c) => c.trim());
    // Expect: [empty, hash, ext, newpath, notes, empty]
    if (cells.length < 5) continue;
    const hash = cells[1];
    const newPath = cells[3];
    if (!/^[a-f0-9]{10}$/.test(hash)) continue;
    if (!newPath || newPath.startsWith('old') || newPath === 'new path') continue;
    map.set(hash, newPath);
  }
  return map;
}

function stripExt(p) {
  const i = p.lastIndexOf('.');
  return i === -1 ? p : p.slice(0, i);
}

function extOf(p) {
  const i = p.lastIndexOf('.');
  return i === -1 ? '' : p.slice(i + 1).toLowerCase();
}

function rewrite(html, map, errors, file) {
  let variantCount = 0;
  let sourceCount = 0;
  let strippedDecls = 0;

  // Variants first: assets/images/<hash>-<w>.webp
  html = html.replace(/assets\/images\/([a-f0-9]{10})-(400|800|1200)\.webp/g, (m, hash, w) => {
    if (DELETE_HASHES.has(hash)) {
      errors.push(`${file}: variant ref to delete-list hash ${hash}`);
      return m;
    }
    const newPath = map.get(hash);
    if (!newPath) {
      errors.push(`${file}: variant ref to unknown hash ${hash}`);
      return m;
    }
    variantCount++;
    return `assets/images/${stripExt(newPath)}-${w}.webp`;
  });

  // Sources: assets/images/<hash>.<ext>
  html = html.replace(/assets\/images\/([a-f0-9]{10})\.(jpg|jpeg|png|webp)/g, (m, hash, ext) => {
    if (DELETE_HASHES.has(hash)) {
      // These should only appear inside --image-2/--image-4 decls; we'll strip those next.
      // Leave the text alone here so the strip step can match it.
      return m;
    }
    const newPath = map.get(hash);
    if (!newPath) {
      errors.push(`${file}: source ref to unknown hash ${hash}`);
      return m;
    }
    if (extOf(newPath) !== ext.toLowerCase()) {
      errors.push(`${file}: ext mismatch for ${hash}: ${ext} vs ${newPath}`);
      return m;
    }
    sourceCount++;
    return `assets/images/${newPath}`;
  });

  // Strip --image-2 and --image-4 decls (whole declarations incl. trailing ;).
  const beforeStrip = html;
  html = html.replace(/\s*--image-2:\s*url\([^)]*\);?/g, () => {
    strippedDecls++;
    return '';
  });
  html = html.replace(/\s*--image-4:\s*url\([^)]*\);?/g, () => {
    strippedDecls++;
    return '';
  });

  return { html, variantCount, sourceCount, strippedDecls };
}

function main() {
  const md = fs.readFileSync(manifestPath, 'utf8');
  const map = parseManifest(md);
  // Sanity: ensure delete hashes not in map
  for (const h of DELETE_HASHES) {
    if (map.has(h)) {
      console.error(`Manifest parse error: delete hash ${h} ended up in map`);
      process.exit(1);
    }
  }
  console.log(`Parsed ${map.size} hash -> newpath entries from manifest`);

  const errors = [];
  const staged = [];
  let totalVar = 0;
  let totalSrc = 0;
  let totalStripped = 0;

  for (const rel of pages) {
    const abs = path.join(repoRoot, rel);
    const orig = fs.readFileSync(abs, 'utf8');
    const { html, variantCount, sourceCount, strippedDecls } = rewrite(orig, map, errors, rel);
    staged.push({ abs, html });
    totalVar += variantCount;
    totalSrc += sourceCount;
    totalStripped += strippedDecls;
    console.log(`${rel}: ${sourceCount} source replacements, ${variantCount} variant replacements, ${strippedDecls} --image- declarations stripped`);
  }

  if (errors.length) {
    console.error('\nERRORS (no files written):');
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }

  for (const { abs, html } of staged) {
    fs.writeFileSync(abs, html);
  }
  console.log(`\nTotal: ${totalSrc} source, ${totalVar} variant, ${totalStripped} stripped decls`);
}

main();
