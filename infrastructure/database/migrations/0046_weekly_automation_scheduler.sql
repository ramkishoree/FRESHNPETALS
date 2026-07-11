-- Ch.9 §105 Weekly Automation Engine — `scheduler_jobs` (0008) existed
-- since the schema was first written but nothing ever seeded a row into
-- it or read from it; every AI employee has been 100% manual-trigger-only
-- since the feature shipped. This seeds the one row the weekly automation
-- worker (server/ai/weekly-automation.ts) checks against.
--
-- cron_expression documents the intent (Mondays 04:00 IST); actual
-- gating is last_run-based, not a real cron evaluator, since Vercel
-- Hobby's own cron only fires once daily regardless.

insert into public.scheduler_jobs (name, cron_expression, enabled, handler, timezone)
values ('weekly_ai_automation', '0 4 * * 1', true, 'automation.weekly_run', 'Asia/Kolkata')
on conflict (name) do nothing;
