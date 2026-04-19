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

async function main() {
  console.log('refresh-gallery: starting');
  // Steps filled in by later tasks.
}

main().catch((err) => die(err.stack || String(err)));
