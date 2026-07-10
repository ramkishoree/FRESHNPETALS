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
 */
export async function StaticPageContent({
  slug,
  fallbackTitle,
}: {
  slug: string;
  fallbackTitle: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('static_pages')
    .select('title, content')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  const title = data?.title ?? fallbackTitle;
  const blocks = (data?.content as { blocks?: StaticPageBlock[] } | null)?.blocks ?? [];

  return (
    <div className="container-brand max-w-3xl space-y-4 py-10">
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
