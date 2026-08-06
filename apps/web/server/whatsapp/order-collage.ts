import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { logger } from '@/server/logger';

const BUCKET = 'media';
const CANVAS = 1080;
const JPEG_QUALITY = 80;
/** Meta caps header images at 5MB; a 1080² JPEG is nowhere near it, but
 *  a 20-item order tiled 1:1 would be unreadable long before it was big. */
const MAX_TILES = 9;

/**
 * Stitches an order's product photos into one image for the WhatsApp
 * alert's header.
 *
 * A template header holds exactly one image and Meta has no multi-image
 * template. Sending one message per item was tried and rejected: it
 * charges per item and buzzes the phone N times for a single order. A
 * collage keeps the whole order to one message while still showing every
 * product — which is the point, since a florist recognises the
 * arrangement far faster than the title.
 *
 * Best-effort by design: a failure here returns null and the caller
 * falls back to a single photo or to no header at all. Nobody should
 * lose an order alert because an image couldn't be composed.
 */
export async function buildOrderCollage(params: {
  admin: SupabaseClient;
  orderNumber: string;
  imageUrls: string[];
}): Promise<string | null> {
  const urls = params.imageUrls.filter(Boolean).slice(0, MAX_TILES);
  if (urls.length === 0) return null;

  try {
    const downloaded = await Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return null;
        return Buffer.from(await response.arrayBuffer());
      }),
    );
    // Built by hand rather than with a type predicate: `Buffer.from` now
    // returns `Buffer<ArrayBuffer>`, which a plain `buffer is Buffer`
    // guard no longer narrows to.
    const buffers: Buffer[] = [];
    for (const buffer of downloaded) {
      if (buffer) buffers.push(buffer);
    }
    if (buffers.length === 0) return null;

    // Square grid: 1 photo fills the canvas, 2-4 tile 2×2, 5-9 tile 3×3.
    const columns = buffers.length === 1 ? 1 : buffers.length <= 4 ? 2 : 3;
    const rows = Math.ceil(buffers.length / columns);
    const tileWidth = Math.floor(CANVAS / columns);
    const tileHeight = Math.floor(CANVAS / rows);

    const tiles = await Promise.all(
      buffers.map(async (buffer, index) => ({
        input: await sharp(buffer)
          .rotate()
          .resize(tileWidth, tileHeight, { fit: 'cover', position: 'centre' })
          .toBuffer(),
        left: (index % columns) * tileWidth,
        top: Math.floor(index / columns) * tileHeight,
      })),
    );

    const collage = await sharp({
      create: {
        width: columns * tileWidth,
        height: rows * tileHeight,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite(tiles)
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    // Order number keys the path, so re-running the side effects for one
    // order overwrites rather than accumulating orphaned collages.
    const path = `order-alerts/${params.orderNumber}.jpg`;
    const { error } = await params.admin.storage
      .from(BUCKET)
      .upload(path, collage, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);

    return params.admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (cause) {
    logger.warn('whatsapp.order_collage_failed', {
      orderNumber: params.orderNumber,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}
