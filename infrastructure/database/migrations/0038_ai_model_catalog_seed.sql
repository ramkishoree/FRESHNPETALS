-- Ch.14 §68 Model Registry — "Only approved models may be used in
-- production." Phase 6 built the table and the registry-reading code
-- path (SupabaseAiModelRepository.listApproved), but never seeded a row:
-- with zero approved models, every AiOrchestrator.execute() call would
-- fail with 'no_model_available' regardless of how correct Phase 11's
-- agent logic is. This is the fix — one approved model per configured
-- provider (Ch.9 §53's routing tiers: Groq = fast, OpenAI = reasoning/
-- balanced, Anthropic = highest-quality/long-form).

insert into public.ai_models (
  provider, model_name, model_version, context_window,
  supports_structured_output, supports_tool_calling, supports_vision, supports_embeddings,
  input_cost_per_1k, output_cost_per_1k, avg_latency_ms, approval_status, health
) values
  ('groq', 'llama-3.3-70b-versatile', null, 128000, true, true, false, false, 0.00059, 0.00079, 400, 'approved', 'healthy'),
  ('openai', 'gpt-4o-mini', null, 128000, true, true, true, true, 0.00015, 0.0006, 900, 'approved', 'healthy'),
  ('anthropic', 'claude-sonnet-4-5-20250929', null, 200000, true, false, true, false, 0.003, 0.015, 1800, 'approved', 'healthy')
on conflict (provider, model_name, model_version) do nothing;
