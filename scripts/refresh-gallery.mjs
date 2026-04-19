#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const DRIVE_URL = 'https://drive.google.com/drive/folders/1cblA30dbqX0gPDyfssF6sULoxKyYlWh8?usp=sharing';
const GALLERY_DIR = 'public/assets/images/gallery';
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);
const REPO_ROOT = process.cwd();

function die(msg) {
  throw new Error(msg);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) die(`${cmd} ${args.join(' ')} exited with ${res.status}`);
}

function ensureGdownAvailable() {
  const res = spawnSync('pipx', ['--version'], { stdio: 'ignore' });
  if (res.status !== 0) {
    die('pipx not found. Install with: brew install pipx && pipx ensurepath');
  }
}

async function downloadDriveFolder(dest) {
  ensureGdownAvailable();
  console.log(`refresh-gallery: downloading to ${dest}`);
  run('pipx', ['run', 'gdown', '--folder', DRIVE_URL, '-O', dest]);
}

function filterImages(files) {
  return files.filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
}

function assignSlots(imageFiles) {
  const numbered = [];
  const unnumbered = [];
  for (const f of imageFiles) {
    const base = path.basename(f);
    const m = base.match(/^0*(\d+)/);
    if (m) numbered.push({ slot: Number(m[1]), src: f });
    else unnumbered.push(f);
  }

  const seen = new Map();
  for (const { slot, src } of numbered) {
    if (seen.has(slot)) {
      die(
        `two files claim slot ${slot}: ` +
          `${path.basename(seen.get(slot))} and ${path.basename(src)}`,
      );
    }
    seen.set(slot, src);
  }

  numbered.sort((a, b) => a.slot - b.slot);
  unnumbered.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  let next = numbered.length ? Math.max(...numbered.map((n) => n.slot)) + 1 : 1;
  const appended = unnumbered.map((src) => ({ slot: next++, src }));

  return [...numbered, ...appended];
}

async function swapStagedIntoGallery(stageDir) {
  const galleryDir = path.join(REPO_ROOT, GALLERY_DIR);
  const parent = path.dirname(galleryDir);
  const oldDir = path.join(parent, 'gallery-old');
  await rm(oldDir, { recursive: true, force: true });
  await rename(galleryDir, oldDir);
  try {
    await rename(stageDir, galleryDir);
  } catch (err) {
    // Roll back: move the original gallery back into place.
    await rename(oldDir, galleryDir);
    throw err;
  }
  await rm(oldDir, { recursive: true, force: true });
  const staged = await readdir(galleryDir);
  for (const name of staged) {
    console.log(`  wrote ${path.relative(REPO_ROOT, path.join(galleryDir, name))}`);
  }
}

async function writeAssignments(assignments, destDir) {
  await mkdir(destDir, { recursive: true });
  for (const { slot, src } of assignments) {
    const out = path.join(destDir, `${String(slot).padStart(2, '0')}.webp`);
    await sharp(src)
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(out);
  }
}

function replaceBetweenSentinels(source, startTag, endTag, replacement, filePath) {
  const startIdx = source.indexOf(startTag);
  const endIdx = source.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    die(`sentinels ${startTag}/${endTag} not found or malformed in ${filePath}`);
  }
  const before = source.slice(0, startIdx + startTag.length);
  const after = source.slice(endIdx);
  return `${before}\n${replacement}\n${' '.repeat(indentOf(source, startIdx))}${after}`;
}

function indentOf(source, idx) {
  let i = idx - 1;
  while (i >= 0 && source[i] !== '\n') i--;
  let n = 0;
  for (let j = i + 1; j < idx; j++) {
    if (source[j] === ' ') n++;
    else break;
  }
  return n;
}

async function loadVariantsManifest() {
  const file = path.join(REPO_ROOT, 'public/assets/images/variants.json');
  const raw = await readFile(file, 'utf8');
  return JSON.parse(raw);
}

function pickVariantPath(slot, manifest, targetWidth) {
  const nn = String(slot).padStart(2, '0');
  const entry = manifest[`gallery/${nn}`];
  if (!entry) return `assets/images/gallery/${nn}.webp`;
  const candidates = [
    { width: entry.sourceWidth, path: entry.source },
    ...(entry.variants || []),
  ];
  const eligible = candidates.filter((c) => c.width <= targetWidth);
  const pool = eligible.length ? eligible : candidates;
  const best = pool.reduce((a, b) => (a.width >= b.width ? a : b));
  return best.path;
}

function renderGalleryTiles(assignments, manifest, indent) {
  const pad = ' '.repeat(indent);
  const lines = [`${pad}<div class="photo-grid">`];
  for (const { slot } of assignments) {
    const url = '../' + pickVariantPath(slot, manifest, 800);
    lines.push(
      `${pad}  <div`,
      `${pad}    class="photo-grid__item"`,
      `${pad}    role="img"`,
      `${pad}    aria-label="Nurse Your Nails gallery photo ${slot}"`,
      `${pad}    style="background-image: url(&quot;${url}&quot;)"`,
      `${pad}  ></div>`,
    );
  }
  lines.push(`${pad}</div>`);
  return lines.join('\n');
}

