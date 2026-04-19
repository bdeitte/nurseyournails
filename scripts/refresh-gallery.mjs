#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const DRIVE_URL = 'https://drive.google.com/drive/folders/1cblA30dbqX0gPDyfssF6sULoxKyYlWh8?usp=sharing';
const GALLERY_DIR = 'public/assets/images/gallery';
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic']);
const REPO_ROOT = process.cwd();

function die(msg) {
  console.error(`refresh-gallery: ${msg}`);
  process.exit(1);
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

async function downloadDriveFolder() {
  ensureGdownAvailable();
  const dest = await mkdtemp(path.join(tmpdir(), 'refresh-gallery-'));
  console.log(`refresh-gallery: downloading to ${dest}`);
  run('pipx', ['run', 'gdown', '--folder', DRIVE_URL, '-O', dest]);
  return dest;
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
  const existing = await readdir(galleryDir);
  for (const name of existing) {
    await rm(path.join(galleryDir, name), { force: true });
  }
  const staged = await readdir(stageDir);
  for (const name of staged) {
    const dest = path.join(galleryDir, name);
    await copyFile(path.join(stageDir, name), dest);
    console.log(`  wrote ${path.relative(REPO_ROOT, dest)}`);
  }
}

async function writeAssignments(assignments, destDir) {
  await mkdir(destDir, { recursive: true });
  for (const { slot, src } of assignments) {
    const out = path.join(destDir, `${String(slot).padStart(2, '0')}.webp`);
    await sharp(src).webp({ quality: 80 }).toFile(out);
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

function renderGalleryTiles(assignments, indent) {
  const pad = ' '.repeat(indent);
  const lines = [`${pad}<div class="photo-grid">`];
  for (const { slot } of assignments) {
    const nn = String(slot).padStart(2, '0');
    lines.push(
      `${pad}  <div`,
      `${pad}    class="photo-grid__item"`,
      `${pad}    role="img"`,
      `${pad}    aria-label="Nurse Your Nails gallery photo ${slot}"`,
      `${pad}    style="background-image: url(&quot;../assets/images/gallery/${nn}.webp&quot;)"`,
      `${pad}  ></div>`,
    );
  }
  lines.push(`${pad}</div>`);
  return lines.join('\n');
}

async function rewriteGalleryPage(assignments) {
  const file = path.join(REPO_ROOT, 'src/gallery/index.html');
  const src = await readFile(file, 'utf8');
  const start = '<!-- gallery:tiles:start -->';
  const end = '<!-- gallery:tiles:end -->';
  const startIdx = src.indexOf(start);
  if (startIdx === -1) die(`${start} not found in ${file} — add sentinels first`);
  const indent = indentOf(src, startIdx);
  const rendered = renderGalleryTiles(assignments, indent + 2);
  const next = replaceBetweenSentinels(src, start, end, rendered, file);
  await writeFile(file, next);
}

function renderHomePreview(total, indent) {
  const pad = ' '.repeat(indent);
  const imgTile = (n, flex) => {
    const nn = String(n).padStart(2, '0');
    return [
      `${pad}<div`,
      `${pad}  class="photo-card card-images h-full"`,
      `${pad}  role="img"`,
      `${pad}  aria-label="Nurse Your Nails gallery photo ${n}"`,
      `${pad}  style="`,
      `${pad}    background-image: url(&quot;assets/images/gallery/${nn}.webp&quot;);`,
      `${pad}    background-size: cover;`,
      `${pad}    background-position: center center;`,
      `${pad}    flex: ${flex} 1 0%;`,
      `${pad}    height: 200px;`,
      `${pad}  "`,
      `${pad}></div>`,
    ].join('\n');
  };

  const more = total - 3;
  const overlayTile = `${pad}<div
${pad}  class="photo-card"
${pad}  style="
${pad}    background-image: url(&quot;assets/images/gallery/04.webp&quot;);
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

  return [imgTile(1, '1'), imgTile(2, '1'), imgTile(3, '1'), overlayTile].join('\n');
}

async function rewriteHomePreview(total) {
  const file = path.join(REPO_ROOT, 'src/index.html');
  const src = await readFile(file, 'utf8');
  const start = '<!-- gallery:home-preview:start -->';
  const end = '<!-- gallery:home-preview:end -->';
  const startIdx = src.indexOf(start);
  if (startIdx === -1) die(`${start} not found in ${file} — add sentinels first`);
  const indent = indentOf(src, startIdx);
  const rendered = renderHomePreview(total, indent);
  const next = replaceBetweenSentinels(src, start, end, rendered, file);
  await writeFile(file, next);
}

async function main() {
  console.log('refresh-gallery: starting');
  const tmpDir = await downloadDriveFolder();
  try {
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
    const stageDir = path.join(tmpDir, '_staged');
    await writeAssignments(assignments, stageDir);
    await swapStagedIntoGallery(stageDir);
    await rewriteGalleryPage(assignments);
    await rewriteHomePreview(assignments.length);
    console.log('refresh-gallery: running optimize');
    run('npm', ['run', 'optimize']);
    console.log('refresh-gallery: running wrap-pictures');
    run('node', ['scripts/wrap-pictures.mjs']);
    console.log('refresh-gallery: running build');
    run('npm', ['run', 'build']);
    console.log('refresh-gallery: done');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => die(err.stack || String(err)));
