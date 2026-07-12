import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { zUuid } from '@/lib/uuid';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { apiError, apiSuccess } from '@/server/http/envelope';
import { logger } from '@/server/logger';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
  mediaId: string;
}

const MEDIA_BUCKET = 'media';

function storagePathFromPublicUrl(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const index = publicUrl.indexOf(marker);
  return index === -1 ? null : publicUrl.slice(index + marker.length);
}

const patchBodySchema = z.object({
  position: z.number().int().min(0),
});

/** PATCH /api/v1/admin/products/{id}/media/{mediaId} — reorder within the gallery. */
export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  await requireAdmin();
  const { mediaId } = await context.params;

  const raw = await request.json().catch(() => undefined);
  const parsed = patchBodySchema.safeParse(raw);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid request body.', 400, correlationId);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('product_media')
    .update({ position: parsed.data.position })
    .eq('id', mediaId)
    .select()
    .single();

  if (error) {
    return apiError('INFRASTRUCTURE_ERROR', error.message, 500, correlationId);
  }

  return apiSuccess(data, { meta: { correlationId } });
}

/** DELETE /api/v1/admin/products/{id}/media/{mediaId} — removes the DB row and best-effort deletes the storage objects. */
export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const actor = await requireAdmin();
  const { id: productId, mediaId } = await context.params;

  const idCheck = zUuid().safeParse(mediaId);
  if (!idCheck.success) {
    return apiError('VALIDATION_ERROR', 'Invalid media id.', 400, correlationId);
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('product_media')
    .select('url, thumbnail_url')
    .eq('id', mediaId)
    .maybeSingle();

  const { error: deleteError } = await admin.from('product_media').delete().eq('id', mediaId);
  if (deleteError) {
    return apiError('INFRASTRUCTURE_ERROR', deleteError.message, 500, correlationId);
  }

  if (existing) {
    const paths = [existing.url, existing.thumbnail_url]
      .filter((value): value is string => Boolean(value))
      .map(storagePathFromPublicUrl)
      .filter((value): value is string => Boolean(value));
    if (paths.length > 0) {
      const { error: storageError } = await admin.storage.from(MEDIA_BUCKET).remove(paths);
      if (storageError) {
        // Not fatal — the DB row (the source of truth for what's shown) is
        // already gone; an orphaned storage object just wastes some space.
        logger.warn('product_media.delete.storage_cleanup_failed', {
          correlationId,
          message: storageError.message,
        });
      }
    }
  }

  await recordAuditEvent({
    eventType: 'product.media.deleted',
    aggregateType: 'product',
    aggregateId: productId,
    actor,
    service: 'products',
    next: { mediaId },
    request,
  });

  return apiSuccess({ deleted: true }, { meta: { correlationId } });
}
