// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { applyApprovedAgentOutput } from './apply-agent-output';
import type { AiTaskRow } from './repositories/supabase-ai-task-repository';

function baseTask(overrides: Partial<AiTaskRow> = {}): AiTaskRow {
  return {
    id: 'task-1',
    taskType: 'agent_run',
    title: 'Write an article on: flower care',
    description: null,
    status: 'waiting_approval',
    assignedAgent: 'agent-1',
    agentName: 'Blog Writer AI',
    agentSlug: 'blog-writer-ai',
    requestedBy: null,
    metadata: {},
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

function makeAdmin(options: {
  existingSlugs?: Set<string>;
  insertShouldFail?: boolean;
  latestUpcomingPublishedAt?: string | null;
}) {
  const existingSlugs = options.existingSlugs ?? new Set<string>();
  const insertedBlocks: unknown[] = [];
  const insertedBlogs: Record<string, unknown>[] = [];

  const from = vi.fn((table: string) => {
    if (table === 'blogs') {
      // nextScheduledSlot's query (select('published_at').in(...).gte(...)
      // .order(...).limit(1).maybeSingle()) — a single self-returning
      // chain object, distinct from the slug-collision check below.
      const staggerChain: {
        in: ReturnType<typeof vi.fn>;
        gte: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
        maybeSingle: ReturnType<typeof vi.fn>;
      } = {
        in: vi.fn(),
        gte: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({
          data:
            options.latestUpcomingPublishedAt !== undefined &&
            options.latestUpcomingPublishedAt !== null
              ? { published_at: options.latestUpcomingPublishedAt }
              : null,
        }),
      };
      staggerChain.in.mockReturnValue(staggerChain);
      staggerChain.gte.mockReturnValue(staggerChain);
      staggerChain.order.mockReturnValue(staggerChain);
      staggerChain.limit.mockReturnValue(staggerChain);

      return {
        select: vi.fn((columns: string) => {
          if (columns === 'published_at') return staggerChain;
          return {
            eq: vi.fn((_column: string, value: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: existingSlugs.has(value) ? { id: 'existing-id' } : null,
              }),
            })),
          };
        }),
        insert: vi.fn((row: Record<string, unknown>) => {
          insertedBlogs.push(row);
          return {
            select: vi.fn().mockReturnThis(),
            single: vi
              .fn()
              .mockResolvedValue(
                options.insertShouldFail
                  ? { data: null, error: { message: 'insert failed' } }
                  : { data: { id: 'new-blog-id' }, error: null },
              ),
          };
        }),
      };
    }
    if (table === 'blog_blocks') {
      return {
        insert: vi.fn((rows: unknown[]) => {
          insertedBlocks.push(...rows);
          return Promise.resolve({ error: null });
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from, insertedBlocks, insertedBlogs } as any;
}

describe('applyApprovedAgentOutput', () => {
  it('does nothing for an agent without a defined apply action', async () => {
    const admin = makeAdmin({});
    const task = baseTask({ agentSlug: 'some-other-agent-ai' });

    const result = await applyApprovedAgentOutput(admin, task);

    expect(result).toEqual({ applied: false });
    expect(admin.from).not.toHaveBeenCalled();
  });

  it('schedules a real blog post (not instant-publish) from a complete blog-writer-ai draft', async () => {
    const admin = makeAdmin({});
    const task = baseTask({
      metadata: {
        draft: {
          title: 'How to Care for Fresh Roses',
          article: 'First paragraph about roses.\n\nSecond paragraph about vases.',
        },
      },
    });

    const result = await applyApprovedAgentOutput(admin, task);

    expect(result.applied).toBe(true);
    expect(result.detail).toContain('how-to-care-for-fresh-roses');
    expect(admin.insertedBlogs[0]).toMatchObject({ status: 'scheduled' });
    // Owner's explicit call: approved posts go on a steady drip, not
    // instantly the moment they're approved — the first slot is tomorrow.
    const publishedAt = new Date(admin.insertedBlogs[0].published_at as string);
    expect(publishedAt.getTime()).toBeGreaterThan(Date.now());
    expect(admin.insertedBlocks).toHaveLength(2);
    expect(admin.insertedBlocks[0]).toMatchObject({
      blog_id: 'new-blog-id',
      block_type: 'paragraph',
      position: 0,
      content: { text: 'First paragraph about roses.' },
    });
  });

  it('slots a new approval 2 days after the latest already-scheduled post, not on top of it', async () => {
    const alreadyScheduled = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const admin = makeAdmin({ latestUpcomingPublishedAt: alreadyScheduled });
    const task = baseTask({
      metadata: { draft: { title: 'A Fresh Topic', article: 'Some content here.' } },
    });

    await applyApprovedAgentOutput(admin, task);

    const publishedAt = new Date(admin.insertedBlogs[0].published_at as string).getTime();
    const expected = new Date(alreadyScheduled).getTime() + 2 * 24 * 60 * 60 * 1000;
    expect(publishedAt).toBe(expected);
  });

  it('converts a literal <h1>/<h2>-wrapped paragraph into a real heading block, not text shown verbatim on the page', async () => {
    const admin = makeAdmin({});
    const task = baseTask({
      metadata: {
        draft: {
          title: 'Best Gifts for Gen Z',
          article:
            '<h1>Best Gifts for Gen Z</h1>\n\n<h2>Why Flowers Work</h2>\n\nFlowers are a great pick for any occasion.',
        },
      },
    });

    await applyApprovedAgentOutput(admin, task);

    expect(admin.insertedBlocks).toEqual([
      {
        blog_id: 'new-blog-id',
        block_type: 'heading',
        position: 0,
        content: { level: 1, text: 'Best Gifts for Gen Z' },
      },
      {
        blog_id: 'new-blog-id',
        block_type: 'heading',
        position: 1,
        content: { level: 2, text: 'Why Flowers Work' },
      },
      {
        blog_id: 'new-blog-id',
        block_type: 'paragraph',
        position: 2,
        content: { text: 'Flowers are a great pick for any occasion.' },
      },
    ]);
    // The excerpt is drawn from the first real paragraph, not a raw slice
    // that used to start with the literal "<h1>" tag text.
    expect(admin.insertedBlogs[0].excerpt).toBe('Flowers are a great pick for any occasion.');
  });

  it('strips stray inline HTML tags from an ordinary paragraph', async () => {
    const admin = makeAdmin({});
    const task = baseTask({
      metadata: {
        draft: {
          title: 'A Title',
          article: 'This has <strong>bold</strong> and <em>italic</em> text in it.',
        },
      },
    });

    await applyApprovedAgentOutput(admin, task);

    expect(admin.insertedBlocks[0]).toMatchObject({
      content: { text: 'This has bold and italic text in it.' },
    });
  });

  it('converts a Markdown "# Heading" into a real heading block — confirmed live in production: the model used Markdown, not HTML, on the very next run after the HTML-only fix shipped', async () => {
    const admin = makeAdmin({});
    const task = baseTask({
      metadata: {
        draft: {
          title: '15 Best Gifts',
          article:
            '# 15 Best Gifts for Your Gen Z Sister\n\n## Introduction\n\nShopping for your sister can feel overwhelming.',
        },
      },
    });

    await applyApprovedAgentOutput(admin, task);

    expect(admin.insertedBlocks).toEqual([
      {
        blog_id: 'new-blog-id',
        block_type: 'heading',
        position: 0,
        content: { level: 1, text: '15 Best Gifts for Your Gen Z Sister' },
      },
      {
        blog_id: 'new-blog-id',
        block_type: 'heading',
        position: 1,
        content: { level: 2, text: 'Introduction' },
      },
      {
        blog_id: 'new-blog-id',
        block_type: 'paragraph',
        position: 2,
        content: { text: 'Shopping for your sister can feel overwhelming.' },
      },
    ]);
  });

  it('strips Markdown emphasis markers and bullet prefixes from an ordinary paragraph', async () => {
    const admin = makeAdmin({});
    const task = baseTask({
      metadata: {
        draft: {
          title: 'A Title',
          article: 'This has **bold** and *italic* and _also italic_ text in it.',
        },
      },
    });

    await applyApprovedAgentOutput(admin, task);

    expect(admin.insertedBlocks[0]).toMatchObject({
      content: { text: 'This has bold and italic and also italic text in it.' },
    });
  });

  it('does not apply when the draft is missing a title or article', async () => {
    const admin = makeAdmin({});
    const task = baseTask({ metadata: { draft: { title: 'Only a title' } } });

    const result = await applyApprovedAgentOutput(admin, task);

    expect(result.applied).toBe(false);
    expect(result.detail).toMatch(/missing/i);
  });

  it('appends a numeric suffix when the slug already exists', async () => {
    const admin = makeAdmin({ existingSlugs: new Set(['how-to-care-for-fresh-roses']) });
    const task = baseTask({
      metadata: { draft: { title: 'How to Care for Fresh Roses', article: 'Some content here.' } },
    });

    const result = await applyApprovedAgentOutput(admin, task);

    expect(result.detail).toContain('how-to-care-for-fresh-roses-2');
  });

  it('surfaces the database error instead of silently succeeding', async () => {
    const admin = makeAdmin({ insertShouldFail: true });
    const task = baseTask({
      metadata: { draft: { title: 'A Title', article: 'Some content.' } },
    });

    const result = await applyApprovedAgentOutput(admin, task);

    expect(result.applied).toBe(false);
    expect(result.detail).toBe('insert failed');
  });
});
