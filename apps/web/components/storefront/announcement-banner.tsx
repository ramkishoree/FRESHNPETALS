import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AnnouncementBannerClient } from './announcement-banner-client';

interface AnnouncementRow {
  id: string;
  message: string;
}

/**
 * Site-wide promo banner (announcements table existed since the schema
 * was first written but nothing ever rendered it anywhere — this is that
 * missing piece). Picks the single highest-priority announcement that's
 * enabled and inside its optional start/end window; RLS already scopes
 * anon reads to enabled=true (migration 0016), the date window is
 * filtered here since that's row-content, not a security boundary.
 */
export async function AnnouncementBanner() {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data } = await supabase
    .from('announcements')
    .select('id, message')
    .eq('enabled', true)
    .is('deleted_at', null)
    .or(`start_date.is.null,start_date.lte.${nowIso}`)
    .or(`end_date.is.null,end_date.gte.${nowIso}`)
    .order('priority', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const row = data as unknown as AnnouncementRow;

  return <AnnouncementBannerClient id={row.id} message={row.message} />;
}
