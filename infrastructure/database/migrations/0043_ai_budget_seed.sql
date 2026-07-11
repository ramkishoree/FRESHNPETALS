-- Ch.14 §81 Budget Enforcement — 0022 created ai_budgets but no migration
-- ever inserted a row, so AiOrchestrator.execute()'s `if (limit !== null)`
-- check always found no row and silently no-op'd for every single AI call,
-- on every agent, since the feature shipped. Nothing currently stops a
-- traffic spike, a bug, or abuse from running spend arbitrarily high.
--
-- Global monthly ceiling is the real backstop (orchestrator.ts now checks
-- it unconditionally, in addition to whatever scope the caller requests —
-- see server/ai/orchestrator.ts). Per-provider ceilings are additional
-- defense in depth matching the handbook's "Daily/Weekly/Monthly, Per
-- Provider/Agent/Workflow" requirement.
--
-- Figures are deliberately conservative for a single-outlet-growing
-- flower delivery business (target: total infra under ~₹2,500/month,
-- of which AI is one part) — raise them later via the settings table/UI
-- once real usage data exists, not by guessing higher up front.

insert into public.ai_budgets (scope, scope_ref, period, limit_amount, currency)
values
  ('global', null, 'monthly', 20.00, 'USD'),
  ('provider', 'anthropic', 'monthly', 12.00, 'USD'),
  ('provider', 'openai', 'monthly', 5.00, 'USD'),
  ('provider', 'groq', 'monthly', 3.00, 'USD')
on conflict (scope, scope_ref, period) do nothing;
