import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { DISPLAY_FILE, THUMB_FILE, ensureDerivatives, needsDisplay } from '../data/archive-images.js';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'openst-img-'));
const exists = async (p: string): Promise<boolean> =>
  fs.access(p).then(
    () => true,
    () => false,
  );

describe('needsDisplay', () => {
  it('flags non-webp, oversized or unknown sources; passes bounded webp', () => {
    expect(needsDisplay({ format: 'png', width: 800, height: 450 })).toBe(true);
    expect(needsDisplay({ format: 'webp', width: 1001, height: 400 })).toBe(true);
    expect(needsDisplay({ format: 'webp', width: 400, height: 1200 })).toBe(true);
    expect(needsDisplay({})).toBe(true);
    expect(needsDisplay({ format: 'webp', width: 1000, height: 1000 })).toBe(false);
    expect(needsDisplay({ format: 'webp', width: 640, height: 360 })).toBe(false);
  });
});

describe('ensureDerivatives', () => {
  it('re-encodes a PNG-renamed-as-.webp source into bounded display + thumb', async () => {
    const dir = await tmp();
    const source = path.join(dir, 'preview.webp');
    await sharp({ create: { width: 1500, height: 750, channels: 3, background: { r: 52, g: 86, b: 120 } } })
      .png()
      .toFile(source);

    const out = await ensureDerivatives({ dir, sourceFile: 'preview.webp' });
    expect(out).toEqual({ display: DISPLAY_FILE, thumb: THUMB_FILE });

    const display = await sharp(path.join(dir, DISPLAY_FILE)).metadata();
    expect(display.format).toBe('webp');
    expect(Math.max(display.width ?? 0, display.height ?? 0)).toBeLessThanOrEqual(1000);
    const thumb = await sharp(path.join(dir, THUMB_FILE)).metadata();
    expect(thumb.format).toBe('webp');
    expect(Math.max(thumb.width ?? 0, thumb.height ?? 0)).toBeLessThanOrEqual(640);
  });

  it('skips display for an already bounded webp but still produces a thumb', async () => {
    const dir = await tmp();
    await sharp({ create: { width: 800, height: 450, channels: 3, background: '#123456' } })
      .webp()
      .toFile(path.join(dir, 'preview.webp'));

    const out = await ensureDerivatives({ dir, sourceFile: 'preview.webp' });
    expect(out.display).toBe('');
    expect(out.thumb).toBe(THUMB_FILE);
    expect(await exists(path.join(dir, DISPLAY_FILE))).toBe(false);
  });

  it('regenerates a stale derivative when the source is newer', async () => {
    sharp.cache(false);
    const dir = await tmp();
    const source = path.join(dir, 'preview.webp');
    await sharp({ create: { width: 800, height: 450, channels: 3, background: '#111111' } })
      .webp()
      .toFile(source);
    await ensureDerivatives({ dir, sourceFile: 'preview.webp' });
    const thumbPath = path.join(dir, THUMB_FILE);
    const before = await fs.readFile(thumbPath);

    const updated = await sharp({ create: { width: 800, height: 450, channels: 3, background: '#eeeeee' } })
      .webp()
      .toBuffer();
    await fs.writeFile(source, updated);
    const future = new Date(Date.now() + 5000);
    await fs.utimes(source, future, future);

    const out = await ensureDerivatives({ dir, sourceFile: 'preview.webp' });
    expect(out.thumb).toBe(THUMB_FILE);
    expect(await fs.readFile(thumbPath)).not.toEqual(before);
  });
});
