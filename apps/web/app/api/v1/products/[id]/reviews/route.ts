import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/server/http/envelope';
import { logger } from '@/server/logger';
import {
  hashEditToken,
  MAX_COMMENT,
  MAX_IMAGES,
  MAX_NAME,
  ReviewImageError,
  storeReviewImages,
} from '@/server/reviews/review-images';
import { runSecurityChain } from '@/server/security/chain';

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
 *    page, and the reviewer can edit or withdraw their own using the
 *    one-time token returned here.
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

    let imageUrls: string[];
    try {
      imageUrls = await storeReviewImages(files, productId);
    } catch (cause) {
      if (cause instanceof ReviewImageError) {
        return apiError('VALIDATION_ERROR', cause.message, 400, correlationId);
      }
      throw cause;
    }

    // Handed to the browser once and never stored in readable form. It
    // is what lets the reviewer come back and change or withdraw what
    // they wrote without an account to sign in to.
    const editToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

    const { data: review, error: insertError } = await admin
      .from('reviews')
      .insert({
        product_id: productId,
        customer_id: null,
        author_name: authorName,
        rating,
        comment: comment || null,
        images: imageUrls,
        edit_token_hash: hashEditToken(editToken),
        status: 'approved',
      })
      .select('id, author_name, rating, comment, images, created_at')
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

    return apiSuccess({ ...review, editToken }, { meta: { correlationId } });
  } catch (cause) {
    logger.error('review.unhandled_exception', {
      correlationId,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return apiError('INFRASTRUCTURE_ERROR', 'Could not save your review.', 500, correlationId);
  }
}
