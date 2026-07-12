import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '@/lib/slugify';
import { logger } from '@/server/logger';
import type { AiTaskRow } from './repositories/supabase-ai-task-repository';

interface BlogDraft {
  title?: string;
  article?: string;
  featuredImagePrompt?: string;
}

/**
 * Ch.9 §11 draws a hard line: "no v1 agent output is ever applied
 * directly." That held while every approval only ever happened through a
 * human clicking a button in the admin panel. The owner has now
 * explicitly asked for the opposite for content agents specifically —
 * approving a Blog Writer draft (whether from the admin panel today, or a
 * WhatsApp reply once that's live) should really publish it, not just
 * mark a task row completed with nothing to show for it.
 *
 * Scoped deliberately narrow tonight: only blog-writer-ai has a draft
 * shape simple enough to apply safely (a title + article maps directly
 * onto a real blogs row). seo-specialist-ai's current output
 * (priorityFixes/updatedMetadata as loose strings/objects, no per-entity
 * IDs) isn't structured enough to blindly write into products/blogs
 * without real risk of corrupting the wrong record — that needs the
 * agent's output schema and context redesigned first, not a blind apply
 * bolted on. marketing-manager-ai and inventory-manager-ai produce
 * proposals/reports by design (a campaign needs a human decision on
 * budget/code; a stock report has no single unambiguous "apply" action)
 * — approving those still just marks them reviewed, same as before.
 */
const STAGGER_DAYS = 2;

/**
 * Owner's explicit call: approved posts go out on a steady drip, not all
 * at once the moment a Saturday batch gets approved. Finds the latest
 * still-upcoming scheduled/published post and slots this one in
 * STAGGER_DAYS after it; if nothing is upcoming, the first slot is
 * tomorrow (never today — approving something at 11pm shouldn't backdate
 * it).
 */
async function nextScheduledSlot(admin: SupabaseClient): Promise<string> {
  const nowIso = new Date().toISOString();
  const { data } = await admin
    .from('blogs')
    .select('published_at')
    .in('status', ['scheduled', 'published'])
    .gte('published_at', nowIso)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const base = data?.published_at ? new Date(data.published_at) : new Date();
  const offsetDays = data?.published_at ? STAGGER_DAYS : 1;
  return new Date(base.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString();
}

export async function applyApprovedAgentOutput(
  admin: SupabaseClient,
  task: AiTaskRow,
): Promise<{ applied: boolean; detail?: string }> {
  if (task.agentSlug !== 'blog-writer-ai') {
    return { applied: false };
  }

  const draft = task.metadata['draft'] as BlogDraft | undefined;
  if (!draft?.title || !draft.article) {
    logger.warn('ai.apply.blog_draft_incomplete', { taskId: task.id });
    return { applied: false, detail: 'Draft is missing a title or article body.' };
  }

  const baseSlug = slugify(draft.title);
  let slug = baseSlug;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { data: existing } = await admin
      .from('blogs')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${attempt + 1}`;
  }

  const readingTimeMinutes = Math.max(1, Math.round(draft.article.split(/\s+/).length / 200));
  const publishedAt = await nextScheduledSlot(admin);

  const { data: blog, error: blogError } = await admin
    .from('blogs')
    .insert({
      title: draft.title,
      slug,
      excerpt: draft.article.slice(0, 200).trim(),
      status: 'scheduled',
      reading_time_minutes: readingTimeMinutes,
      published_at: publishedAt,
      ai_generated: true,
    })
    .select('id')
    .single();

  if (blogError || !blog) {
    logger.error('ai.apply.blog_insert_failed', { taskId: task.id, message: blogError?.message });
    return { applied: false, detail: blogError?.message ?? 'Failed to create the blog post.' };
  }

  const paragraphs = draft.article
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks = paragraphs.map((text, position) => ({
    blog_id: blog.id,
    block_type: 'paragraph',
    position,
    content: { text },
  }));

  if (blocks.length > 0) {
    const { error: blocksError } = await admin.from('blog_blocks').insert(blocks);
    if (blocksError) {
      logger.error('ai.apply.blog_blocks_insert_failed', {
        taskId: task.id,
        blogId: blog.id,
        message: blocksError.message,
      });
    }
  }

  logger.info('ai.apply.blog_scheduled', { taskId: task.id, blogId: blog.id, slug, publishedAt });
  const publishDate = new Date(publishedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
  return { applied: true, detail: `Scheduled to publish ${publishDate} at /blog/${slug}` };
}
