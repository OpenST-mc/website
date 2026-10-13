import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const PREVIEW_MAX = 1000;
export const THUMB_MAX = 640;
export const DISPLAY_FILE = 'display.webp';
export const THUMB_FILE = 'thumb.webp';

// 源图非 webp（含改缀名）或超出详情展示上限时，需要重编码出有界 display。
export function needsDisplay(meta) {
  return meta.format !== 'webp' || (meta.width ?? 0) > PREVIEW_MAX || (meta.height ?? 0) > PREVIEW_MAX;
}

async function isStale(sourcePath, outPath) {
  const [source, out] = await Promise.all([fs.stat(sourcePath), fs.stat(outPath).catch(() => null)]);
  return !out || source.mtimeMs > out.mtimeMs;
}

// FDT：详情图按需产出 display.webp（≤1000px webp），卡片统一产出 thumb.webp（≤640px webp）。
export async function ensureDerivatives({ dir, sourceFile }) {
  const sourcePath = path.join(dir, sourceFile);
  const meta = await sharp(sourcePath).metadata();

  const display = needsDisplay(meta) ? DISPLAY_FILE : '';
  if (display) {
    const displayPath = path.join(dir, DISPLAY_FILE);
    if (await isStale(sourcePath, displayPath)) {
      await sharp(sourcePath)
        .resize(PREVIEW_MAX, PREVIEW_MAX, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toFile(displayPath);
    }
  }

  const thumbPath = path.join(dir, THUMB_FILE);
  const thumbSource = display ? path.join(dir, DISPLAY_FILE) : sourcePath;
  if (await isStale(thumbSource, thumbPath)) {
    await sharp(thumbSource)
      .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75, effort: 4 })
      .toFile(thumbPath);
  }

  return { display, thumb: THUMB_FILE };
}
