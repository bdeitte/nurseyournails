import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const IMAGE_DIR = 'public/assets/images';
const SIZE_THRESHOLD = 50 * 1024;
const MIN_SAVINGS_RATIO = 0.10;
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.webp', '.png']);

async function optimizeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!EXTENSIONS.has(ext)) return 0;

  const originalBuf = await readFile(filePath);
  const originalSize = originalBuf.length;
  if (originalSize < SIZE_THRESHOLD) return 0;

  let optimized;
  if (ext === '.jpg' || ext === '.jpeg') {
    optimized = await sharp(originalBuf).jpeg({ quality: 80 }).toBuffer();
  } else if (ext === '.webp') {
    optimized = await sharp(originalBuf).webp({ quality: 80 }).toBuffer();
  } else if (ext === '.png') {
    optimized = await sharp(originalBuf).png({ compressionLevel: 9 }).toBuffer();
  }

  if (optimized.length > originalSize * (1 - MIN_SAVINGS_RATIO)) return 0;

  await writeFile(filePath, optimized);
  const saved = originalSize - optimized.length;
  console.log(
    `  ${filePath}: ${(originalSize / 1024).toFixed(0)}KB → ${(optimized.length / 1024).toFixed(0)}KB`,
  );
  return saved;
}

async function main() {
  console.log(`Optimizing images in ${IMAGE_DIR}...`);
  let totalSaved = 0;
  const entries = await readdir(IMAGE_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(IMAGE_DIR, entry.name);
    try {
      totalSaved += await optimizeFile(filePath);
    } catch (err) {
      console.warn(`  WARN: Failed to optimize ${filePath}: ${err.message}`);
    }
  }
  console.log(`Total saved: ${(totalSaved / 1024).toFixed(0)}KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
