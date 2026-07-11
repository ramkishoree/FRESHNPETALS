// @vitest-environment node
import { err, ExternalServiceError, ok } from '@prana/core';
import { describe, expect, it, vi } from 'vitest';
import { runScheduledAgentsIfDue } from './agent-scheduler';

interface JobRow {
  id: string;
  last_run: string | null;
}

function makeAdmin(options: {
  autonomousEnabled: boolean;
  jobs: Record<string, JobRow | null>;
  recentMarketingTask?: boolean;
}) {
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
      return {
        select: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockResolvedValue({ data: options.recentMarketingTask ? [{ id: 'existing' }] : [] }),
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
      jobs: {
        seo_biweekly_refresh: NEVER_RUN,
        blog_weekly_batch: NEVER_RUN,
        inventory_weekly_scan: NEVER_RUN,
        marketing_holiday_scan: NEVER_RUN,
      },
    });
    const runTask = vi.fn();

    const outcomes = await runScheduledAgentsIfDue(admin, runTask);

    expect(outcomes).toEqual([]);
    expect(runTask).not.toHaveBeenCalled();
  });

  it('runs the SEO job when due and marks it run', async () => {
    const admin = makeAdmin({
      autonomousEnabled: true,
      jobs: {
        seo_biweekly_refresh: NEVER_RUN,
        blog_weekly_batch: JUST_RAN,
        inventory_weekly_scan: JUST_RAN,
        marketing_holiday_scan: JUST_RAN,
      },
    });
    const runTask = vi.fn().mockResolvedValue(ok({ taskId: 't-1', status: 'waiting_approval' }));

    const outcomes = await runScheduledAgentsIfDue(admin, runTask);

    const seoOutcome = outcomes.find((o) => o.jobName === 'seo_biweekly_refresh');
    expect(seoOutcome?.ran).toBe(true);
    expect(runTask).toHaveBeenCalledWith('seo-specialist-ai', expect.any(String));
    expect(admin.updateEqSpy).toHaveBeenCalledWith('id', 'job-1');
  });

  it('does not run the SEO job when it ran recently', async () => {
    const admin = makeAdmin({
      autonomousEnabled: true,
      jobs: {
        seo_biweekly_refresh: JUST_RAN,
        blog_weekly_batch: JUST_RAN,
        inventory_weekly_scan: JUST_RAN,
        marketing_holiday_scan: JUST_RAN,
      },
    });
    const runTask = vi.fn();

    const outcomes = await runScheduledAgentsIfDue(admin, runTask);

    expect(outcomes.find((o) => o.jobName === 'seo_biweekly_refresh')).toBeUndefined();
    expect(runTask).not.toHaveBeenCalled();
  });

  it('generates a 3-topic blog batch when due', async () => {
    const admin = makeAdmin({
      autonomousEnabled: true,
      jobs: {
        seo_biweekly_refresh: JUST_RAN,
        blog_weekly_batch: NEVER_RUN,
        inventory_weekly_scan: JUST_RAN,
        marketing_holiday_scan: JUST_RAN,
      },
    });
    const runTask = vi.fn().mockResolvedValue(ok({ taskId: 't-1', status: 'waiting_approval' }));

    const outcomes = await runScheduledAgentsIfDue(admin, runTask);

    const blogOutcome = outcomes.find((o) => o.jobName === 'blog_weekly_batch');
    expect(blogOutcome?.results).toHaveLength(3);
    expect(runTask.mock.calls.filter((c: unknown[]) => c[0] === 'blog-writer-ai')).toHaveLength(3);
  });

  it("one agent's failure does not stop the others in the same job", async () => {
    const admin = makeAdmin({
      autonomousEnabled: true,
      jobs: {
        seo_biweekly_refresh: JUST_RAN,
        blog_weekly_batch: NEVER_RUN,
        inventory_weekly_scan: JUST_RAN,
        marketing_holiday_scan: JUST_RAN,
      },
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

  it('proposes a marketing campaign for the nearest upcoming gifting occasion', async () => {
    // Rose Day (Feb 7) is nearer than Valentine's Day (Feb 14) from this date.
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    const admin = makeAdmin({
      autonomousEnabled: true,
      jobs: {
        seo_biweekly_refresh: JUST_RAN,
        blog_weekly_batch: JUST_RAN,
        inventory_weekly_scan: JUST_RAN,
        marketing_holiday_scan: NEVER_RUN,
      },
      recentMarketingTask: false,
    });
    const runTask = vi.fn().mockResolvedValue(ok({ taskId: 't-1', status: 'waiting_approval' }));

    const outcomes = await runScheduledAgentsIfDue(admin, runTask);

    const marketingOutcome = outcomes.find((o) => o.jobName === 'marketing_holiday_scan');
    expect(marketingOutcome?.ran).toBe(true);
    expect(runTask).toHaveBeenCalledWith(
      'marketing-manager-ai',
      expect.stringContaining('Rose Day'),
    );
    vi.useRealTimers();
  });

  it('does not re-propose a campaign already proposed in the last 30 days', async () => {
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    const admin = makeAdmin({
      autonomousEnabled: true,
      jobs: {
        seo_biweekly_refresh: JUST_RAN,
        blog_weekly_batch: JUST_RAN,
        inventory_weekly_scan: JUST_RAN,
        marketing_holiday_scan: NEVER_RUN,
      },
      recentMarketingTask: true,
    });
    const runTask = vi.fn();

    const outcomes = await runScheduledAgentsIfDue(admin, runTask);

    const marketingOutcome = outcomes.find((o) => o.jobName === 'marketing_holiday_scan');
    expect(marketingOutcome?.ran).toBe(false);
    expect(runTask).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
