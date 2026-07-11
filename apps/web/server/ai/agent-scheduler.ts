import 'server-only';
import { isOk, type AppError, type Result } from '@prana/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildAiOrchestrator } from './build-orchestrator';
import { runAgentTask, type RunAgentTaskResult } from './agent-runtime';
import { SupabaseAiTaskRepository } from './repositories/supabase-ai-task-repository';
import { getUpcomingGiftingOccasions } from './gifting-occasions';
import { logger } from '@/server/logger';

type RunTaskFn = (
  agentSlug: string,
  taskInstructions: string,
) => Promise<Result<RunAgentTaskResult, AppError>>;

interface SchedulerJobRow {
  id: string;
  name: string;
  last_run: string | null;
}

export interface ScheduledRunOutcome {
  jobName: string;
  ran: boolean;
  results?: { agentSlug: string; success: boolean; taskId?: string; error?: string }[];
}

/**
 * Ch.9 autonomous scheduling — the owner's explicit request: SEO refines
 * itself every 14 days, Blog Writer proposes a weekly batch, Marketing
 * Manager proposes a campaign when a real gifting occasion is coming up,
 * Inventory Manager scans weekly. Every run still lands in the Approval
 * Queue exactly like a manual run (Ch.9 §11) — this only removes the need
 * to remember to click the button, it does not auto-publish anything.
 * Auto-apply-on-WhatsApp-approve is a deliberately separate, not-yet-built
 * piece (needs the WhatsApp Business API live to test end-to-end).
 *
 * Gated behind system_settings.feature_flags.ai_autonomous_scheduling_enabled
 * — a real kill switch, defaults to false, so this migration merely
 * existing doesn't turn agents loose on a schedule.
 */
async function isAutonomousSchedulingEnabled(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'feature_flags')
    .maybeSingle();
  const flags = data?.value as { ai_autonomous_scheduling_enabled?: boolean } | undefined;
  return flags?.ai_autonomous_scheduling_enabled === true;
}

