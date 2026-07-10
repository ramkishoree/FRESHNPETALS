import { describe, expect, it } from 'vitest';
import { assemblePrompt } from './prompt';

describe('assemblePrompt', () => {
  it('orders sections exactly per Ch.14 §21', () => {
    const result = assemblePrompt({
      systemInstructions: 'You are the SEO assistant.',
      businessRules: 'Never exceed 60 char titles.',
      brandGuidelines: 'Premium, warm, never spammy.',
      retrievedMemory: 'Owner prefers concise copy.',
      knowledgeContext: 'Product: Rose Bouquet, ₹1299.',
      taskInstructions: 'Write a meta description.',
      outputSchema: '{ "title": string, "description": string }',
      validationRules: 'description <= 160 chars.',
    });

    const order = [
      'System Instructions',
      'Business Rules',
      'Brand Guidelines',
      'Retrieved Memory',
      'Knowledge Context',
      'Task Instructions',
      'Output Schema',
      'Validation Rules',
    ];
    const positions = order.map((label) => result.indexOf(`## ${label}`));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every((p) => p !== -1)).toBe(true);
  });

  it('skips missing optional sections rather than emitting them empty', () => {
    const result = assemblePrompt({
      systemInstructions: 'You are the SEO assistant.',
      taskInstructions: 'Write a meta description.',
    });

    expect(result).not.toContain('Business Rules');
    expect(result).not.toContain('Brand Guidelines');
    expect(result).toContain('## System Instructions');
    expect(result).toContain('## Task Instructions');
  });

  it('always includes the two required sections', () => {
    const result = assemblePrompt({
      systemInstructions: 'System.',
      taskInstructions: 'Task.',
    });
    expect(result).toBe('## System Instructions\nSystem.\n\n## Task Instructions\nTask.');
  });
});
