import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/server/http/envelope';
import { logger } from '@/server/logger';
import {
  hashEditToken,
  MAX_COMMENT,
  MAX_IMAGES,
  ReviewImageError,
  storeReviewImages,
} from '@/server/reviews/review-images';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
  reviewId: string;
}

/**
 * A reviewer changing or withdrawing their own review.
 *
 * Anyone can leave a review without an account, so there is no session
 * to scope ownership by. Submission mints a random token, returns it
 * once, and stores only its SHA-256; the browser keeps it and presents
 * it here. Holding the token is the whole claim — which is why it is
 * compared in constant time against a hash, never looked up by value.
 *
 * The rating, the comment and the photos are all editable, because the
 * thing people most often want to change is the part they got wrong: a
 * comment written in annoyance, a photo that came out badly, a star
 * count they reconsidered. Withdrawing is a soft delete, so the row
 * stays for the owner's records while disappearing from the product.
 */
async function authoriseReviewer(
  reviewId: string,
  productId: string,
  token: string | null,
): Promise<
  | { ok: true; review: { id: string; images: string[] } }
  | { ok: false; status: number; message: string }
> {
  if (!token) {
    return { ok: false, status: 401, message: 'Only the person who wrote it can change a review.' };
  }

  const admin = createSupabaseAdminClient();
  const { data: review } = await admin
    .from('reviews')
    .select('id, images, edit_token_hash')
    .eq('id', reviewId)
    .eq('product_id', productId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!review?.edit_token_hash) {
    return { ok: false, status: 404, message: 'That review no longer exists.' };
  }

  const presented = Buffer.from(hashEditToken(token));
  const expected = Buffer.from(review.edit_token_hash);
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
    return { ok: false, status: 403, message: 'Only the person who wrote it can change a review.' };
  }

  return { ok: true, review: { id: review.id, images: (review.images ?? []) as string[] } };
}

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'reviewEdit' });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const { id: productId, reviewId } = await context.params;

  try {
    const auth = await authoriseReviewer(
      reviewId,
      productId,
      request.headers.get('x-review-token'),
    );
    if (!auth.ok) return apiError('BUSINESS_RULE_ERROR', auth.message, auth.status, correlationId);

    const formData = await request.formData();
    const update: Record<string, unknown> = {};

    if (formData.has('rating')) {
      const rating = Number(formData.get('rating'));
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return apiError(
          'VALIDATION_ERROR',
          'Please choose a rating from 1 to 5.',
          400,
          correlationId,
        );
      }
      update['rating'] = rating;
    }

    if (formData.has('comment')) {
      const comment = String(formData.get('comment') ?? '').trim();
      if (comment.length > MAX_COMMENT) {
        return apiError('VALIDATION_ERROR', 'That comment is too long.', 400, correlationId);
      }
      // An empty string is a deliberate "remove what I wrote", not a
      // missing field — the form only sends `comment` when it changed.
      update['comment'] = comment || null;
    }

    // Photos are sent as the full intended set: `keepImages` lists the
    // existing URLs to hold on to, `images` carries any new files. That
    // makes removal and addition the same operation, so the two can
    // never disagree about the final order.
    if (formData.has('keepImages') || formData.getAll('images').length > 0) {
      const keep = formData
        .getAll('keepImages')
        .map((entry) => String(entry))
        .filter((url) => auth.review.images.includes(url));

      const files = formData
        .getAll('images')
        .filter((entry): entry is File => entry instanceof File);

      if (keep.length + files.length > MAX_IMAGES) {
        return apiError(
          'VALIDATION_ERROR',
          `Up to ${MAX_IMAGES} photos, please.`,
          400,
          correlationId,
        );
      }

      let added: string[];
      try {
        added = await storeReviewImages(files, productId);
      } catch (cause) {
        if (cause instanceof ReviewImageError) {
          return apiError('VALIDATION_ERROR', cause.message, 400, correlationId);
        }
        throw cause;
      }
      update['images'] = [...keep, ...added];
    }

    if (Object.keys(update).length === 0) {
      return apiError('VALIDATION_ERROR', 'Nothing to change.', 400, correlationId);
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('reviews')
      .update(update)
      .eq('id', reviewId)
      .select('id, author_name, rating, comment, images, created_at')
      .single();

    if (error || !data) {
      logger.error('review.update_failed', { correlationId, message: error?.message });
      return apiError(
        'INFRASTRUCTURE_ERROR',
        'Could not save your changes. Please try again.',
        500,
        correlationId,
      );
    }

    return apiSuccess(data, { meta: { correlationId } });
  } catch (cause) {
    logger.error('review.update_unhandled_exception', {
      correlationId,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return apiError('INFRASTRUCTURE_ERROR', 'Could not save your changes.', 500, correlationId);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'reviewEdit' });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const { id: productId, reviewId } = await context.params;

  const auth = await authoriseReviewer(reviewId, productId, request.headers.get('x-review-token'));
  if (!auth.ok) return apiError('BUSINESS_RULE_ERROR', auth.message, auth.status, correlationId);

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('reviews')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', reviewId);

  if (error) {
    logger.error('review.delete_failed', { correlationId, message: error.message });
    return apiError(
      'INFRASTRUCTURE_ERROR',
      'Could not remove your review. Please try again.',
      500,
      correlationId,
    );
  }

  return apiSuccess({ id: reviewId }, { meta: { correlationId } });
}
