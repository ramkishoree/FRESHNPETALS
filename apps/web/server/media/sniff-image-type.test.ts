// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { sniffImageType } from './sniff-image-type';

async function makeImage(format: 'jpeg' | 'png' | 'webp' | 'gif'): Promise<Buffer> {
  const base = sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 50, b: 50 } },
  });
  if (format === 'jpeg') return base.jpeg().toBuffer();
  if (format === 'png') return base.png().toBuffer();
  if (format === 'webp') return base.webp().toBuffer();
  return base.gif().toBuffer();
}

describe('sniffImageType', () => {
  it('recognises a real JPEG', async () => {
    expect(sniffImageType(await makeImage('jpeg'))).toBe('jpeg');
  });

  it('recognises a real PNG', async () => {
    expect(sniffImageType(await makeImage('png'))).toBe('png');
  });

  it('refuses a file that merely claims to be an image', async () => {
    // The attack this exists to stop: any payload renamed .jpg arrives
    // with type "image/jpeg" because the browser trusts the extension.
    const html = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', 'utf8');

    expect(sniffImageType(html)).toBeNull();
    expect(sniffImageType(svg)).toBeNull();
  });

  it('refuses image formats the form does not accept', async () => {
    // Every accepted format is another decoder exposed to hostile input,
    // so WebP and GIF are rejected rather than quietly converted.
    expect(sniffImageType(await makeImage('webp'))).toBeNull();
    expect(sniffImageType(await makeImage('gif'))).toBeNull();
  });

  it('refuses a truncated file rather than reading past the end', async () => {
    const png = await makeImage('png');

    expect(sniffImageType(png.subarray(0, 4))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });

  it('refuses a PNG signature that is only half right', () => {
    // The first four bytes match but the rest of the signature does not,
    // which a shorter check would have waved through.
    const almost = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00, 0x00]);

    expect(sniffImageType(almost)).toBeNull();
  });
});
