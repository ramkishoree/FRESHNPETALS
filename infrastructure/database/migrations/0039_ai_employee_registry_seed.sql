-- Ch.9 Part 2 (§17-30, AI Employees Specification) + Part 6 (§114-137,
-- Capability Registry & Tool Registry). Phase 3 built every table this
-- migration writes into; this is the seed data that turns them from an
-- empty schema into the 11 v1 AI employees. Tool/capability names are
-- shared across agents where the underlying capability is identical
-- (e.g. "Read Products", "Report Generator") — the unique constraint on
-- ai_capabilities.name/ai_tools.name plus `on conflict do nothing` keeps
-- a second agent's insert from erroring instead of reusing the row.
--
-- No v1 agent is granted a Publish/Delete/Execute-class tool — see
-- packages/ai/src/agent-registry.ts's own note on why (§28 Agent
-- Permission Matrix, and every per-agent "Forbidden Actions" section).

insert into public.ai_agents (name, slug, description, status, preferred_model, fallback_model) values
  ('Product Manager AI', 'product-manager-ai', 'Assists in creating, improving, organizing and publishing products. Never publishes automatically.', 'active', 'gpt-4o-mini', 'llama-3.3-70b-versatile'),
  ('SEO Specialist AI', 'seo-specialist-ai', 'Maintains technical and on-page SEO health.', 'active', 'llama-3.3-70b-versatile', 'gpt-4o-mini'),
  ('Blog Writer AI', 'blog-writer-ai', 'Generates high-quality evergreen and trending flower-related content.', 'active', 'claude-sonnet-4-5-20250929', 'gpt-4o-mini'),
  ('Marketing Manager AI', 'marketing-manager-ai', 'Generates campaigns that increase revenue.', 'active', 'claude-sonnet-4-5-20250929', 'gpt-4o-mini'),
  ('Inventory Manager AI', 'inventory-manager-ai', 'Optimizes inventory before stock problems occur.', 'active', 'llama-3.3-70b-versatile', 'gpt-4o-mini'),
  ('Pricing Analyst AI', 'pricing-analyst-ai', 'Optimizes pricing while maintaining profitability.', 'active', 'gpt-4o-mini', 'llama-3.3-70b-versatile'),
  ('Analytics Analyst AI', 'analytics-analyst-ai', 'Transforms analytics into actionable recommendations.', 'active', 'gpt-4o-mini', 'llama-3.3-70b-versatile'),
  ('Customer Insights AI', 'customer-insights-ai', 'Understands customer behaviour.', 'active', 'gpt-4o-mini', 'llama-3.3-70b-versatile'),
  ('Review Manager AI', 'review-manager-ai', 'Maintains trust through review analysis.', 'active', 'llama-3.3-70b-versatile', 'gpt-4o-mini'),
  ('Automation Coordinator AI', 'automation-coordinator-ai', 'Manages recurring AI workflows.', 'active', 'llama-3.3-70b-versatile', 'gpt-4o-mini'),
  ('Operations Assistant AI', 'operations-assistant-ai', 'Becomes the administrator''s daily assistant.', 'active', 'llama-3.3-70b-versatile', 'gpt-4o-mini')
on conflict (slug) do nothing;

insert into public.ai_capabilities (name, category, risk_level, approval_required) values
  ('Product Creation', 'Commerce', 'advisory', true),
  ('Product SEO', 'SEO', 'advisory', true),
  ('Product Categorization', 'Commerce', 'advisory', true),
  ('Product Recommendations', 'Commerce', 'informational', true),
  ('Product Metadata', 'Commerce', 'advisory', true),
  ('SEO Audit', 'SEO', 'informational', true),
  ('Schema Generation', 'SEO', 'advisory', true),
  ('Metadata Optimization', 'SEO', 'advisory', true),
  ('Internal Linking', 'SEO', 'advisory', true),
  ('Blog Writing', 'Content', 'advisory', true),
  ('Content SEO', 'Content', 'advisory', true),
  ('Campaign Creation', 'Marketing', 'advisory', true),
  ('Offer Suggestion', 'Marketing', 'advisory', true),
  ('Inventory Monitoring', 'Inventory', 'informational', true),
  ('Demand Prediction', 'Inventory', 'informational', true),
  ('Pricing Optimization', 'Finance', 'advisory', true),
  ('Business Analysis', 'Analytics', 'informational', true),
  ('Revenue Reporting', 'Analytics', 'informational', true),
  ('Customer Behaviour Analysis', 'Analytics', 'informational', true),
  ('Review Moderation', 'Customer Service', 'advisory', true),
  ('Trust Analysis', 'Customer Service', 'informational', true),
  ('Workflow Coordination', 'Automation', 'informational', true),
  ('Daily Briefing', 'Operations', 'informational', true),
  ('Task Summarization', 'Operations', 'informational', true)
