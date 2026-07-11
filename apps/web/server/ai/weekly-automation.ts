import 'server-only';
import { isOk, type AppError, type Result } from '@prana/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAiOrchestrator } from './build-orchestrator';
import { runAgentTask, type RunAgentTaskResult } from './agent-runtime';
import { SupabaseAiTaskRepository } from './repositories/supabase-ai-task-repository';
import { logger } from '@/server/logger';

type RunTaskFn = (
  agentSlug: string,
  taskInstructions: string,
) => Promise<Result<RunAgentTaskResult, AppError>>;

const SCHEDULER_JOB_NAME = 'weekly_ai_automation';
const MIN_INTERVAL_DAYS = 6;

/**
 * Ch.9 §105 Weekly Automation Engine — until now, every one of the 11 AI
 * employees only ever ran when an admin manually clicked "Run Task."
 * This is the automatic weekly cadence: a fixed set of recurring,
 * genuinely-standing tasks (an SEO audit is always "audit what's
 * published right now," with no topic to invent), each landing in the
 * Approval Queue exactly like a manual run — nothing here bypasses human
 * review, it only removes the need to remember to click the button.
 *
 * Deliberately NOT included: blog-writer-ai (needs a real topic — an
 * admin's judgment call, not something to auto-pick) and the PRD's
 * non-AI maintenance items (image optimization, broken-link scan,
 * sitemap refresh, Search Console ping) — those are a different kind of
 * job entirely, not an AI employee run.
 */
const WEEKLY_TASKS: { agentSlug: string; taskInstructions: string }[] = [
  {
    agentSlug: 'seo-specialist-ai',
    taskInstructions:
      "Perform this week's SEO audit across all currently published products and blog posts. Identify missing or weak metadata, alt text, schema, and internal linking opportunities.",
  },
  {
    agentSlug: 'inventory-manager-ai',
    taskInstructions:
      "Perform this week's inventory scan. Identify low/critical stock, dead inventory, and fast/slow sellers across all outlets.",
  },
  {
    agentSlug: 'analytics-analyst-ai',
    taskInstructions:
      "Generate this week's business analytics report — revenue trend, conversion trend, and product performance.",
  },
  {
    agentSlug: 'marketing-manager-ai',
    taskInstructions:
      'Propose one campaign or offer idea for the coming week based on current inventory, active offers, and the season.',
  },
  {
    agentSlug: 'operations-assistant-ai',
    taskInstructions:
      "Generate this week's operational briefing — orders, revenue, and pending tasks, with an estimated time to clear them.",
  },
];

export interface WeeklyAutomationOutcome {
  ran: boolean;
  results?: { agentSlug: string; success: boolean; taskId?: string; error?: string }[];
}

interface SchedulerJobRow {
  id: string;
  last_run: string | null;
}

/** True when the weekly job hasn't run in the last MIN_INTERVAL_DAYS —
 * this is what lets a once-daily cron tick still only actually execute
 * the weekly workflow once a week. */
async function isDue(admin: SupabaseClient): Promise<SchedulerJobRow | null> {
  const { data, error } = await admin
    .from('scheduler_jobs')
    .select('id, last_run')
    .eq('name', SCHEDULER_JOB_NAME)
    .eq('enabled', true)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as SchedulerJobRow;
  if (!row.last_run) return row;

  const daysSinceLastRun = (Date.now() - new Date(row.last_run).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLastRun >= MIN_INTERVAL_DAYS ? row : null;
}

/**
 * `runTask` defaults to the real orchestrator/task-repo wiring but is
 * injectable — lets tests exercise the gating + multi-agent aggregation
 * logic here without needing to fake the entire AI provider stack (that's
 * already covered by agent-runtime.test.ts and orchestrator.test.ts).
 */
export async function runWeeklyAutomationIfDue(
  admin: SupabaseClient,
  runTask: RunTaskFn = (agentSlug, taskInstructions) => {
    const orchestrator = buildAiOrchestrator(admin);
    const taskRepo = new SupabaseAiTaskRepository(admin);
    return runAgentTask({ orchestrator, taskRepo }, { agentSlug, taskInstructions });
  },
): Promise<WeeklyAutomationOutcome> {
  const dueRow = await isDue(admin);
  if (!dueRow) return { ran: false };

  const results: WeeklyAutomationOutcome['results'] = [];
  for (const task of WEEKLY_TASKS) {
    try {
      const result = await runTask(task.agentSlug, task.taskInstructions);
      if (isOk(result)) {
        results.push({ agentSlug: task.agentSlug, success: true, taskId: result.value.taskId });
      } else {
        results.push({
          agentSlug: task.agentSlug,
          success: false,
          error: result.error.message,
        });
        logger.error('worker.weekly_automation.agent_failed', {
          agentSlug: task.agentSlug,
          message: result.error.message,
        });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      results.push({ agentSlug: task.agentSlug, success: false, error: message });
      logger.error('worker.weekly_automation.agent_threw', { agentSlug: task.agentSlug, message });
    }
  }

  await admin
    .from('scheduler_jobs')
    .update({ last_run: new Date().toISOString() })
    .eq('id', dueRow.id);

  logger.info('worker.weekly_automation.completed', {
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
  });

  return { ran: true, results };
}
