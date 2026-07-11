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
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB — generous for a source photo, well under any real business's needs.
const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

/**
 * Ch.12 §56 Media Library — the previous flow was "browser uploads
 * directly to Storage via a signed URL, this API only registers
 * metadata after the fact," which meant there was no real upload UI
 * (admins could only hand-type a storage_path) and nothing ever touched
 * the file bytes server-side. This replaces that with a real upload
 * endpoint: the browser posts the raw file here, the server converts it
 * to WebP (sharp — the same library next/image's own optimizer uses)
 * and uploads the converted bytes itself, so every stored image is
 * WebP regardless of what format was uploaded — not something a client
 * could skip or get wrong.
 *
 * Requires a `media` bucket in Supabase Storage — one-time dashboard
 * setup, same as the `invoices` bucket. Public vs private is your call
 * (see the setup notes) — this route works either way, it just uploads
 * and returns whatever URL the bucket's own public-URL helper resolves.
 */
export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const actor = await requireAdmin();

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return apiError('VALIDATION_ERROR', 'No file provided.', 400, correlationId);
    }
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      return apiError(
        'VALIDATION_ERROR',
        `Unsupported file type "${file.type}". Accepted: JPEG, PNG, WebP, GIF, AVIF.`,
        400,
        correlationId,
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return apiError('VALIDATION_ERROR', 'File is larger than 15MB.', 400, correlationId);
    }

    const altText = formData.get('altText');
    const sourceBytes = Buffer.from(await file.arrayBuffer());
    const converted = await convertImageToWebp(sourceBytes);

    const originalName = file.name.replace(/\.[^./]+$/, '');
    const storagePath = `${randomUUID()}-${originalName.slice(0, 60).replace(/[^a-zA-Z0-9_-]/g, '-')}.webp`;

    const admin = createSupabaseAdminClient();
    const { error: uploadError } = await admin.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, converted.data, { contentType: 'image/webp', upsert: false });
    if (uploadError) {
      logger.error('media.upload.storage_failed', { correlationId, message: uploadError.message });
      return apiError(
        'EXTERNAL_SERVICE_ERROR',
        `Failed to upload to storage: ${uploadError.message}`,
        502,
        correlationId,
      );
    }

    const { data: publicUrlData } = admin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

    const { data: mediaRow, error: insertError } = await admin
      .from('media_library')
      .insert({
        filename: `${originalName || 'upload'}.webp`,
        mime_type: 'image/webp',
        width: converted.width,
        height: converted.height,
        filesize: converted.sizeBytes,
        storage_path: storagePath,
        cdn_url: publicUrlData?.publicUrl ?? null,
        alt_text: typeof altText === 'string' && altText ? altText : null,
        uploaded_by: actor.id,
      })
      .select()
      .single();

    if (insertError) {
      logger.error('media.upload.insert_failed', { correlationId, message: insertError.message });
      return apiError(
        'INFRASTRUCTURE_ERROR',
        `Uploaded but failed to register the asset: ${insertError.message}`,
        500,
        correlationId,
      );
    }

    await recordAuditEvent({
      eventType: 'media.uploaded',
      aggregateType: 'media_asset',
      aggregateId: mediaRow.id,
      actor,
      service: 'media',
      next: { filename: mediaRow.filename, originalMimeType: file.type },
    });

    logger.info('media.upload.completed', {
      correlationId,
      originalBytes: sourceBytes.length,
      webpBytes: converted.sizeBytes,
    });

    return apiSuccess(mediaRow, { meta: { correlationId } });
  } catch (cause) {
    logger.error('media.upload.unhandled_exception', {
      correlationId,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return apiError('INFRASTRUCTURE_ERROR', 'Failed to process the upload.', 500, correlationId);
  }
}