on conflict (name) do nothing;

insert into public.ai_tools (name, description, tool_type, permission_level, danger_level, active) values
  ('Read Products', 'Read product catalog data.', 'read', 'read', 'informational', true),
  ('Read Categories', 'Read category tree.', 'read', 'read', 'informational', true),
  ('Read Collections', 'Read collections.', 'read', 'read', 'informational', true),
  ('Read Inventory', 'Read inventory levels across outlets.', 'read', 'read', 'informational', true),
  ('Read Orders', 'Read order history.', 'read', 'read', 'informational', true),
  ('Read Analytics', 'Read aggregate analytics data.', 'read', 'read', 'informational', true),
  ('Read Customers', 'Read customer profile/behaviour data.', 'read', 'read', 'informational', true),
  ('Read Reviews', 'Read product reviews.', 'read', 'read', 'informational', true),
  ('Read Blog Database', 'Read published/draft blog posts.', 'read', 'read', 'informational', true),
  ('SEO Generator', 'Generate SEO metadata (titles, descriptions, keywords).', 'generate', 'draft', 'advisory', true),
  ('Schema Generator', 'Generate structured-data schema.', 'generate', 'draft', 'advisory', true),
  ('Slug Generator', 'Generate a URL-safe slug.', 'generate', 'draft', 'advisory', true),
  ('Internal Link Engine', 'Suggest internal links.', 'analyze', 'draft', 'advisory', true),
  ('Image Analyzer', 'Analyze images for missing alt text/optimization.', 'analyze', 'read', 'informational', true),
  ('Campaign Generator', 'Draft a marketing campaign proposal.', 'generate', 'draft', 'advisory', true),
  ('Pricing Calculator', 'Compute pricing scenarios and revenue impact.', 'analyze', 'read', 'advisory', true),
  ('Report Generator', 'Generate a structured report from read-only data.', 'generate', 'draft', 'informational', true),
  ('Save Draft', 'Persist the generated draft to the task record for administrator review.', 'create_draft', 'draft', 'advisory', true),
  ('Request Approval', 'Enter the output into the Approval Queue.', 'approve', 'draft', 'advisory', true)
on conflict (name) do nothing;

insert into public.ai_agent_capabilities (agent_id, capability_id)
select a.id, c.id from public.ai_agents a join public.ai_capabilities c on true
where (a.slug, c.name) in (
  ('product-manager-ai', 'Product Creation'),
  ('product-manager-ai', 'Product SEO'),
  ('product-manager-ai', 'Product Categorization'),
  ('product-manager-ai', 'Product Recommendations'),
  ('product-manager-ai', 'Product Metadata'),
  ('seo-specialist-ai', 'SEO Audit'),
  ('seo-specialist-ai', 'Schema Generation'),
  ('seo-specialist-ai', 'Metadata Optimization'),
  ('seo-specialist-ai', 'Internal Linking'),
  ('blog-writer-ai', 'Blog Writing'),
  ('blog-writer-ai', 'Content SEO'),
  ('marketing-manager-ai', 'Campaign Creation'),
  ('marketing-manager-ai', 'Offer Suggestion'),
  ('inventory-manager-ai', 'Inventory Monitoring'),
  ('inventory-manager-ai', 'Demand Prediction'),
  ('pricing-analyst-ai', 'Pricing Optimization'),
  ('analytics-analyst-ai', 'Business Analysis'),
  ('analytics-analyst-ai', 'Revenue Reporting'),
  ('customer-insights-ai', 'Customer Behaviour Analysis'),
  ('review-manager-ai', 'Review Moderation'),
  ('review-manager-ai', 'Trust Analysis'),
  ('automation-coordinator-ai', 'Workflow Coordination'),
  ('operations-assistant-ai', 'Daily Briefing'),
  ('operations-assistant-ai', 'Task Summarization')
)
on conflict do nothing;

