import 'server-only';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sniffImageType } from '@/server/media/sniff-image-type';

export const MEDIA_BUCKET = 'media';
export const MAX_IMAGES = 3;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_COMMENT = 2000;
export const MAX_NAME = 80;

export class ReviewImageError extends Error {}

/**
 * Turns uploaded files into public WebP URLs, or throws with a message
 * meant for the person who chose the file.
 *
 * Shared by the submit and the edit routes so a photo added later goes
 * through exactly the same treatment as one added at the start: sniffed
 * by magic bytes rather than trusting the browser's MIME claim, then
 * re-encoded. The re-encode is the real protection — the bytes served
 * are ones this server produced, so nothing executable survives, and
 * WebP output carries no EXIF, which means a customer's photo cannot
 * leak the GPS coordinates of their home.
 */
export async function storeReviewImages(files: File[], productId: string): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const urls: string[] = [];

  for (const file of files) {
    if (file.size === 0) continue;
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ReviewImageError('Each photo must be under 5MB.');
    }

    const sourceBytes = Buffer.from(await file.arrayBuffer());
    if (!sniffImageType(sourceBytes)) {
      throw new ReviewImageError('Photos must be JPEG or PNG files.');
    }

    // `.rotate()` bakes in EXIF orientation before the metadata is
    // discarded, so a phone photo is not served sideways.
    const converted = await sharp(sourceBytes)
      .rotate()
      .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    const path = `reviews/${productId}/${crypto.randomUUID()}.webp`;
    const { error } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(path, converted, { contentType: 'image/webp', upsert: false });
    if (error) throw new ReviewImageError('Could not save that photo. Please try again.');

    urls.push(admin.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl);
  }

  return urls;
}

/**
 * The token proves who wrote an anonymous review; only its hash is
 * stored, so reading the table does not let anyone edit a stranger's
 * review. Same shape as an API key.
 */
export function hashEditToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
