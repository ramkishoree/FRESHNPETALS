import 'server-only';

/**
 * Identifies an image by its actual bytes rather than its claimed type.
 *
 * `File.type` on an upload is whatever the browser was told, which is
 * whatever the client chose to say — renaming `payload.html` to
 * `photo.jpg` sets it to `image/jpeg`. The file signature cannot be
 * spoofed the same way without producing something that really is a
 * JPEG or PNG.
 *
 * Only the two formats the review form accepts are recognised; anything
 * else returns null and is refused. Narrow on purpose: every accepted
 * type is one more decoder exposed to hostile input.
 */
export function sniffImageType(bytes: Buffer): 'jpeg' | 'png' | null {
  // JPEG: FF D8 FF
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}
