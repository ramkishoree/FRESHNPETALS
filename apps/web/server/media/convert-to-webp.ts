import 'server-only';
import sharp from 'sharp';

export interface WebpConversionResult {
  data: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
}

const WEBP_QUALITY = 82;
const JPEG_QUALITY = 82;

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

/**
 * The same image as JPEG, uploaded alongside the WebP rather than instead
 * of it. WebP stays the canonical asset the storefront serves — this
 * exists purely for consumers outside the browser that can't read it. Meta
 * is the one that forced the issue: a WhatsApp template's image header
 * accepts only JPEG and PNG, and a WebP link fails the whole send, so the
 * owner's order alert disappeared entirely. See
 * `jpegSiblingUrl` for how callers find this file from the WebP's URL.
 *
 * `.rotate()` matches `convertImageToWebp`: EXIF orientation is baked in
 * before the metadata is dropped. Unlike WebP, JPEG *would* carry EXIF
 * through by default, so this is what stops a customer's uploaded photo
 * leaking GPS and camera details.
 */
export async function convertImageToJpeg(sourceBytes: Buffer): Promise<WebpConversionResult> {
  const { data, info } = await sharp(sourceBytes)
    .rotate()
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height, sizeBytes: info.size };
}
