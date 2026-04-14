import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

async function walkImages(dir, baseDir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkImages(full, baseDir)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;
      if (/-\d+\.webp$/.test(entry.name)) continue;
      const rel = path.relative(baseDir, full).split(path.sep).join('/');
      results.push({ full, rel });
    }
  }
  return results;
}

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
  const sources = (await walkImages(imagesDir, imagesDir)).sort((a, b) =>
    a.rel.localeCompare(b.rel),
  );
  const manifest = {};

  for (const { full: sourcePath, rel: relFromImages } of sources) {
    const ext = path.extname(sourcePath).toLowerCase();
    const sourceStat = await stat(sourcePath);
    const meta = await sharp(sourcePath).metadata();
    if (!meta.width || meta.width < VARIANT_MIN_SOURCE_WIDTH) continue;

    const relBase = relFromImages.slice(0, -ext.length); // e.g. "foot-care/hero"
    const variants = [];

    for (const targetWidth of VARIANT_WIDTHS) {
      if (targetWidth > meta.width) continue;
      const outRel = `${relBase}-${targetWidth}.webp`;
      const outPath = path.join(imagesDir, outRel);

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
        console.log(`  variant ${outRel}`);
      }

      variants.push({ width: targetWidth, path: `assets/images/${outRel}` });
    }

    if (variants.length) {
      manifest[relBase] = {
        source: `assets/images/${relFromImages}`,
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
  const sources = await walkImages(IMAGE_DIR, IMAGE_DIR);
  for (const { full } of sources) {
    try {
      totalSaved += await optimizeFile(full);
    } catch (err) {
      console.warn(`  WARN: Failed to optimize ${full}: ${err.message}`);
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
