import type { NextRequest } from 'next/server';
import { InfrastructureError, err, ok } from '@prana/core';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { recordAuditEvent } from '@/server/audit/record-audit-event';
import { requireAdmin } from '@/server/auth/session';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/**
 * GET/PUT /api/v1/admin/blogs/[id]/blocks — the manual blog editor's
 * content API. Blocks (paragraph/heading/image) have no meaningful
 * identity beyond their position within a post, so unlike every other
 * admin resource in this app, editing is "replace the whole ordered
 * list" rather than per-row CRUD — matches how a block editor actually
 * works (add/remove/reorder freely, then Save once).
 */
const blockSchema = z.object({
  blockType: z.enum(['paragraph', 'heading', 'image']),
  text: z.string().optional(),
  level: z.union([z.literal(2), z.literal(3)]).optional(),
  url: z.string().optional(),
  alt: z.string().optional(),
});

const putSchema = z.object({
  blocks: z.array(blockSchema),
});

interface RouteParams {
  id: string;
}

const list = createApiRoute<undefined, unknown, undefined, RouteParams>({
  handler: async ({ params }) => {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('blog_blocks')
      .select('block_type, content')
      .eq('blog_id', params.id)
      .order('position', { ascending: true });

    if (error) {
      return err(new InfrastructureError('Failed to load blog content.', { cause: error.message }));
    }

    const blocks = (data ?? []).map((row) => {
      const content = row.content as { text?: string; level?: number; url?: string; alt?: string };
      return {
        blockType: row.block_type,
        ...(content.text !== undefined ? { text: content.text } : {}),
        ...(content.level !== undefined ? { level: content.level } : {}),
        ...(content.url !== undefined ? { url: content.url } : {}),
        ...(content.alt !== undefined ? { alt: content.alt } : {}),
      };
    });

    return ok({ blocks });
  },
});

const replace = createApiRoute<
  undefined,
  { count: number },
  z.infer<typeof putSchema>,
  RouteParams
>({
  bodySchema: putSchema,
  handler: async ({ body, params, request }) => {
    const actor = await requireAdmin();
    const admin = createSupabaseAdminClient();

    const { error: deleteError } = await admin
      .from('blog_blocks')
      .delete()
      .eq('blog_id', params.id);
    if (deleteError) {
      return err(
        new InfrastructureError('Failed to save blog content.', { cause: deleteError.message }),
      );
    }

    if (body.blocks.length > 0) {
      const rows = body.blocks.map((block, position) => ({
        blog_id: params.id,
        block_type: block.blockType,
        position,
        content: {
          ...(block.text !== undefined ? { text: block.text } : {}),
          ...(block.level !== undefined ? { level: block.level } : {}),
          ...(block.url !== undefined ? { url: block.url } : {}),
          ...(block.alt !== undefined ? { alt: block.alt } : {}),
        },
      }));
      const { error: insertError } = await admin.from('blog_blocks').insert(rows);
      if (insertError) {
        return err(
          new InfrastructureError('Failed to save blog content.', { cause: insertError.message }),
        );
      }
    }

    await recordAuditEvent({
      eventType: 'admin.blog.content_updated',
      aggregateType: 'blog',
      aggregateId: params.id,
      actor,
      service: 'blogs',
      next: { blockCount: body.blocks.length },
      request,
    });

    return ok({ count: body.blocks.length });
  },
});

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return list(request, await context.params);
}

export async function PUT(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'admin', requireAdmin: true });
  if (blocked) return blocked;
  return replace(request, await context.params);
}
