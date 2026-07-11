-- Replaces the single 'weekly_ai_automation' job (0046) with per-agent
-- cadences the owner explicitly asked for: SEO refines every 14 days,
-- blog batch weekly, inventory weekly, marketing checked daily against
-- upcoming gifting occasions (server/ai/gifting-occasions.ts). Disabling
-- rather than deleting the old row preserves its last_run history.
--
-- cron_expression documents intent only — server/ai/agent-scheduler.ts
-- gates by last_run, not a real cron evaluator, since Vercel Hobby's own
-- cron only fires once daily regardless of what's written here.

update public.scheduler_jobs set enabled = false where name = 'weekly_ai_automation';

insert into public.scheduler_jobs (name, cron_expression, enabled, handler, timezone) values
  ('seo_biweekly_refresh', '0 4 */14 * *', true, 'agent_scheduler.seo_biweekly_refresh', 'Asia/Kolkata'),
  ('blog_weekly_batch', '0 4 * * 6', true, 'agent_scheduler.blog_weekly_batch', 'Asia/Kolkata'),
  ('inventory_weekly_scan', '0 4 * * 1', true, 'agent_scheduler.inventory_weekly_scan', 'Asia/Kolkata'),
  ('marketing_holiday_scan', '0 4 * * *', true, 'agent_scheduler.marketing_holiday_scan', 'Asia/Kolkata')
on conflict (name) do nothing;
