import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
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

const VARIANT_WIDTHS = [400, 800, 1200];
const VARIANT_MIN_SOURCE_WIDTH = 400;

async function generateVariants(imagesDir) {
  const files = await readdir(imagesDir);
  const manifest = {};

  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
    if (/-\d+\.webp$/.test(name)) continue;

    const sourcePath = path.join(imagesDir, name);
    const sourceStat = await stat(sourcePath);
    const meta = await sharp(sourcePath).metadata();
    if (!meta.width || meta.width < VARIANT_MIN_SOURCE_WIDTH) continue;

    const baseHash = name.slice(0, -ext.length);
    const variants = [];

    for (const targetWidth of VARIANT_WIDTHS) {
      if (targetWidth > meta.width) continue;
      const outName = `${baseHash}-${targetWidth}.webp`;
      const outPath = path.join(imagesDir, outName);

      let shouldGenerate = true;
      try {
        const outStat = await stat(outPath);
        if (outStat.mtimeMs >= sourceStat.mtimeMs) shouldGenerate = false;
      } catch {
        // missing — generate
      }

      if (shouldGenerate) {
        await sharp(sourcePath)
          .resize({ width: targetWidth, withoutEnlargement: true })
          .webp({ quality: 80, effort: 4 })
          .toFile(outPath);
        console.log(`  variant ${outName}`);
      }

      variants.push({ width: targetWidth, path: `assets/images/${outName}` });
    }

    if (variants.length) {
      manifest[baseHash] = {
        source: `assets/images/${name}`,
        sourceWidth: meta.width,
        sourceHeight: meta.height,
        variants,
      };
    }
  }

  await writeFile(
    path.join(imagesDir, 'variants.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log(`Wrote variants.json (${Object.keys(manifest).length} entries)`);
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

  console.log('Generating responsive WebP variants...');
  await generateVariants(IMAGE_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
