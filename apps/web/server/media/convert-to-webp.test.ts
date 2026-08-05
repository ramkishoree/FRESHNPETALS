import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { convertImageToJpeg, convertImageToWebp } from './convert-to-webp';

async function makeTestPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } },
  })
    .png()
    .toBuffer();
}

describe('convertImageToWebp', () => {
  it('converts a real PNG to a valid WebP buffer with matching dimensions', async () => {
    const png = await makeTestPng(64, 48);
    const result = await convertImageToWebp(png);

    // RIFF....WEBP is the mandatory magic header for every valid WebP file.
    expect(result.data.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(result.data.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(result.width).toBe(64);
    expect(result.height).toBe(48);
    expect(result.sizeBytes).toBe(result.data.length);

    // Re-decode with sharp to prove it's not just a header — a genuinely
    // valid, readable WebP image.
    const metadata = await sharp(result.data).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(64);
    expect(metadata.height).toBe(48);
  });

  it('converts a JPEG source to WebP too', async () => {
    const jpeg = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 10, g: 100, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const result = await convertImageToWebp(jpeg);
    const metadata = await sharp(result.data).metadata();
    expect(metadata.format).toBe('webp');
  });

  it('produces a materially smaller file than an uncompressed source for a real photo-like image', async () => {
    // A gradient (more entropy than a flat color) is a more representative
    // stand-in for a real photo than a single flat color, which WebP would
    // trivially compress to almost nothing regardless of quality settings.
    const width = 200;
    const height = 200;
    const raw = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3;
        raw[i] = x % 256;
        raw[i + 1] = y % 256;
        raw[i + 2] = (x + y) % 256;
      }
    }
    const png = await sharp(raw, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();

    const result = await convertImageToWebp(png);
    expect(result.sizeBytes).toBeLessThan(png.length);
  });
});

describe('convertImageToJpeg', () => {
  it('converts a PNG to a valid JPEG buffer with matching dimensions', async () => {
    const png = await makeTestPng(64, 48);
    const result = await convertImageToJpeg(png);

    // FFD8FF is the mandatory SOI marker at the start of every JPEG.
    expect(result.data.subarray(0, 3).toString('hex')).toBe('ffd8ff');
    expect(result.width).toBe(64);
    expect(result.height).toBe(48);
    expect(result.sizeBytes).toBe(result.data.length);

    const metadata = await sharp(result.data).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(64);
    expect(metadata.height).toBe(48);
  });

  it('converts a WebP source to JPEG — the case Meta actually needs', async () => {
    const webp = await sharp({
      create: { width: 40, height: 20, channels: 3, background: { r: 5, g: 90, b: 180 } },
    })
      .webp()
      .toBuffer();

    const result = await convertImageToJpeg(webp);
    const metadata = await sharp(result.data).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(40);
    expect(metadata.height).toBe(20);
  });

  it('drops EXIF so an uploaded photo cannot leak GPS or camera metadata', async () => {
    const png = await makeTestPng(20, 20);
    const withExif = await sharp(png)
      .withExif({ IFD0: { Copyright: 'test', Software: 'test-suite' } })
      .jpeg()
      .toBuffer();

    const result = await convertImageToJpeg(withExif);
    const metadata = await sharp(result.data).metadata();
    expect(metadata.exif).toBeUndefined();
  });
});
