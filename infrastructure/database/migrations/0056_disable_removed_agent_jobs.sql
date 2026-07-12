-- Owner's explicit call: trim the AI roster down to Blog Writer AI only
-- (SEO Specialist / Marketing Manager / Inventory Manager removed from
-- packages/ai/src/agent-registry.ts and server/ai/agent-scheduler.ts —
-- the owner will use their own ChatGPT/Claude for SEO and marketing
-- ideas instead of paying per-run for those agents). Disabling rather
-- than deleting preserves last_run history, same precedent as 0050.

update public.scheduler_jobs
set enabled = false
where name in ('seo_biweekly_refresh', 'inventory_weekly_scan', 'marketing_holiday_scan');
