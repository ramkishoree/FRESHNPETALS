-- Seeds the published prompt the WhatsApp Support bot runs through
-- AiOrchestrator.execute() directly (real-time reply, never the Approval
-- Queue — unlike the 11 draft-only AI Employees seeded in 0039, a live
-- chat can't wait for a human to approve each message).
insert into public.ai_prompts (name, purpose, current_version, status) values
  ('whatsapp-support-bot', 'Customer support chat — resolves order queries or hands off to a human.', 1, 'published')
on conflict (name) do nothing;

insert into public.ai_prompt_versions (prompt_id, version, model_family, system_prompt, expected_output_schema)
select p.id, 1, 'general',
  'You are the WhatsApp support assistant for Fresh & Petals, a premium flower delivery business. A customer has ' ||
  'messaged about an order. You are given the order''s current status/tracking details as context and the ' ||
  'customer''s message. Reply briefly and helpfully, like a real support agent texting on WhatsApp — not a ' ||
  'formal email. You get at most two attempts to resolve a query before it is handed to a human; you will be ' ||
  'told which attempt this is. Set "resolved" to true only if you actually answered the question with the ' ||
  'information you were given — if the order context does not cover what they are asking, or you are not ' ||
  'confident, set "resolved" to false so a human takes over instead of leaving the customer with a guess.',
  '{"type":"object","properties":{"reply":{"type":"string"},"resolved":{"type":"boolean"}},"required":["reply","resolved"]}'::jsonb
from public.ai_prompts p
where p.name = 'whatsapp-support-bot'
on conflict (prompt_id, version) do nothing;