async function rewriteGalleryPage(assignments, manifest) {
  const file = path.join(REPO_ROOT, 'src/gallery/index.html');
  const src = await readFile(file, 'utf8');
  const start = '<!-- gallery:tiles:start -->';
  const end = '<!-- gallery:tiles:end -->';
  const startIdx = src.indexOf(start);
  if (startIdx === -1) die(`${start} not found in ${file} — add sentinels first`);
  const indent = indentOf(src, startIdx);
  const rendered = renderGalleryTiles(assignments, manifest, indent + 2);
  const next = replaceBetweenSentinels(src, start, end, rendered, file);
  await writeFile(file, next);
}

function renderHomePreview(assignments, manifest, indent) {
  const pad = ' '.repeat(indent);
  const imgTile = (n, flex) => {
    const url = pickVariantPath(n, manifest, 800);
    return [
      `${pad}<div`,
      `${pad}  class="photo-card card-images h-full"`,
      `${pad}  role="img"`,
      `${pad}  aria-label="Nurse Your Nails gallery photo ${n}"`,
      `${pad}  style="`,
      `${pad}    background-image: url(&quot;${url}&quot;);`,
      `${pad}    background-size: cover;`,
      `${pad}    background-position: center center;`,
      `${pad}    flex: ${flex} 1 0%;`,
      `${pad}    height: 200px;`,
      `${pad}  "`,
      `${pad}></div>`,
    ].join('\n');
  };

  const more = assignments.length - 3;
  const [a, b, c, d] = assignments.map((x) => x.slot);
  const overlayUrl = pickVariantPath(d, manifest, 800);
  const overlayTile = `${pad}<div
${pad}  class="photo-card"
${pad}  style="
${pad}    background-image: url(&quot;${overlayUrl}&quot;);
${pad}    background-size: cover;
${pad}    background-position: center center;
${pad}    flex: 0.66 1 0%;
${pad}    height: 200px;
${pad}    position: relative;
${pad}    cursor: pointer;
${pad}  "
${pad}>
${pad}  <a href="gallery/" style="display: block; width: 100%; height: 100%"
${pad}    ><div
${pad}      style="
${pad}        background: rgba(0, 0, 0, 0.4);
${pad}        color: white;
${pad}        position: absolute;
${pad}        top: 0;
${pad}        left: 0;
${pad}        width: 100%;
${pad}        height: 100%;
${pad}        display: flex;
${pad}        align-items: center;
${pad}        justify-content: center;
${pad}        text-align: center;
${pad}      "
${pad}    >
${pad}      + ${more} more
${pad}    </div></a
${pad}  >
${pad}</div>`;

  return [imgTile(a, '1'), imgTile(b, '1'), imgTile(c, '1'), overlayTile].join('\n');
}

async function rewriteHomePreview(assignments, manifest) {
  const file = path.join(REPO_ROOT, 'src/index.html');
  const src = await readFile(file, 'utf8');
  const start = '<!-- gallery:home-preview:start -->';
  const end = '<!-- gallery:home-preview:end -->';
  const startIdx = src.indexOf(start);
  if (startIdx === -1) die(`${start} not found in ${file} — add sentinels first`);
  const indent = indentOf(src, startIdx);
  const rendered = renderHomePreview(assignments, manifest, indent);
  const next = replaceBetweenSentinels(src, start, end, rendered, file);
  await writeFile(file, next);
}

async function main() {
  console.log('refresh-gallery: starting');
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'refresh-gallery-'));
  try {
    await downloadDriveFolder(tmpDir);
    const entries = await readdir(tmpDir, { recursive: true, withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => path.join(e.parentPath ?? tmpDir, e.name));
    const images = filterImages(files);
    if (images.length === 0) die('no image files found in Drive folder');
    if (images.length < 4) die(`need at least 4 images, got ${images.length}`);
    const assignments = assignSlots(images);
    console.log(`refresh-gallery: assigned ${assignments.length} slots`);
    for (const { slot, src } of assignments) {
      console.log(`  ${String(slot).padStart(2, '0')} <- ${path.basename(src)}`);
    }
    const stageDir = path.join(REPO_ROOT, 'public/assets/images/gallery-new');
    await rm(stageDir, { recursive: true, force: true });
    let swapped = false;
    try {
      await writeAssignments(assignments, stageDir);
      await swapStagedIntoGallery(stageDir);
      swapped = true;
    } finally {
      if (!swapped) await rm(stageDir, { recursive: true, force: true });
    }
    console.log('refresh-gallery: running optimize');
    run('npm', ['run', 'optimize']);
    const manifest = await loadVariantsManifest();
    await rewriteGalleryPage(assignments, manifest);
    await rewriteHomePreview(assignments, manifest);
    console.log('refresh-gallery: running wrap-pictures');
    run('node', ['scripts/wrap-pictures.mjs']);
    console.log('refresh-gallery: running build');
    run('npm', ['run', 'build']);
    console.log('refresh-gallery: committing');
    run('git', [
      'add',
      '--',
      'public/assets/images/gallery',
      'public/assets/images/variants.json',
      'src/gallery/index.html',
      'src/index.html',
      'public/gallery/index.html',
      'public/index.html',
    ]);
    run('git', ['commit', '-m', 'Update gallery']);
    console.log('refresh-gallery: done');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`refresh-gallery: ${err.message || String(err)}`);
  process.exit(1);
});
