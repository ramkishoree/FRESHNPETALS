-- Owner's explicit call: drop the content-generation AI employees
-- (Blog Writer AI and the rest of the never-launched roster) entirely —
-- "bought API tokens will be better utilized in operations" (the
-- WhatsApp customer-support bot, untouched by this migration: it never
-- reads ai_agents/ai_tasks/ai_approvals/scheduler_jobs, it's purely
-- webhook-driven and only shares the generic ai_prompts/ai_models/
-- ai_budgets/ai_cost_tracking infra via its own 'whatsapp-support-bot'
-- prompt row, which this migration preserves).
--
-- Deletion order respects FK constraints: ai_approvals -> ai_tasks ->
-- ai_agents (cascades to ai_agent_capabilities/ai_agent_tools) ->
-- ai_capabilities/ai_tools, then ai_prompts (cascades to
-- ai_prompt_versions) for every prompt except the WhatsApp bot's.
--
-- scheduler_jobs rows are disabled rather than deleted, consistent with
-- 0056's precedent (preserves last_run history for the audit log).
--
-- Blog posts written by the removed agent are deleted per owner's
-- explicit request for a clean slate — blogs.ai_generated is the exact
-- flag apply-agent-output.ts (now deleted) always set to true, and it is
-- the only inserter blogs has ever had, so this scopes correctly to
-- exactly the rows the agent wrote. Cascades to blog_blocks and
-- blog_category_links via their blog_id FK.

delete from public.ai_approvals;
delete from public.ai_tasks;
delete from public.ai_agents;
delete from public.ai_capabilities;
delete from public.ai_tools;

delete from public.ai_prompts where name <> 'whatsapp-support-bot';

update public.scheduler_jobs
set enabled = false
where name in ('seo_biweekly_refresh', 'blog_weekly_batch', 'inventory_weekly_scan', 'marketing_holiday_scan');

delete from public.blogs where ai_generated = true;
