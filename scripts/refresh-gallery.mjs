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

async function main() {
  console.log('refresh-gallery: starting');
  const tmpDir = await downloadDriveFolder();
  const entries = await readdir(tmpDir, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => path.join(e.parentPath ?? tmpDir, e.name));
  console.log(`refresh-gallery: downloaded ${files.length} file(s)`);
  for (const f of files) console.log(`  ${path.relative(tmpDir, f)}`);
}

main().catch((err) => die(err.stack || String(err)));
