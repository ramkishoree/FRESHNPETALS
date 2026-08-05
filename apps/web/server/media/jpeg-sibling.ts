import 'server-only';

/**
 * Every image the media route uploads is stored twice under the same
 * name — `<uuid>.webp` for the storefront and `<uuid>.jpg` for anything
 * that can't read WebP (see `convertImageToJpeg`). This turns the WebP
 * URL held in `products.featured_image` into the sibling's URL, so
 * callers never need a second database column or a storage lookup.
 *
 * Returns null when the URL isn't a WebP — there is no sibling to point
 * at, and the caller should keep whatever it already had rather than
 * fabricate a path that 404s.
 */
export function jpegSiblingUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!parsed.pathname.toLowerCase().endsWith('.webp')) return null;

  parsed.pathname = `${parsed.pathname.slice(0, -'.webp'.length)}.jpg`;
  return parsed.toString();
}
