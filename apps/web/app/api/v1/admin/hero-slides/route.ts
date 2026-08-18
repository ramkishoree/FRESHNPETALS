import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { apiError, apiSuccess } from '@/server/http/envelope';
import { logger } from '@/server/logger';
import { convertImageToWebp } from '@/server/media/convert-to-webp';
import { runSecurityChain } from '@/server/security/chain';

const MEDIA_BUCKET = 'media';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

/**
 * GET/POST /api/v1/admin/hero-slides — the four homepage hero slots.
 *
 * POST is multipart and idempotent per slot: it creates the slide if the
 * slot is empty and replaces it if it is not, so the admin screen never
 * has to know which of the two it is doing. The caption and the on/off
 * switch ride along on the same request; sending no file leaves whatever
 * media the slot already holds, which is how "just fix the caption"
 * works without a re-upload.
 *
 * All four slots take photographs. Slot 1 briefly accepted a short
 * video; the owner's call is that the band is stills throughout, so
 * video is refused here with a message that says so rather than being
 * quietly converted into something that would never play.
 *
 * Images are converted server-side exactly as product media is (sharp →
 * WebP) — never something a browser could skip.
 */
export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('hero_slides')
    .select('*')
    .order('slot_order', { ascending: true });

  if (error) return apiError('INFRASTRUCTURE_ERROR', error.message, 500, correlationId);
  return apiSuccess(data ?? [], { meta: { correlationId } });
}

export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const actor = await requireAdmin();
  const admin = createSupabaseAdminClient();

  try {
    const formData = await request.formData();
    const slotOrder = Number(formData.get('slotOrder'));
    if (!Number.isInteger(slotOrder) || slotOrder < 1 || slotOrder > 4) {
      return apiError('VALIDATION_ERROR', 'Slot must be 1, 2, 3 or 4.', 400, correlationId);
    }

    const { data: existing } = await admin
      .from('hero_slides')
      .select('id, media_url, media_type')
      .eq('slot_order', slotOrder)
      .maybeSingle();

    const file = formData.get('file');
    const hasFile = file instanceof File && file.size > 0;
    if (!hasFile && !existing) {
      return apiError(
        'VALIDATION_ERROR',
        'This slot is empty — choose a file to put in it.',
        400,
        correlationId,
      );
    }

    let mediaUrl = existing?.media_url ?? null;
    let mediaType = existing?.media_type ?? null;

    if (hasFile) {
      if (!IMAGE_MIME_TYPES.has(file.type)) {
        return apiError(
          'VALIDATION_ERROR',
          'The hero takes photos only. Accepted: JPEG, PNG, WebP, GIF, AVIF.',
          400,
          correlationId,
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return apiError('VALIDATION_ERROR', 'Image is larger than 15MB.', 400, correlationId);
      }

      const sourceBytes = Buffer.from(await file.arrayBuffer());
      const webp = await convertImageToWebp(sourceBytes);
      const imagePath = `hero/${randomUUID()}.webp`;
      const { error: uploadError } = await admin.storage
        .from(MEDIA_BUCKET)
        .upload(imagePath, webp.data, { contentType: 'image/webp', upsert: false });
      if (uploadError) {
        logger.error('hero_slides.upload.storage_failed', {
          correlationId,
          message: uploadError.message,
        });
        return apiError(
          'EXTERNAL_SERVICE_ERROR',
          `Failed to upload: ${uploadError.message}`,
          502,
          correlationId,
        );
      }
      mediaUrl = admin.storage.from(MEDIA_BUCKET).getPublicUrl(imagePath).data.publicUrl;
      mediaType = 'image';
    }

    const rawCaption = formData.get('captionText');
    const caption = typeof rawCaption === 'string' ? rawCaption.trim().slice(0, 160) : '';
    const rawActive = formData.get('isActive');

    const row = {
      slot_order: slotOrder,
      media_type: mediaType as string,
      media_url: mediaUrl as string,
      caption_text: caption === '' ? null : caption,
      is_active: rawActive === null ? true : rawActive === 'true',
    };

    const { data: saved, error: writeError } = await admin
      .from('hero_slides')
      .upsert(row, { onConflict: 'slot_order' })
      .select()
      .single();

    if (writeError) {
      logger.error('hero_slides.save_failed', { correlationId, message: writeError.message });
      return apiError('INFRASTRUCTURE_ERROR', writeError.message, 500, correlationId);
    }

    await recordAuditEvent({
      eventType: 'admin.hero_slide.saved',
      aggregateType: 'hero_slide',
      aggregateId: saved.id,
      actor,
      service: 'hero',
      next: { slotOrder, mediaType: row.media_type, replacedMedia: hasFile },
      request,
    });

    return apiSuccess(saved, { meta: { correlationId } });
  } catch (cause) {
    logger.error('hero_slides.unhandled_exception', {
      correlationId,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return apiError('INFRASTRUCTURE_ERROR', 'Failed to save the slide.', 500, correlationId);
  }
}