insert into public.ai_agent_tools (agent_id, tool_id)
select a.id, t.id from public.ai_agents a join public.ai_tools t on true
where (a.slug, t.name) in (
  ('product-manager-ai', 'Read Products'), ('product-manager-ai', 'Read Categories'), ('product-manager-ai', 'Read Collections'),
  ('product-manager-ai', 'SEO Generator'), ('product-manager-ai', 'Schema Generator'), ('product-manager-ai', 'Slug Generator'),
  ('product-manager-ai', 'Save Draft'), ('product-manager-ai', 'Request Approval'),

  ('seo-specialist-ai', 'Read Products'), ('seo-specialist-ai', 'Read Blog Database'), ('seo-specialist-ai', 'SEO Generator'),
  ('seo-specialist-ai', 'Schema Generator'), ('seo-specialist-ai', 'Internal Link Engine'), ('seo-specialist-ai', 'Image Analyzer'),
  ('seo-specialist-ai', 'Save Draft'), ('seo-specialist-ai', 'Request Approval'),

  ('blog-writer-ai', 'Read Blog Database'), ('blog-writer-ai', 'Read Products'), ('blog-writer-ai', 'SEO Generator'),
  ('blog-writer-ai', 'Save Draft'), ('blog-writer-ai', 'Request Approval'),

  ('marketing-manager-ai', 'Read Inventory'), ('marketing-manager-ai', 'Read Analytics'), ('marketing-manager-ai', 'Campaign Generator'),
  ('marketing-manager-ai', 'Save Draft'), ('marketing-manager-ai', 'Request Approval'),

  ('inventory-manager-ai', 'Read Inventory'), ('inventory-manager-ai', 'Read Orders'), ('inventory-manager-ai', 'Read Analytics'),
  ('inventory-manager-ai', 'Report Generator'),

  ('pricing-analyst-ai', 'Read Products'), ('pricing-analyst-ai', 'Read Orders'), ('pricing-analyst-ai', 'Read Analytics'),
  ('pricing-analyst-ai', 'Pricing Calculator'), ('pricing-analyst-ai', 'Report Generator'),

  ('analytics-analyst-ai', 'Read Orders'), ('analytics-analyst-ai', 'Read Analytics'), ('analytics-analyst-ai', 'Read Customers'),
  ('analytics-analyst-ai', 'Report Generator'),

  ('customer-insights-ai', 'Read Customers'), ('customer-insights-ai', 'Read Orders'), ('customer-insights-ai', 'Read Analytics'),
  ('customer-insights-ai', 'Report Generator'),

  ('review-manager-ai', 'Read Reviews'), ('review-manager-ai', 'Report Generator'),

  ('automation-coordinator-ai', 'Read Analytics'), ('automation-coordinator-ai', 'Read Orders'), ('automation-coordinator-ai', 'Report Generator'),

  ('operations-assistant-ai', 'Read Orders'), ('operations-assistant-ai', 'Read Products'), ('operations-assistant-ai', 'Read Analytics'),
  ('operations-assistant-ai', 'Report Generator')
)
on conflict do nothing;

-- One published prompt per agent (Ch.9 §46/§129 Prompt Versioning —
-- "no prompt changes are lost"; version 1 here is the first). System
-- prompt text and expected_output_schema mirror
-- packages/ai/src/agent-registry.ts's systemPrompt/outputSchema exactly
-- — that TS file is the single source of truth for both; this seed just
-- makes them visible/versioned in the Prompt Registry admin API.
insert into public.ai_prompts (name, purpose, current_version, status) values
  ('product-manager-ai', 'Product content drafting.', 1, 'published'),
  ('seo-specialist-ai', 'SEO audit and metadata drafting.', 1, 'published'),
  ('blog-writer-ai', 'Blog article drafting.', 1, 'published'),
  ('marketing-manager-ai', 'Campaign proposal drafting.', 1, 'published'),
  ('inventory-manager-ai', 'Inventory monitoring report.', 1, 'published'),
  ('pricing-analyst-ai', 'Pricing proposal drafting.', 1, 'published'),
  ('analytics-analyst-ai', 'Business analytics report.', 1, 'published'),
  ('customer-insights-ai', 'Customer behaviour report.', 1, 'published'),
  ('review-manager-ai', 'Review trust analysis.', 1, 'published'),
  ('automation-coordinator-ai', 'Workflow status report.', 1, 'published'),
  ('operations-assistant-ai', 'Daily/weekly operations briefing.', 1, 'published')
