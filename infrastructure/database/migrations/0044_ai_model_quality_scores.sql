-- Ch.14 §14 Model Router — 0038 seeded one model per provider but never
-- set metadata.qualityScore, so SupabaseAiModelRepository.mapRow() defaulted
-- every model to the same score (70). model-router.ts's `highest_quality`
-- policy does `c.qualityScore > best.qualityScore` (strict greater-than),
-- so an all-tied pool always keeps whichever row Postgres happened to
-- return first — undefined, query-plan-dependent order, not necessarily
-- Claude. blog-writer-ai and marketing-manager-ai are both explicitly
-- routed to `highest_quality` specifically to reach Claude Sonnet; with
-- ties, they could just as easily land on the cheapest model instead.
--
-- Distinct scores make the comparison unambiguous regardless of row order:
-- Groq (fast/cheap tier) < OpenAI (balanced/reasoning tier) < Anthropic
-- (highest-quality/long-form tier) — matches the routing tiers 0038 itself
-- documents from Ch.9 §53.

update public.ai_models
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('qualityScore', 50)
where provider = 'groq' and model_name = 'llama-3.3-70b-versatile';

update public.ai_models
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('qualityScore', 72)
where provider = 'openai' and model_name = 'gpt-4o-mini';

update public.ai_models
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('qualityScore', 95)
where provider = 'anthropic' and model_name = 'claude-sonnet-4-5-20250929';
