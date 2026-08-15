import type { NextRequest } from 'next/server';
import sharp from 'sharp';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/server/http/envelope';
import { logger } from '@/server/logger';
import { sniffImageType } from '@/server/media/sniff-image-type';
import { runSecurityChain } from '@/server/security/chain';

const MEDIA_BUCKET = 'media';
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_COMMENT = 2000;
const MAX_NAME = 80;

/**
 * Public review submission — no account needed.
 *
 * The owner's call: a customer should be able to say what arrived
 * without signing up. Name and rating are required, the comment is
 * optional, and up to three photos can come with it.
 *
 * This is an unauthenticated endpoint that accepts file uploads, which
 * makes it the most abusable surface on the site. What guards it:
 *
 *  - A dedicated rate-limit tier (5/hour per address), far tighter than
 *    the general anonymous tier.
 *  - Magic-byte sniffing rather than the client's MIME claim, so a
 *    script renamed .jpg is rejected.
 *  - Every image re-encoded through sharp. That is the real protection:
 *    the bytes served are ones this server produced, so nothing
 *    executable survives the round trip, and WebP output carries no
 *    EXIF — which also means a customer's photo cannot leak the GPS
 *    coordinates of their home.
 *  - `status: 'approved'` publishes immediately, per the owner's
 *    decision; the owner can delete any review inline on the product
 *    page.
 *
 * Written with the service-role client because `reviews` has no anon
 * INSERT policy, and shouldn't: validation belongs here, not in RLS.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const blocked = await runSecurityChain(request, { tier: 'review' });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const { id: productId } = await context.params;
  const admin = createSupabaseAdminClient();

  try {
    const { data: product } = await admin
      .from('products')
      .select('id')
      .eq('id', productId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!product) {
      return apiError('BUSINESS_RULE_ERROR', 'Product not found.', 404, correlationId);
    }

    const formData = await request.formData();

    const authorName = String(formData.get('authorName') ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (authorName.length < 2 || authorName.length > MAX_NAME) {
      return apiError('VALIDATION_ERROR', 'Please enter your name.', 400, correlationId);
    }

    const rating = Number(formData.get('rating'));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return apiError(
        'VALIDATION_ERROR',
        'Please choose a rating from 1 to 5.',
        400,
        correlationId,
      );
    }

    const comment = String(formData.get('comment') ?? '').trim();
    if (comment.length > MAX_COMMENT) {
      return apiError('VALIDATION_ERROR', 'That comment is too long.', 400, correlationId);
    }

    const files = formData.getAll('images').filter((entry): entry is File => entry instanceof File);
    if (files.length > MAX_IMAGES) {
      return apiError(
        'VALIDATION_ERROR',
        `Up to ${MAX_IMAGES} photos, please.`,
        400,
        correlationId,
      );
    }

    const imageUrls: string[] = [];
    for (const file of files) {
      if (file.size === 0) continue;
      if (file.size > MAX_IMAGE_BYTES) {
        return apiError('VALIDATION_ERROR', 'Each photo must be under 5MB.', 400, correlationId);
      }

      const sourceBytes = Buffer.from(await file.arrayBuffer());
      if (!sniffImageType(sourceBytes)) {
        return apiError(
          'VALIDATION_ERROR',
          'Photos must be JPEG or PNG files.',
          400,
          correlationId,
        );
      }

      // Re-encoded, not stored as uploaded. `.rotate()` bakes in EXIF
      // orientation before the metadata is discarded, so a phone photo
      // is not served sideways; WebP output then carries no EXIF at all.
      const converted = await sharp(sourceBytes)
        .rotate()
        .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();

      const path = `reviews/${productId}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await admin.storage
        .from(MEDIA_BUCKET)
        .upload(path, converted, { contentType: 'image/webp', upsert: false });
      if (uploadError) {
        logger.error('review.image_upload_failed', { correlationId, message: uploadError.message });
        return apiError(
          'EXTERNAL_SERVICE_ERROR',
          'Could not save that photo. Please try again.',
          502,
          correlationId,
        );
      }
      imageUrls.push(admin.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl);
    }

    const { data: review, error: insertError } = await admin
      .from('reviews')
      .insert({
        product_id: productId,
        customer_id: null,
        author_name: authorName,
        rating,
        comment: comment || null,
        images: imageUrls,
        // Not a confirmed buyer — the badge stays honest.
        verified_purchase: false,
        status: 'approved',
      })
      .select('id, author_name, rating, comment, images, created_at, verified_purchase')
      .single();

    if (insertError || !review) {
      logger.error('review.insert_failed', { correlationId, message: insertError?.message });
      return apiError(
        'INFRASTRUCTURE_ERROR',
        'Could not save your review. Please try again.',
        500,
        correlationId,
      );
    }

    return apiSuccess(review, { meta: { correlationId } });
  } catch (cause) {
    logger.error('review.unhandled_exception', {
      correlationId,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return apiError('INFRASTRUCTURE_ERROR', 'Could not save your review.', 500, correlationId);
  }
}
