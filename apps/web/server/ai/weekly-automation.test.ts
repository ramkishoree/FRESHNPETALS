// @vitest-environment node
import { err, ExternalServiceError, ok } from '@prana/core';
import { describe, expect, it, vi } from 'vitest';
import { runWeeklyAutomationIfDue } from './weekly-automation';

function makeAdmin(schedulerRow: { id: string; last_run: string | null } | null) {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: schedulerRow, error: null }),
  };
  const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) };

  const from = vi.fn(() => ({
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from, updateChain } as any;
}

describe('runWeeklyAutomationIfDue', () => {
  it('does not run when the scheduler row is disabled/missing', async () => {
    const admin = makeAdmin(null);
    const runTask = vi.fn();

    const outcome = await runWeeklyAutomationIfDue(admin, runTask);

    expect(outcome).toEqual({ ran: false });
    expect(runTask).not.toHaveBeenCalled();
  });

  it('does not run when last_run was less than 6 days ago', async () => {
    const admin = makeAdmin({ id: 'sched-1', last_run: new Date().toISOString() });
    const runTask = vi.fn();

    const outcome = await runWeeklyAutomationIfDue(admin, runTask);

    expect(outcome).toEqual({ ran: false });
    expect(runTask).not.toHaveBeenCalled();
  });

  it('runs every configured agent when last_run is null (never run before)', async () => {
    const admin = makeAdmin({ id: 'sched-1', last_run: null });
    const runTask = vi.fn().mockResolvedValue(ok({ taskId: 't-1', status: 'waiting_approval' }));

    const outcome = await runWeeklyAutomationIfDue(admin, runTask);

    expect(outcome.ran).toBe(true);
    expect(runTask).toHaveBeenCalledTimes(5);
    expect(runTask.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'seo-specialist-ai',
      'inventory-manager-ai',
      'analytics-analyst-ai',
      'marketing-manager-ai',
      'operations-assistant-ai',
    ]);
    expect(outcome.results?.every((r) => r.success)).toBe(true);
    // Updates last_run so the same cron tick tomorrow doesn't re-run it.
    expect(admin.updateChain.eq).toHaveBeenCalledWith('id', 'sched-1');
  });

  it('runs when last_run was more than 6 days ago', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const admin = makeAdmin({ id: 'sched-1', last_run: eightDaysAgo });
    const runTask = vi.fn().mockResolvedValue(ok({ taskId: 't-1', status: 'waiting_approval' }));

    const outcome = await runWeeklyAutomationIfDue(admin, runTask);

    expect(outcome.ran).toBe(true);
    expect(runTask).toHaveBeenCalledTimes(5);
  });

  it("one agent's failure does not stop the others from running", async () => {
    const admin = makeAdmin({ id: 'sched-1', last_run: null });
    const runTask = vi
      .fn()
      .mockResolvedValueOnce(ok({ taskId: 't-1', status: 'waiting_approval' }))
      .mockResolvedValueOnce(err(new ExternalServiceError('provider down')))
      .mockRejectedValueOnce(new Error('unexpected throw'))
      .mockResolvedValue(ok({ taskId: 't-4', status: 'waiting_approval' }));

    const outcome = await runWeeklyAutomationIfDue(admin, runTask);

    expect(runTask).toHaveBeenCalledTimes(5);
    expect(outcome.results?.filter((r) => r.success)).toHaveLength(3);
    expect(outcome.results?.filter((r) => !r.success)).toHaveLength(2);
    expect(outcome.results?.[1]).toMatchObject({ success: false, error: 'provider down' });
    expect(outcome.results?.[2]).toMatchObject({ success: false, error: 'unexpected throw' });
    // Still marks last_run even when some agents failed — a full retry
    // tomorrow for a partial failure isn't the intended behavior here.
    expect(admin.updateChain.eq).toHaveBeenCalledOnce();
  });
});
