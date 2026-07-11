import 'server-only';
import sharp from 'sharp';

export interface WebpConversionResult {
  data: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}

const WEBP_QUALITY = 82;

/**
 * Ch.12 §56 — the guarantee behind "every image sent is converted to
 * WebP": this runs server-side, so it can't be skipped by a client that
 * forgot to (or chose not to) convert before uploading. `.rotate()`
 * bakes in EXIF orientation before the format conversion drops the EXIF
 * block entirely (WebP output carries none by default) — also strips
 * GPS/camera metadata a customer's uploaded photo might otherwise leak.
 */
export async function convertImageToWebp(sourceBytes: Buffer): Promise<WebpConversionResult> {
  const { data, info } = await sharp(sourceBytes)
    .rotate()
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height, sizeBytes: info.size };
}
