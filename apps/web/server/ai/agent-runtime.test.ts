// @vitest-environment node
import { isErr, isOk } from '@prana/core';
import { describe, expect, it, vi } from 'vitest';
import { runAgentTask } from './agent-runtime';
import { AiOrchestrationError, type AiOrchestrator } from './orchestrator';

function makeTaskRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    resolveAgentId: vi.fn().mockResolvedValue('agent-db-id'),
    create: vi.fn().mockResolvedValue('task-id'),
    markWaitingApproval: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    list: vi.fn(),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('runAgentTask', () => {
  it('rejects an unknown agent slug before creating any task', async () => {
    const taskRepo = makeTaskRepo();
    const orchestrator = { execute: vi.fn() } as unknown as AiOrchestrator;

    const result = await runAgentTask(
      { orchestrator, taskRepo },
      { agentSlug: 'not-a-real-agent', taskInstructions: 'do something' },
    );

    expect(isErr(result)).toBe(true);
    expect(taskRepo.create).not.toHaveBeenCalled();
  });

  it('rejects when the agent is not registered in the database', async () => {
    const taskRepo = makeTaskRepo({ resolveAgentId: vi.fn().mockResolvedValue(null) });
    const orchestrator = { execute: vi.fn() } as unknown as AiOrchestrator;

    const result = await runAgentTask(
      { orchestrator, taskRepo },
      { agentSlug: 'seo-specialist-ai', taskInstructions: 'draft a rose bouquet listing' },
    );

    expect(isErr(result)).toBe(true);
    expect(taskRepo.create).not.toHaveBeenCalled();
  });

  it('runs the happy path: creates the task, executes, and lands it in waiting_approval', async () => {
    const taskRepo = makeTaskRepo();
    const structuredOutput = {
      summary: 'Drafted a listing.',
      confidence: 0.9,
      reasoning: 'Used the provided task instructions.',
      output: { productName: 'Rose Bliss' },
    };
    const orchestrator = {
      execute: vi.fn().mockResolvedValue({
        text: JSON.stringify(structuredOutput),
        provider: 'openai',
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 50,
        costUsd: 0.001,
      }),
    } as unknown as AiOrchestrator;

    const result = await runAgentTask(
      { orchestrator, taskRepo },
      { agentSlug: 'seo-specialist-ai', taskInstructions: 'draft a rose bouquet listing' },
    );

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ taskId: 'task-id', status: 'waiting_approval' });
    }
    expect(taskRepo.markWaitingApproval).toHaveBeenCalledWith(
      'task-id',
      expect.objectContaining({ draft: structuredOutput.output, confidence: 0.9 }),
    );
    expect(orchestrator.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        promptName: 'seo-specialist-ai',
        agentId: 'agent-db-id',
        taskId: 'task-id',
      }),
    );
  });

  it('marks the task failed and returns a business-rule error on a kill-switch block', async () => {
    const taskRepo = makeTaskRepo();
    const orchestrator = {
      execute: vi
        .fn()
        .mockRejectedValue(
          new AiOrchestrationError('kill_switch', 'Blocked by agent kill switch.'),
        ),
    } as unknown as AiOrchestrator;

    const result = await runAgentTask(
      { orchestrator, taskRepo },
      { agentSlug: 'seo-specialist-ai', taskInstructions: 'draft a rose bouquet listing' },
    );

    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.httpStatus).toBe(409);
    expect(taskRepo.markFailed).toHaveBeenCalledWith(
      'task-id',
      expect.stringContaining('kill switch'),
    );
  });

  it('marks the task failed when the model returns invalid JSON', async () => {
    const taskRepo = makeTaskRepo();
    const orchestrator = {
      execute: vi.fn().mockResolvedValue({
        text: 'not valid json',
        provider: 'openai',
        model: 'gpt-4o-mini',
        promptTokens: 10,
        completionTokens: 5,
        costUsd: 0.0001,
      }),
    } as unknown as AiOrchestrator;

    const result = await runAgentTask(
      { orchestrator, taskRepo },
      { agentSlug: 'seo-specialist-ai', taskInstructions: 'draft a rose bouquet listing' },
    );

    expect(isErr(result)).toBe(true);
    expect(taskRepo.markFailed).toHaveBeenCalled();
  });
});
