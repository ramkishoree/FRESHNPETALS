import {
  assemblePrompt,
  checkBudget,
  checkKillSwitches,
  estimateTokenCount,
  isWithinContextBudget,
  type KillSwitchState,
  type ModelCandidate,
  type ProviderAdapter,
  type RoutingPolicy,
  scanForPromptInjection,
  selectModel,
} from '@prana/ai';

/**
 * Ch.14 §13 (AI Runtime Pipeline) + §66 (AI Security Architecture): every
 * request passes through every control layer, in order. This class *is*
 * that pipeline for the infrastructure this phase builds — task planning,
 * agent selection, tool execution, and the approval queue are Phase 11
 * concerns (they need real agents/tools, explicitly out of scope here).
 */

export interface BudgetScope {
  scope: 'global' | 'provider' | 'agent' | 'workflow';
  scopeRef: string | null;
  period: 'daily' | 'weekly' | 'monthly';
}

export interface AiRequestInput {
  promptName: string;
  taskInstructions: string;
  businessRules?: string;
  brandGuidelines?: string;
  knowledgeContext?: string;
  memoryQuery?: string;
  routingPolicy: RoutingPolicy;
  requiresStructuredOutput?: boolean;
  jsonSchema?: unknown;
  budgetScope: BudgetScope;
  isCriticalTask?: boolean;
  allowCriticalBudgetOverride?: boolean;
  killSwitchCheck?: { agent?: string; provider?: string; tool?: string; workflow?: string };
  /** Threaded through to `recordCost` for per-agent/per-task cost attribution (Phase 11). */
  agentId?: string;
  taskId?: string;
}

export interface AiRequestResult {
  text: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export type AiOrchestrationErrorReason =
  | 'kill_switch'
  | 'budget_exceeded'
  | 'prompt_injection'
  | 'prompt_not_found'
  | 'no_model_available'
  | 'context_exceeded'
  | 'provider_not_configured'
  | 'provider_failure';

export class AiOrchestrationError extends Error {
  constructor(
    public readonly reason: AiOrchestrationErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'AiOrchestrationError';
  }
}

export interface AiGovernanceRepository {
  getActiveKillSwitches(): Promise<KillSwitchState[]>;
  getBudgetLimit(
    scope: BudgetScope['scope'],
    scopeRef: string | null,
    period: BudgetScope['period'],
  ): Promise<number | null>;
  getCurrentSpend(
    scope: BudgetScope['scope'],
    scopeRef: string | null,
    period: BudgetScope['period'],
  ): Promise<number>;
  recordCost(entry: {
    model: string;
    provider: string;
    promptTokens: number;
    completionTokens: number;
    inputCost: number;
    outputCost: number;
    agentId?: string;
    taskId?: string;
  }): Promise<void>;
}

export interface AiModelRepository {
  listApproved(): Promise<ModelCandidate[]>;
}

export interface AiPromptRepository {
  getPublishedVersion(name: string): Promise<{ systemPrompt: string } | null>;
}

export interface BusinessMemoryRepository {
  search(query: string, limit?: number): Promise<string[]>;
}

export interface AiOrchestratorDeps {
  governanceRepo: AiGovernanceRepository;
  modelRepo: AiModelRepository;
  promptRepo: AiPromptRepository;
  memoryRepo: BusinessMemoryRepository;
  adapters: Record<string, ProviderAdapter>;
}

export class AiOrchestrator {
  constructor(private readonly deps: AiOrchestratorDeps) {}