async function getDueJob(
  admin: SupabaseClient,
  jobName: string,
  minIntervalDays: number,
): Promise<SchedulerJobRow | null> {
  const { data, error } = await admin
    .from('scheduler_jobs')
    .select('id, name, last_run')
    .eq('name', jobName)
    .eq('enabled', true)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as SchedulerJobRow;
  if (!row.last_run) return row;

  const daysSinceLastRun = (Date.now() - new Date(row.last_run).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLastRun >= minIntervalDays ? row : null;
}

async function markRun(admin: SupabaseClient, jobId: string): Promise<void> {
  await admin.from('scheduler_jobs').update({ last_run: new Date().toISOString() }).eq('id', jobId);
}

async function runOne(
  runTask: RunTaskFn,
  agentSlug: string,
  taskInstructions: string,
): Promise<{ agentSlug: string; success: boolean; taskId?: string; error?: string }> {
  try {
    const result = await runTask(agentSlug, taskInstructions);
    if (isOk(result)) return { agentSlug, success: true, taskId: result.value.taskId };
    logger.error('worker.agent_scheduler.agent_failed', {
      agentSlug,
      message: result.error.message,
    });
    return { agentSlug, success: false, error: result.error.message };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    logger.error('worker.agent_scheduler.agent_threw', { agentSlug, message });
    return { agentSlug, success: false, error: message };
  }
}

const SEO_INTERVAL_DAYS = 14;
const BLOG_INTERVAL_DAYS = 7;
const INVENTORY_INTERVAL_DAYS = 7;
const MARKETING_CHECK_INTERVAL_DAYS = 1;
const MARKETING_LOOKAHEAD_DAYS = 14;

// Rotating topic pool for the weekly blog batch — blog-writer-ai has never
// had a topic-selection tool ("needs a real topic, an admin's judgment
// call" per the original weekly-automation.ts), so autonomy here means
// picking from a fixed, reasonable evergreen pool rather than inventing
// topics with no grounding. Deterministic weekly rotation via the current
// ISO week number, not random, so re-running the same week is idempotent.
const BLOG_TOPIC_POOL = [
  'The meaning behind different flower colors and when to send each',
  'How to choose flowers for someone with allergies',
  'Budget-friendly flower gifting ideas that still feel thoughtful',
  'Flowers that last the longest after delivery',
  "A beginner's guide to arranging a store-bought bouquet at home",
  'Flowers for a corporate gift vs. a personal gift — what changes',
  'Seasonal flowers available right now in Lucknow and why they matter',
  "What to say on a card when you don't know what to write",
  "Flower care mistakes that cut a bouquet's life short",
  'How far in advance to order flowers for a same-day surprise',
  'Sympathy flower etiquette — what to send and what to avoid',
  'Why locally sourced flowers are fresher than imported ones',
];

function currentIsoWeek(): number {
  const now = new Date();
  const firstJan = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const days = Math.floor((now.getTime() - firstJan.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(days / 7);
}

/**
 * `runTask` defaults to the real orchestrator/task-repo wiring but is
 * injectable for tests, matching the pattern the old weekly-automation.ts
 * established.
 */
export async function runScheduledAgentsIfDue(
  admin: SupabaseClient,
  runTask: RunTaskFn = (agentSlug, taskInstructions) => {
    const orchestrator = buildAiOrchestrator(admin);
    const taskRepo = new SupabaseAiTaskRepository(admin);
    return runAgentTask({ orchestrator, taskRepo }, { agentSlug, taskInstructions });
  },
): Promise<ScheduledRunOutcome[]> {
  if (!(await isAutonomousSchedulingEnabled(admin))) return [];

  const outcomes: ScheduledRunOutcome[] = [];

  const seoJob = await getDueJob(admin, 'seo_biweekly_refresh', SEO_INTERVAL_DAYS);
  if (seoJob) {
    const result = await runOne(
      runTask,
      'seo-specialist-ai',
      'Run the biweekly SEO refresh: audit all published products and blog posts for missing or weak ' +
        'metadata, alt text, and schema. Prioritize local-search relevance for "flowers near me" and ' +
        '"buy flowers online Lucknow" style queries.',
    );
    await markRun(admin, seoJob.id);
    outcomes.push({ jobName: 'seo_biweekly_refresh', ran: true, results: [result] });
  }

  const blogJob = await getDueJob(admin, 'blog_weekly_batch', BLOG_INTERVAL_DAYS);
  if (blogJob) {
    const weekIndex = currentIsoWeek() % BLOG_TOPIC_POOL.length;
    const topics = [0, 1, 2].map(
      (offset) => BLOG_TOPIC_POOL[(weekIndex + offset) % BLOG_TOPIC_POOL.length]!,
    );
    const results = [];
    for (const topic of topics) {
      results.push(await runOne(runTask, 'blog-writer-ai', `Write an article on: ${topic}`));
    }
    await markRun(admin, blogJob.id);
    outcomes.push({ jobName: 'blog_weekly_batch', ran: true, results });
  }

  const inventoryJob = await getDueJob(admin, 'inventory_weekly_scan', INVENTORY_INTERVAL_DAYS);
  if (inventoryJob) {
    const result = await runOne(
      runTask,
      'inventory-manager-ai',
      "Perform this week's inventory scan. Identify low/critical stock, dead inventory, and fast/slow sellers across all outlets.",
    );
    await markRun(admin, inventoryJob.id);
    outcomes.push({ jobName: 'inventory_weekly_scan', ran: true, results: [result] });
  }

  const marketingJob = await getDueJob(
    admin,
    'marketing_holiday_scan',
    MARKETING_CHECK_INTERVAL_DAYS,
  );
  if (marketingJob) {
    const upcoming = getUpcomingGiftingOccasions(new Date(), MARKETING_LOOKAHEAD_DAYS);
    await markRun(admin, marketingJob.id);
    if (upcoming.length > 0) {
      const nearest = upcoming[0]!;
      const alreadyProposed = await hasRecentTaskForOccasion(admin, nearest.name);
      if (!alreadyProposed) {
        const result = await runOne(
          runTask,
          'marketing-manager-ai',
          `Propose a campaign for the upcoming occasion "${nearest.name}" on ${nearest.date}. ` +
            `Suggested angle: ${nearest.angle}. You may recommend the whole shop, a specific category, or specific products.`,
        );
        outcomes.push({ jobName: 'marketing_holiday_scan', ran: true, results: [result] });
      } else {
        outcomes.push({ jobName: 'marketing_holiday_scan', ran: false });
      }
    } else {
      outcomes.push({ jobName: 'marketing_holiday_scan', ran: false });
    }
  }

  return outcomes;
}

/** Dedupe guard: don't propose the same occasion's campaign twice — checks
 * ai_tasks created in the last 30 days whose title mentions the occasion
 * name (title is taskInstructions.slice(0,120), which always includes the
 * occasion name per the instruction built above). */
async function hasRecentTaskForOccasion(
  admin: SupabaseClient,
  occasionName: string,
): Promise<boolean> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from('ai_tasks')
    .select('id')
    .ilike('title', `%${occasionName}%`)
    .gte('created_at', thirtyDaysAgo)
    .limit(1);
  return (data ?? []).length > 0;
}
