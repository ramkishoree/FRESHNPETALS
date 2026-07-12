// @vitest-environment node
import { err, ExternalServiceError, ok } from '@prana/core';
import { describe, expect, it, vi } from 'vitest';
import { pickWeeklyBlogTopics, runScheduledAgentsIfDue } from './agent-scheduler';

interface JobRow {
  id: string;
  last_run: string | null;
}

function makeAdmin(options: { autonomousEnabled: boolean; jobs: Record<string, JobRow | null> }) {
  const updateEqSpy = vi.fn().mockResolvedValue({ error: null });

  const from = vi.fn((table: string) => {
    if (table === 'system_settings') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.autonomousEnabled
            ? { value: { ai_autonomous_scheduling_enabled: true } }
            : { value: { ai_autonomous_scheduling_enabled: false } },
          error: null,
        }),
      };
    }
    if (table === 'scheduler_jobs') {
      let currentJobName: string | undefined;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((column: string, value: string) => {
          if (column === 'name') currentJobName = value;
          return {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(async () => ({
              data: currentJobName ? options.jobs[currentJobName] : null,
              error: null,
            })),
          };
        }),
        update: vi.fn().mockReturnValue({ eq: updateEqSpy }),
      };
    }
    if (table === 'ai_tasks') {
      // No occasion has ever been proposed before, in every test here —
      // pickWeeklyBlogTopics's occasionAlreadyCovered() check always sees
      // a clean slate, so any occasions within the lookahead window (real
      // system time, not mocked) are still eligible topics alongside the
      // evergreen pool.
      return {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [] }),
      };
    }
    throw new Error(`Unexpected table in test: ${table}`);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from, updateEqSpy } as any;
}

const NEVER_RUN: JobRow = { id: 'job-1', last_run: null };
const JUST_RAN: JobRow = { id: 'job-1', last_run: new Date().toISOString() };

describe('runScheduledAgentsIfDue', () => {
  it('does nothing when the autonomous-scheduling feature flag is off', async () => {
    const admin = makeAdmin({
      autonomousEnabled: false,
      jobs: { blog_weekly_batch: NEVER_RUN },
    });
    const runTask = vi.fn();

    const outcomes = await runScheduledAgentsIfDue(admin, runTask);

    expect(outcomes).toEqual([]);
    expect(runTask).not.toHaveBeenCalled();
  });

  it('generates a 3-topic blog batch when due and marks it run', async () => {
    const admin = makeAdmin({
      autonomousEnabled: true,
      jobs: { blog_weekly_batch: NEVER_RUN },
    });
    const runTask = vi.fn().mockResolvedValue(ok({ taskId: 't-1', status: 'waiting_approval' }));

    const outcomes = await runScheduledAgentsIfDue(admin, runTask);

    const blogOutcome = outcomes.find((o) => o.jobName === 'blog_weekly_batch');
    expect(blogOutcome?.ran).toBe(true);
    expect(blogOutcome?.results).toHaveLength(3);
    expect(runTask.mock.calls.filter((c: unknown[]) => c[0] === 'blog-writer-ai')).toHaveLength(3);
    expect(admin.updateEqSpy).toHaveBeenCalledWith('id', 'job-1');
  });

  it('does not run the blog job when it ran recently', async () => {
    const admin = makeAdmin({
      autonomousEnabled: true,
      jobs: { blog_weekly_batch: JUST_RAN },
    });
    const runTask = vi.fn();

    const outcomes = await runScheduledAgentsIfDue(admin, runTask);

    expect(outcomes.find((o) => o.jobName === 'blog_weekly_batch')).toBeUndefined();
    expect(runTask).not.toHaveBeenCalled();
  });

  it("one topic's failure does not stop the others in the same batch", async () => {
    const admin = makeAdmin({
      autonomousEnabled: true,
      jobs: { blog_weekly_batch: NEVER_RUN },
    });
    const runTask = vi
      .fn()
      .mockResolvedValueOnce(ok({ taskId: 't-1', status: 'waiting_approval' }))
      .mockResolvedValueOnce(err(new ExternalServiceError('provider down')))
      .mockRejectedValueOnce(new Error('unexpected throw'));

    const outcomes = await runScheduledAgentsIfDue(admin, runTask);

    const blogOutcome = outcomes.find((o) => o.jobName === 'blog_weekly_batch');
    expect(blogOutcome?.results?.filter((r) => r.success)).toHaveLength(1);
    expect(blogOutcome?.results?.filter((r) => !r.success)).toHaveLength(2);
  });
});

describe('pickWeeklyBlogTopics', () => {
  const noCoverageAdmin = makeAdmin({
    autonomousEnabled: true,
    jobs: { blog_weekly_batch: null },
  });

  it('returns exactly `count` distinct, non-empty topics', async () => {
    const topics = await pickWeeklyBlogTopics(noCoverageAdmin, 3);
    expect(topics).toHaveLength(3);
    expect(new Set(topics).size).toBe(3);
    for (const topic of topics) expect(topic.length).toBeGreaterThan(0);
  });

  it('never returns a topic passed in excludeTopics', async () => {
    const [firstPick] = await pickWeeklyBlogTopics(noCoverageAdmin, 1);
    expect(firstPick).toBeDefined();

    const topics = await pickWeeklyBlogTopics(noCoverageAdmin, 3, [firstPick!]);
    expect(topics).not.toContain(firstPick);
    expect(topics).toHaveLength(3);
  });

  it('prioritizes an upcoming Indian gifting occasion over the evergreen pool', async () => {
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    const topics = await pickWeeklyBlogTopics(noCoverageAdmin, 1);
    expect(topics[0]).toContain('Rose Day');
    vi.useRealTimers();
  });
});
