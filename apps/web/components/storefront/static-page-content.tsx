import { draftMode } from 'next/headers';
import { DraftModeBanner } from '@/components/storefront/draft-mode-banner';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface StaticPageBlock {
  type: string;
  text?: string;
}

/**
 * Ch.6 static-page IA (About/Contact/Privacy/Terms/FAQ/Delivery Policy).
 * `static_pages.content` (migration 0009) is an intentionally open jsonb
 * shape — this renders `content.blocks[].text` if the admin has written
 * any, and a plain "content coming soon" placeholder otherwise, rather
 * than a broken page for a slug nobody has written yet in `/admin/pages`.
 *
 * The `status = 'published'` filter is dropped under Draft Mode, so an
 * admin's Preview link can see the current draft before publishing it —
 * every other visitor still only ever sees published content.
 */
export async function StaticPageContent({
  slug,
  fallbackTitle,
}: {
  slug: string;
  fallbackTitle: string;
}) {
  const isDraft = (await draftMode()).isEnabled;
  const supabase = await createSupabaseServerClient();
  let query = supabase.from('static_pages').select('title, content, status').eq('slug', slug);
  if (!isDraft) query = query.eq('status', 'published');
  const { data } = await query.maybeSingle();

  const title = data?.title ?? fallbackTitle;
  const blocks = (data?.content as { blocks?: StaticPageBlock[] } | null)?.blocks ?? [];

  return (
    <div className="container-brand max-w-3xl space-y-4 py-10">
      {isDraft && <DraftModeBanner status={data?.status} />}
      <h1 className="text-h2 text-foreground font-bold">{title}</h1>
      {blocks.length === 0 ? (
        <p className="text-body text-muted-foreground">
          This page&apos;s content hasn&apos;t been published yet.
        </p>
      ) : (
        blocks.map((block, index) => (
          <p key={index} className="text-body text-foreground whitespace-pre-line">
            {block.text}
          </p>
        ))
      )}
    </div>
  );
}