on conflict (name) do nothing;

insert into public.ai_prompt_versions (prompt_id, version, model_family, system_prompt)
select p.id, 1, 'general',
  case p.name
    when 'product-manager-ai' then 'You are the Product Manager AI for Fresh & Petals, a premium flower delivery ecommerce business. Generate a complete product content draft (name, descriptions, SEO fields, tags, care instructions) from the administrator''s task instructions and any provided memory/context. You never set a price, never modify inventory, never create offers, and never publish anything — you only produce a draft for administrator review.'
    when 'seo-specialist-ai' then 'You are the SEO Specialist AI for Fresh & Petals. Scan the provided product/blog context for missing or weak metadata, alt text, schema, and internal linking opportunities. Produce a prioritized fix list and updated metadata suggestions. You never delete pages, publish changes, or modify URLs — only propose fixes.'
    when 'blog-writer-ai' then 'You are the Blog Writer AI for Fresh & Petals. Write an original, helpful, non-spammy, human-like article of at least 2500 words on the given topic, with natural product recommendations integrated. Produce an outline, the article body, FAQs, a social caption, an email summary, and a featured-image prompt. You never publish or delete a blog post — only draft one.'
    when 'marketing-manager-ai' then 'You are the Marketing Manager AI for Fresh & Petals. Propose a campaign (name, objective, audience, products, offer suggestion, copy, suggested start date, estimated ROI) from current inventory, offers, season and the task instructions. You never publish a campaign, create an offer, or send a broadcast yourself — only propose one for administrator approval.'
    when 'inventory-manager-ai' then 'You are the Inventory Manager AI for Fresh & Petals. Review the provided inventory and order context to identify low/critical stock, dead inventory, fast/slow sellers, and seasonal demand shifts. Produce a restocking recommendation report. You never modify inventory or create a purchase order yourself.'
    when 'pricing-analyst-ai' then 'You are the Pricing Analyst AI for Fresh & Petals. From historical sales, conversion, inventory and customer-behaviour context, propose price changes, bundles, free-gift or free-delivery-threshold ideas, with an estimated revenue impact for each. You never change a price yourself — only propose changes for administrator approval.'
    when 'analytics-analyst-ai' then 'You are the Analytics Analyst AI for Fresh & Petals. From the provided revenue/order/customer context, produce a business report covering revenue trend, conversion trend, traffic and product analysis, and concrete recommendations.'
    when 'customer-insights-ai' then 'You are the Customer Insights AI for Fresh & Petals. Analyze the provided customer behaviour context (wishlist trends, search behaviour, abandoned carts, repeat buyers, occasion preferences) and recommend new categories, bundles, offers, or campaigns worth pursuing.'
    when 'review-manager-ai' then 'You are the Review Manager AI for Fresh & Petals. Analyze the provided reviews for negative trends, summarize sentiment, flag reviews that look fake or suspicious, and surface reviews worth featuring. You never delete or publish a review yourself.'
    when 'automation-coordinator-ai' then 'You are the Automation Coordinator AI for Fresh & Petals. Summarize the status of this week''s and this month''s recurring AI workflows (SEO audit, blog generation, analytics report, inventory scan, campaign suggestions) and surface anything overdue or blocked.'
    when 'operations-assistant-ai' then 'You are the Operations Assistant AI for Fresh & Petals. Summarize store status, orders, revenue, and pending tasks into a short, friendly daily/weekly briefing addressed to the administrator, ending with an estimated time to complete the outstanding work.'
  end
from public.ai_prompts p
on conflict (prompt_id, version) do nothing;