  async execute(input: AiRequestInput): Promise<AiRequestResult> {
    const switches = await this.deps.governanceRepo.getActiveKillSwitches();
    const killCheck = checkKillSwitches(switches, input.killSwitchCheck ?? {});
    if (killCheck.blocked) {
      throw new AiOrchestrationError(
        'kill_switch',
        `Blocked by ${killCheck.blockedBy} kill switch.`,
      );
    }

    const { scope, scopeRef, period } = input.budgetScope;
    const limit = await this.deps.governanceRepo.getBudgetLimit(scope, scopeRef, period);
    if (limit !== null) {
      const currentSpend = await this.deps.governanceRepo.getCurrentSpend(scope, scopeRef, period);
      const budgetCheck = checkBudget({
        currentSpend,
        limit,
        isCriticalTask: input.isCriticalTask ?? false,
        allowCriticalOverride: input.allowCriticalBudgetOverride ?? false,
      });
      if (!budgetCheck.allowed) {
        throw new AiOrchestrationError(
          'budget_exceeded',
          `AI budget exceeded (${budgetCheck.utilizationPct.toFixed(0)}% of ${period} limit).`,
        );
      }
    }

    const taskScan = scanForPromptInjection(input.taskInstructions);
    if (taskScan.blocked) {
      throw new AiOrchestrationError(
        'prompt_injection',
        `Task input blocked: ${taskScan.categories.join(', ')}.`,
      );
    }

    const memoryResults = input.memoryQuery
      ? await this.deps.memoryRepo.search(input.memoryQuery)
      : [];
    const retrievedMemory = memoryResults.join('\n---\n');
    if (retrievedMemory) {
      const memoryScan = scanForPromptInjection(retrievedMemory);
      if (memoryScan.blocked) {
        throw new AiOrchestrationError(
          'prompt_injection',
          `Retrieved memory blocked (indirect injection): ${memoryScan.categories.join(', ')}.`,
        );
      }
    }

    const promptVersion = await this.deps.promptRepo.getPublishedVersion(input.promptName);
    if (!promptVersion) {
      throw new AiOrchestrationError(
        'prompt_not_found',
        `No published prompt named "${input.promptName}".`,
      );
    }

    const assembledSystemPrompt = assemblePrompt({
      systemInstructions: promptVersion.systemPrompt,
      ...(input.businessRules ? { businessRules: input.businessRules } : {}),
      ...(input.brandGuidelines ? { brandGuidelines: input.brandGuidelines } : {}),
      ...(retrievedMemory ? { retrievedMemory } : {}),
      ...(input.knowledgeContext ? { knowledgeContext: input.knowledgeContext } : {}),
      taskInstructions: input.taskInstructions,
      ...(input.jsonSchema ? { outputSchema: JSON.stringify(input.jsonSchema) } : {}),
    });

    const candidates = await this.deps.modelRepo.listApproved();
    const selected = selectModel(candidates, {
      policy: input.routingPolicy,
      ...(input.requiresStructuredOutput !== undefined
        ? { requiresStructuredOutput: input.requiresStructuredOutput }
        : {}),
    });
    if (!selected) {
      throw new AiOrchestrationError(
        'no_model_available',
        'No approved model available for this request.',
      );
    }

    const estimatedTokens = estimateTokenCount(assembledSystemPrompt + input.taskInstructions);
    if (!isWithinContextBudget(estimatedTokens, selected.contextWindow)) {
      throw new AiOrchestrationError(
        'context_exceeded',
        'Assembled prompt exceeds the context budget.',
      );
    }

    const adapter = this.deps.adapters[selected.provider];
    if (!adapter) {
      throw new AiOrchestrationError(
        'provider_not_configured',
        `No adapter configured for provider "${selected.provider}".`,
      );
    }

    let promptTokens: number;
    let completionTokens: number;
    let text: string;
    try {
      if (input.requiresStructuredOutput) {
        const result = await adapter.generateStructuredOutput<Record<string, unknown>>({
          model: selected.modelName,
          systemPrompt: assembledSystemPrompt,
          messages: [{ role: 'user', content: input.taskInstructions }],
          jsonSchema: input.jsonSchema,
        });
        promptTokens = result.promptTokens;
        completionTokens = result.completionTokens;
        text = JSON.stringify(result.data);
      } else {
        const result = await adapter.generateText({
          model: selected.modelName,
          systemPrompt: assembledSystemPrompt,
          messages: [{ role: 'user', content: input.taskInstructions }],
        });
        promptTokens = result.promptTokens;
        completionTokens = result.completionTokens;
        text = result.text;
      }
    } catch (cause) {
      throw new AiOrchestrationError(
        'provider_failure',
        cause instanceof Error ? cause.message : String(cause),
      );
    }

    const inputCost = (promptTokens / 1000) * selected.inputCostPer1k;
    const outputCost = (completionTokens / 1000) * selected.outputCostPer1k;
    await this.deps.governanceRepo.recordCost({
      model: selected.modelName,
      provider: selected.provider,
      promptTokens,
      completionTokens,
      inputCost,
      outputCost,
      ...(input.agentId ? { agentId: input.agentId } : {}),
      ...(input.taskId ? { taskId: input.taskId } : {}),
    });

    return {
      text,
      provider: selected.provider,
      model: selected.modelName,
      promptTokens,
      completionTokens,
      costUsd: inputCost + outputCost,
    };
  }
}
