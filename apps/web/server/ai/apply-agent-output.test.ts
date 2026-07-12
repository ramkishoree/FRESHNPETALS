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

function makeAdmin(options: { existingSlugs?: Set<string>; insertShouldFail?: boolean }) {
  const existingSlugs = options.existingSlugs ?? new Set<string>();
  const insertedBlocks: unknown[] = [];

  const from = vi.fn((table: string) => {
    if (table === 'blogs') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((_column: string, value: string) => ({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: existingSlugs.has(value) ? { id: 'existing-id' } : null }),
        })),
        insert: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValue(
              options.insertShouldFail
                ? { data: null, error: { message: 'insert failed' } }
                : { data: { id: 'new-blog-id' }, error: null },
            ),
        })),
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
  return { from, insertedBlocks } as any;
}

describe('applyApprovedAgentOutput', () => {
  it('does nothing for an agent without a defined apply action', async () => {
    const admin = makeAdmin({});
    const task = baseTask({ agentSlug: 'seo-specialist-ai' });

    const result = await applyApprovedAgentOutput(admin, task);

    expect(result).toEqual({ applied: false });
    expect(admin.from).not.toHaveBeenCalled();
  });

  it('publishes a real blog post from a complete blog-writer-ai draft', async () => {
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
    expect(admin.insertedBlocks).toHaveLength(2);
    expect(admin.insertedBlocks[0]).toMatchObject({
      blog_id: 'new-blog-id',
      block_type: 'paragraph',
      position: 0,
      content: { text: 'First paragraph about roses.' },
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
