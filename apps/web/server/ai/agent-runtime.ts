import 'server-only';
import {
  BusinessRuleError,
  err,
  ExternalServiceError,
  ok,
  type AppError,
  type Result,
} from '@prana/core';
import { getAgentDefinition } from '@prana/ai';
import { AiOrchestrationError, type AiOrchestrator } from './orchestrator';
import type { SupabaseAiTaskRepository } from './repositories/supabase-ai-task-repository';

export interface RunAgentTaskInput {
  agentSlug: string;
  taskInstructions: string;
  requestedBy?: string;
}

export interface RunAgentTaskResult {
  taskId: string;
  status: 'waiting_approval';
}

interface StructuredAgentOutput {
  summary: string;
  confidence: number;
  reasoning: string;
  output: Record<string, unknown>;
}

// AppError's two client-actionable shapes (BusinessRuleError, configurable
// httpStatus) vs. ops-issue shapes (ExternalServiceError, fixed 502) —
// ExternalServiceError has no httpStatus override, so anything meant to
// surface as 4xx must go through BusinessRuleError instead.
const CLIENT_ACTIONABLE_STATUS: Partial<Record<AiOrchestrationError['reason'], number>> = {
  kill_switch: 409,
  budget_exceeded: 402,
  prompt_injection: 400,
  context_exceeded: 413,
};

/**
 * Ch.9 §125 Agent Runtime ("Receive Task -> Validate Permissions -> Load
 * Memory -> Load Tools -> Execute -> Validate -> Confidence -> Return
 * Result -> Audit"). The Orchestrator (Phase 6) executes the LLM call
 * itself; this is the layer above it that resolves an agent by slug from
 * the Capability Registry (packages/ai), records the `ai_tasks` lifecycle,
 * and always lands a successful run in the Approval Queue — no v1 agent
 * output is ever applied directly (see agent-registry.ts's own note on
 * why).
 */
export async function runAgentTask(
  deps: { orchestrator: AiOrchestrator; taskRepo: SupabaseAiTaskRepository },
  input: RunAgentTaskInput,
): Promise<Result<RunAgentTaskResult, AppError>> {
  const agent = getAgentDefinition(input.agentSlug);
  if (!agent) {
    return err(
      new BusinessRuleError(`Unknown AI employee "${input.agentSlug}".`, { httpStatus: 404 }),
    );
  }

  const agentId = await deps.taskRepo.resolveAgentId(agent.slug);
  if (!agentId) {
    return err(
      new BusinessRuleError(`AI employee "${agent.slug}" is not registered in the database.`, {
        httpStatus: 500,
      }),
    );
  }

  const taskId = await deps.taskRepo.create({
    taskType: 'agent_run',
    title: input.taskInstructions.slice(0, 120),
    assignedAgent: agentId,
    ...(input.requestedBy ? { requestedBy: input.requestedBy } : {}),
    // Regenerate (Ch.9 §11) re-runs from this, not the possibly-truncated
    // title — round-tripped through markWaitingApproval below since that
    // call replaces metadata wholesale rather than merging into it.
    metadata: { taskInstructions: input.taskInstructions },
  });

  try {
    const result = await deps.orchestrator.execute({
      promptName: agent.slug,
      taskInstructions: input.taskInstructions,
      memoryQuery: input.taskInstructions,
      routingPolicy: agent.routingPolicy,
      requiresStructuredOutput: true,
      jsonSchema: agent.outputSchema,
      budgetScope: { scope: 'agent', scopeRef: agent.slug, period: 'monthly' },
      killSwitchCheck: { agent: agent.slug },
      agentId,
      taskId,
    });

    const parsed = JSON.parse(result.text) as StructuredAgentOutput;

    await deps.taskRepo.markWaitingApproval(taskId, {
      taskInstructions: input.taskInstructions,
      draft: parsed.output,
      summary: parsed.summary,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      provider: result.provider,
      model: result.model,
      costUsd: result.costUsd,
    });

    return ok({ taskId, status: 'waiting_approval' });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await deps.taskRepo.markFailed(taskId, message);

    if (cause instanceof AiOrchestrationError) {
      const clientStatus = CLIENT_ACTIONABLE_STATUS[cause.reason];
      if (clientStatus) return err(new BusinessRuleError(message, { httpStatus: clientStatus }));
      return err(new ExternalServiceError(message));
    }
    return err(new ExternalServiceError(`Agent output was not valid JSON: ${message}`));
  }
}
