import type { RoutingPolicy } from './model-router';

/**
 * Ch.9 Part 2 (§17-30, "AI Employees Specification") + Part 6 (§114-137,
 * "Capability Registry, Tool Registry & Agent Runtime"). This is the
 * Capability Registry itself: the Orchestrator "should never know Product
 * Manager AI / SEO AI / Marketing AI. Instead it only knows Capabilities"
 * (§115) — every other module resolves an agent by capability or slug
 * through this list rather than hardcoding a persona.
 *
 * Every v1 agent's tool list is deliberately restricted to Read/Generate/
 * Draft/Report tools — none grants a Publish/Delete/Execute tool. This is
 * not a simplification; it is the literal spec (§28 Agent Permission
 * Matrix has no "Yes" in the Publish or Delete column for any of the 9
 * agents it lists, and every per-agent "Forbidden Actions" section
 * repeats it). Nothing in this registry ever calls a production-mutating
 * RPC — a human always performs the actual write with the tools Phase 8
 * already built, using the agent's output as a drafted starting point.
 */

export interface AgentKpi {
  label: string;
  target: string;
}

export interface AgentOutputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
}

export interface AgentDefinition {
  slug: string;
  name: string;
  purpose: string;
  /** A concrete, realistic task instruction — shown in the admin UI so an
   * operator knows what kind of instruction this agent actually expects,
   * rather than guessing from `purpose` alone. */
  exampleTask: string;
  category: string;
  capabilities: string[];
  tools: string[];
  forbiddenActions: string[];
  memoryScopes: string[];
  kpis: AgentKpi[];
  routingPolicy: RoutingPolicy;
  systemPrompt: string;
  outputSchema: AgentOutputSchema;
  /** Completion token ceiling for this agent's runs — an open-ended AI
   * cost risk otherwise, since the OpenAI/Groq adapters let the model use
   * its own (large) default when nothing is set. Omitted means the
   * caller's own default applies; only agents whose real output genuinely
   * needs more (e.g. a 2500+ word article) override it. */
  maxTokens?: number;
}

const SUMMARY_CONFIDENCE_FIELDS = {
  summary: { type: 'string', description: 'One-paragraph human-readable summary of this output.' },
  confidence: { type: 'number', minimum: 0, maximum: 1 },
  reasoning: { type: 'string', description: 'Brief explanation of how the output was derived.' },
};

export const AI_EMPLOYEES: AgentDefinition[] = [
  {
    slug: 'blog-writer-ai',
    name: 'Blog Writer AI',
    purpose: 'Generates high-quality evergreen and trending flower-related content.',
    exampleTask: 'Write an article on the best flowers to send for a housewarming gift in India.',
    category: 'Content',
    // 2500+ word article + outline + FAQs + captions genuinely needs more
    // than the default ceiling — every other agent's output is short
    // enough that the default is plenty. "At least 2500 words" routinely
    // produces 3500-4000+, which at 8000 tokens got cut off mid-JSON in
    // production (confirmed via Vercel runtime logs: the response never
    // reached its closing fence). Claude Sonnet 4.5 supports up to 64k
    // output tokens, so 16000 has real headroom without hitting a model
    // limit.
    maxTokens: 16000,
    capabilities: ['Blog Writing', 'Content SEO'],
    tools: [
      'Read Blog Database',
      'Read Products',
      'SEO Generator',
      'Save Draft',
      'Request Approval',
    ],
    forbiddenActions: ['Publish Blog', 'Delete Blog'],
    memoryScopes: ['Brand', 'SEO', 'Blog', 'Product'],
    kpis: [
      { label: 'Minimum Length', target: '2500 words' },
      { label: 'Approval Rate', target: 'measurable' },
    ],
    // Owner's explicit budget target: $5 should last at least 2 months
    // under standard use (~$2.50/mo). This is now the ONLY agent in the
    // roster (SEO/Marketing/Inventory removed per owner's call — they'd
    // rather use their own ChatGPT/Claude for those), so the full budget
    // is available to it. 'highest_quality' resolves to Claude Sonnet 4.5
    // ($0.003/$0.015 per 1k): a realistic run (~3000 prompt + ~8000
    // completion tokens, well under the 16000 ceiling) costs ~$0.13, and
    // a weekly 3-topic batch (~13 runs/mo) is ~$1.68/mo — comfortably
    // under budget with real quality for long-form SEO content. Only a
    // pathological worst case (every run maxing out 16000 tokens) risks
    // ~$3.24/mo; the enforced $2.50/mo budget cap (ai_budgets, migration
    // 0055) is the real backstop against that, not a lower model tier.
    routingPolicy: 'highest_quality',
    systemPrompt:
      'You are the Blog Writer AI for Fresh & Petals. Write an original, helpful, non-spammy, human-like article ' +
      'of at least 2500 words on the given topic, with natural product recommendations integrated. Produce an ' +
      'outline, the article body, FAQs, a social caption, an email summary, and a featured-image prompt. You ' +
      'never publish or delete a blog post — only draft one.',
    outputSchema: {
      type: 'object',
      properties: {
        ...SUMMARY_CONFIDENCE_FIELDS,
        output: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            outline: { type: 'array', items: { type: 'string' } },
            article: { type: 'string' },
            faqs: { type: 'array', items: { type: 'object' } },
            socialCaption: { type: 'string' },
            emailSummary: { type: 'string' },
            featuredImagePrompt: { type: 'string' },
          },
          required: ['title', 'outline', 'article'],
        },
      },
      required: ['summary', 'confidence', 'reasoning', 'output'],
    },
  },
];

export function getAgentDefinition(slug: string): AgentDefinition | undefined {
  return AI_EMPLOYEES.find((agent) => agent.slug === slug);
}

export function findAgentsByCapability(capability: string): AgentDefinition[] {
  return AI_EMPLOYEES.filter((agent) => agent.capabilities.includes(capability));
}

export function isToolGrantedToAgent(agent: AgentDefinition, toolName: string): boolean {
  return agent.tools.includes(toolName);
}
