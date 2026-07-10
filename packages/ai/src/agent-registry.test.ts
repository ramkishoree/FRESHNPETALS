import { describe, expect, it } from 'vitest';
import {
  AI_EMPLOYEES,
  findAgentsByCapability,
  getAgentDefinition,
  isToolGrantedToAgent,
} from './agent-registry';

const DANGEROUS_TOOLS = [
  'Publish Product',
  'Delete Product',
  'Archive Product',
  'Issue Refund',
  'Change Prices',
  'Create Coupon',
  'Modify Inventory',
  'Deploy Website',
];

describe('agent-registry', () => {
  it('ships exactly the 11 v1 employees named in Ch.9 §7', () => {
    expect(AI_EMPLOYEES).toHaveLength(11);
  });

  it('has unique slugs', () => {
    const slugs = AI_EMPLOYEES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('never grants a dangerous/production-mutating tool to any v1 agent (§28 Agent Permission Matrix)', () => {
    for (const agent of AI_EMPLOYEES) {
      for (const dangerous of DANGEROUS_TOOLS) {
        expect(agent.tools).not.toContain(dangerous);
      }
    }
  });

  it('gives every agent at least one capability, one tool, one KPI, and an output schema', () => {
    for (const agent of AI_EMPLOYEES) {
      expect(agent.capabilities.length).toBeGreaterThan(0);
      expect(agent.tools.length).toBeGreaterThan(0);
      expect(agent.kpis.length).toBeGreaterThan(0);
      expect(agent.outputSchema.required).toContain('output');
    }
  });

  it('finds an agent by slug', () => {
    expect(getAgentDefinition('product-manager-ai')?.name).toBe('Product Manager AI');
    expect(getAgentDefinition('does-not-exist')).toBeUndefined();
  });

  it('finds agents by capability', () => {
    const matches = findAgentsByCapability('Blog Writing');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.slug).toBe('blog-writer-ai');
  });

  it('checks whether a tool is granted to an agent', () => {
    const productManager = getAgentDefinition('product-manager-ai')!;
    expect(isToolGrantedToAgent(productManager, 'Save Draft')).toBe(true);
    expect(isToolGrantedToAgent(productManager, 'Publish Product')).toBe(false);
  });
});
