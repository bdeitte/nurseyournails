#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

async function clearGalleryDir() {
  const dir = path.join(REPO_ROOT, GALLERY_DIR);
  const names = await readdir(dir);
  for (const name of names) {
    await rm(path.join(dir, name), { force: true });
  }
}

async function writeAssignments(assignments) {
  const dir = path.join(REPO_ROOT, GALLERY_DIR);
  for (const { slot, src } of assignments) {
    const out = path.join(dir, `${String(slot).padStart(2, '0')}.webp`);
    await sharp(src).webp({ quality: 80 }).toFile(out);
    console.log(`  wrote ${path.relative(REPO_ROOT, out)}`);
  }
}

async function main() {
  console.log('refresh-gallery: starting');
  const tmpDir = await downloadDriveFolder();
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
  await clearGalleryDir();
  await writeAssignments(assignments);
  console.log('refresh-gallery: running optimize');
  run('npm', ['run', 'optimize']);
  console.log('refresh-gallery: running wrap-pictures');
  run('node', ['scripts/wrap-pictures.mjs']);
}

main().catch((err) => die(err.stack || String(err)));
