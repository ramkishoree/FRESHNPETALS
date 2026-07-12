-- Owner's explicit target: $5 should cover at least 2 months of standard
-- use (~$2.50/month). 0043 seeded a $20/month global ceiling sized for
-- "under ~₹2,500/month total infra" — real but much looser than this
-- specific budget promise. The actual fix is the routing-policy change
-- in packages/ai/src/agent-registry.ts (blog-writer-ai/marketing-manager-ai
-- moved off Claude Sonnet 4.5 onto gpt-4o-mini, ~25x cheaper) — realistic
-- spend under the new routing is well under $1/month. This tightens the
-- enforced backstop to match the stated promise, not just the optimistic
-- estimate, so a bug or spike still can't quietly blow past it.
update public.ai_budgets
set limit_amount = 2.50
where scope = 'global' and scope_ref is null and period = 'monthly';
