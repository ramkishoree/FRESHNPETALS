import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { zUuid } from '@/lib/uuid';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { apiError, apiSuccess } from '@/server/http/envelope';
import { logger } from '@/server/logger';
import { convertImageToJpeg, convertImageToWebp } from '@/server/media/convert-to-webp';
import { convertVideoToWebOptimized } from '@/server/media/convert-video';
import { runSecurityChain } from '@/server/security/chain';

const MEDIA_BUCKET = 'media';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // Owner-confirmed cap (Ch.12 §56 video variant): light compression, size-capped.

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  'video/x-matroska',
  'video/3gpp',
  'video/mpeg',
  'video/ogg',
]);

interface RouteParams {
  id: string;
}

/**
 * POST /api/v1/admin/products/{id}/media — Ch.12 §56 Media Library,
 * product-gallery variant: every product previously had exactly one
 * `featured_image` text column, so there was nowhere to attach a second
 * photo or any video at all. This uploads raw bytes in almost any common
 * image/video format, converts server-side (sharp → WebP for images plus
 * a JPEG sibling for non-browser consumers, ffmpeg → capped-bitrate H.264
 * MP4 + WebP poster for videos — never something a client could skip),
 * stores the result in Supabase Storage, and records a `product_media`
 * row.
 */
export async function POST(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const actor = await requireAdmin();
  const { id: productId } = await context.params;

  const idCheck = zUuid().safeParse(productId);
  if (!idCheck.success) {
    return apiError('VALIDATION_ERROR', 'Invalid product id.', 400, correlationId);
  }

  const admin = createSupabaseAdminClient();

  try {
    const { data: product } = await admin
      .from('products')
      .select('id')
      .eq('id', productId)
      .maybeSingle();
    if (!product) {
      return apiError('BUSINESS_RULE_ERROR', 'Product not found.', 404, correlationId);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return apiError('VALIDATION_ERROR', 'No file provided.', 400, correlationId);
    }

    const isImage = IMAGE_MIME_TYPES.has(file.type);
    const isVideo = VIDEO_MIME_TYPES.has(file.type);
    if (!isImage && !isVideo) {
      return apiError(
        'VALIDATION_ERROR',
        `Unsupported file type "${file.type}". Accepted images: JPEG, PNG, WebP, GIF, AVIF. Accepted video: MP4, MOV, WebM, AVI, MKV, 3GP, MPEG, OGG.`,
        400,
        correlationId,
      );
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      return apiError('VALIDATION_ERROR', 'Image is larger than 15MB.', 400, correlationId);
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      return apiError('VALIDATION_ERROR', 'Video is larger than 50MB.', 400, correlationId);
    }

    const sourceBytes = Buffer.from(await file.arrayBuffer());
    const { count: existingCount } = await admin
      .from('product_media')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);
    const position = existingCount ?? 0;

    let mediaType: 'image' | 'video';
    let url: string;
    let thumbnailUrl: string | null = null;

    if (isImage) {
      // Stored twice under one name: WebP is what the storefront serves,
      // and the JPEG sibling exists for consumers outside the browser
      // that can't read WebP — today that's the WhatsApp order alert,
      // whose template header Meta rejects outright when handed a WebP
      // link. `jpegSiblingUrl` derives the second URL from the first, so
      // neither the schema nor any caller needs to track it.
      const baseId = randomUUID();
      const webpPath = `products/${productId}/${baseId}.webp`;
      const jpegPath = `products/${productId}/${baseId}.jpg`;

      const [webp, jpeg] = await Promise.all([
        convertImageToWebp(sourceBytes),
        convertImageToJpeg(sourceBytes),
      ]);
      const [webpUpload, jpegUpload] = await Promise.all([
        admin.storage
          .from(MEDIA_BUCKET)
          .upload(webpPath, webp.data, { contentType: 'image/webp', upsert: false }),
        admin.storage
          .from(MEDIA_BUCKET)
          .upload(jpegPath, jpeg.data, { contentType: 'image/jpeg', upsert: false }),
      ]);
      if (webpUpload.error || jpegUpload.error) {
        const message =
          webpUpload.error?.message ?? jpegUpload.error?.message ?? 'unknown storage error';
        logger.error('product_media.upload.storage_failed', { correlationId, message });
        return apiError(
          'EXTERNAL_SERVICE_ERROR',
          `Failed to upload: ${message}`,
          502,
          correlationId,
        );
      }
      url = admin.storage.from(MEDIA_BUCKET).getPublicUrl(webpPath).data.publicUrl;
      mediaType = 'image';
    } else {
      const converted = await convertVideoToWebOptimized(sourceBytes);
      const baseId = randomUUID();
      const videoPath = `products/${productId}/${baseId}.mp4`;
      const thumbPath = `products/${productId}/${baseId}-poster.webp`;

      const [videoUpload, thumbUpload] = await Promise.all([
        admin.storage
          .from(MEDIA_BUCKET)
          .upload(videoPath, converted.video, { contentType: 'video/mp4', upsert: false }),
        admin.storage
          .from(MEDIA_BUCKET)
          .upload(thumbPath, converted.thumbnail, { contentType: 'image/webp', upsert: false }),
      ]);
      if (videoUpload.error || thumbUpload.error) {
        const message =
          videoUpload.error?.message ?? thumbUpload.error?.message ?? 'unknown storage error';
        logger.error('product_media.upload.storage_failed', { correlationId, message });
        return apiError(
          'EXTERNAL_SERVICE_ERROR',
          `Failed to upload: ${message}`,
          502,
          correlationId,
        );
      }
      url = admin.storage.from(MEDIA_BUCKET).getPublicUrl(videoPath).data.publicUrl;
      thumbnailUrl = admin.storage.from(MEDIA_BUCKET).getPublicUrl(thumbPath).data.publicUrl;
      mediaType = 'video';
    }

    const { data: mediaRow, error: insertError } = await admin
      .from('product_media')
      .insert({
        product_id: productId,
        media_type: mediaType,
        url,
        thumbnail_url: thumbnailUrl,
        position,
      })
      .select()
      .single();

    if (insertError) {
      logger.error('product_media.insert_failed', { correlationId, message: insertError.message });
      return apiError(
        'INFRASTRUCTURE_ERROR',
        `Uploaded but failed to register the asset: ${insertError.message}`,
        500,
        correlationId,
      );
    }

    await recordAuditEvent({
      eventType: 'product.media.uploaded',
      aggregateType: 'product',
      aggregateId: productId,
      actor,
      service: 'products',
      next: { mediaId: mediaRow.id, mediaType, originalMimeType: file.type },
      request,
    });

    logger.info('product_media.upload.completed', {
      correlationId,
      productId,
      mediaType,
      originalBytes: sourceBytes.length,
    });

    return apiSuccess(mediaRow, { meta: { correlationId } });
  } catch (cause) {
    logger.error('product_media.upload.unhandled_exception', {
      correlationId,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return apiError('INFRASTRUCTURE_ERROR', 'Failed to process the upload.', 500, correlationId);
  }
}

/** GET /api/v1/admin/products/{id}/media — the gallery list for the admin ProductForm. */
export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;

  const correlationId = crypto.randomUUID();
  const { id: productId } = await context.params;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('product_media')
    .select('*')
    .eq('product_id', productId)
    .order('position', { ascending: true });

  if (error) {
    return apiError('INFRASTRUCTURE_ERROR', error.message, 500, correlationId);
  }

  return apiSuccess(data ?? [], { meta: { correlationId } });
}
