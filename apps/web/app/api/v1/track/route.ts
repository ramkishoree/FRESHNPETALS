import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/server/logger';

const bodySchema = z.object({
  path: z.string().min(1).max(300).startsWith('/'),
});

/**
 * First-party page-view beacon for the admin traffic dashboard (owner's
 * explicit ask, overriding the general no-analytics-in-admin rule for
 * this project). No cookies, no per-visitor identity, no third party —
 * just an aggregate daily counter (server/../migrations/0065). Always
 * responds 204 regardless of outcome: a tracking beacon must never
 * surface an error to the visitor or block page rendering.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return new NextResponse(null, { status: 204 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('track_page_view', { p_path: parsed.data.path });
  if (error) {
    logger.error('track.page_view_failed', { message: error.message });
  }

  return new NextResponse(null, { status: 204 });
}
