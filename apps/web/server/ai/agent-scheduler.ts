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
 * Ch.9 autonomous scheduling — Blog Writer proposes a weekly batch. Every
 * run still lands in the Approval Queue exactly like a manual run (Ch.9
 * §11) — this only removes the need to remember to click the button, it
 * does not auto-publish anything.
 *
 * SEO Specialist / Marketing Manager / Inventory Manager were removed
 * from the roster entirely (owner's explicit call — Blog Writer is the
 * only agent worth the API cost for this business; SEO/marketing ideas
 * come from the owner's own ChatGPT/Claude instead). Their scheduler_jobs
 * rows are disabled via migration, not deleted, so re-adding an agent
 * later doesn't need a new job row.
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

const BLOG_INTERVAL_DAYS = 7;
const WEEKLY_BATCH_SIZE = 3;

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

// How far ahead an Indian festival/gifting occasion has to be before it's
// worth writing about now — long enough that the post is live and
// discoverable before the day arrives, given the weekly batch cadence.
const OCCASION_LOOKAHEAD_DAYS = 21;
// Once an occasion has a topic queued, don't propose it again for this
// long — otherwise "Diwali" would get re-proposed every single week as
// the date gets closer.
const OCCASION_DEDUPE_DAYS = 60;

async function occasionAlreadyCovered(
  admin: SupabaseClient,
  occasionName: string,
): Promise<boolean> {
  const sinceIso = new Date(Date.now() - OCCASION_DEDUPE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from('ai_tasks')
    .select('id')
    .ilike('title', `%${occasionName}%`)
    .gte('created_at', sinceIso)
    .limit(1);
  return (data ?? []).length > 0;
}

/**
 * Owner's explicit ask: "Indian holidays, traditions, and specific event
 * blogs" — upcoming festivals/gifting occasions (server/ai/gifting-
 * occasions.ts, the same calendar the removed marketing-manager-ai used)
 * get first claim on the week's topic slots, falling back to the
 * evergreen rotating pool once occasions are exhausted or already
 * covered. `excludeTopics` keeps a single run (the weekly batch, or one
 * reject-triggered regeneration) from picking the same topic twice.
 */
export async function pickWeeklyBlogTopics(
  admin: SupabaseClient,
  count: number,
  excludeTopics: string[] = [],
): Promise<string[]> {
  const excluded = new Set(excludeTopics);
  const topics: string[] = [];

  const upcoming = getUpcomingGiftingOccasions(new Date(), OCCASION_LOOKAHEAD_DAYS);
  for (const occasion of upcoming) {
    if (topics.length >= count) break;
    const topic = `${occasion.name} flower gifting guide — ${occasion.angle}`;
    if (excluded.has(topic)) continue;
    if (await occasionAlreadyCovered(admin, occasion.name)) continue;
    topics.push(topic);
    excluded.add(topic);
  }

  let poolIndex = currentIsoWeek();
  for (let i = 0; i < BLOG_TOPIC_POOL.length * 2 && topics.length < count; i++) {
    const candidate = BLOG_TOPIC_POOL[poolIndex % BLOG_TOPIC_POOL.length]!;
    poolIndex++;
    if (excluded.has(candidate)) continue;
    topics.push(candidate);
    excluded.add(candidate);
  }

  return topics;
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

  const blogJob = await getDueJob(admin, 'blog_weekly_batch', BLOG_INTERVAL_DAYS);
  if (blogJob) {
    const topics = await pickWeeklyBlogTopics(admin, WEEKLY_BATCH_SIZE);
    const results = [];
    for (const topic of topics) {
      results.push(await runOne(runTask, 'blog-writer-ai', `Write an article on: ${topic}`));
    }
    await markRun(admin, blogJob.id);
    outcomes.push({ jobName: 'blog_weekly_batch', ran: true, results });
  }

  return outcomes;
}
