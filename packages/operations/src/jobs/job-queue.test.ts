import { describe, expect, it, vi } from 'vitest';
import { type Job, type JobQueue, processNextJob } from './job-queue';

function makeJob(overrides: Partial<Job> = {}): Job {
  return { id: 'job-1', jobType: 'sample.ping', payload: {}, attempts: 1, ...overrides };
}

class FakeJobQueue implements JobQueue {
  completed: string[] = [];
  failed: { jobId: string; errorMessage: string; nextRetryAt: Date | null }[] = [];

  constructor(private job: Job | null) {}

  enqueue(): Promise<void> {
    return Promise.resolve();
  }

  claimNext(): Promise<Job | null> {
    const job = this.job;
    this.job = null; // simulate the row being claimed — a second call finds nothing
    return Promise.resolve(job);
  }

  markCompleted(jobId: string): Promise<void> {
    this.completed.push(jobId);
    return Promise.resolve();
  }

  markFailed(jobId: string, errorMessage: string, nextRetryAt: Date | null): Promise<void> {
    this.failed.push({ jobId, errorMessage, nextRetryAt });
    return Promise.resolve();
  }
}

describe('processNextJob', () => {
  it('returns "empty" when there is nothing to claim', async () => {
    const queue = new FakeJobQueue(null);
    const handler = vi.fn();

    const outcome = await processNextJob(queue, 'sample.ping', 'worker-1', handler);

    expect(outcome).toBe('empty');
    expect(handler).not.toHaveBeenCalled();
  });

  it('marks a successfully handled job completed', async () => {
    const queue = new FakeJobQueue(makeJob());
    const handler = vi.fn().mockResolvedValue(undefined);

    const outcome = await processNextJob(queue, 'sample.ping', 'worker-1', handler);

    expect(outcome).toBe('processed');
    expect(handler).toHaveBeenCalledOnce();
    expect(queue.completed).toEqual(['job-1']);
    expect(queue.failed).toHaveLength(0);
  });

  it('marks a throwing handler failed with an exponential backoff based on attempts', async () => {
    const queue = new FakeJobQueue(makeJob({ attempts: 3 }));
    const handler = vi.fn().mockRejectedValue(new Error('smtp timeout'));

    const before = Date.now();
    const outcome = await processNextJob(queue, 'sample.ping', 'worker-1', handler);

    expect(outcome).toBe('failed');
    expect(queue.failed).toHaveLength(1);
    expect(queue.failed[0]?.errorMessage).toBe('smtp timeout');
    // attempts=3 -> 3^2 * 30s = 270s backoff
    const expectedRetryMs = before + 270_000;
    expect(queue.failed[0]?.nextRetryAt?.getTime()).toBeGreaterThanOrEqual(expectedRetryMs - 1000);
  });

  it('caps backoff at 1 hour for high attempt counts', async () => {
    const queue = new FakeJobQueue(makeJob({ attempts: 50 }));
    const handler = vi.fn().mockRejectedValue(new Error('still down'));

    await processNextJob(queue, 'sample.ping', 'worker-1', handler);

    const retryAt = queue.failed[0]?.nextRetryAt;
    const cappedMs = Date.now() + 3600_000;
    expect(retryAt?.getTime()).toBeLessThanOrEqual(cappedMs + 1000);
  });
});
