/**
 * Ch.14 §19-§22: prompts are managed centrally, immutable once published,
 * and assembled dynamically in a fixed order (§21). This module is the
 * pure assembly function — the registry (which version is "current" for a
 * given prompt name, stored in Postgres) lives in
 * apps/web/server/ai/repositories, same domain/infrastructure split as
 * every other package.
 */

export type PromptStatus =
  'draft' | 'review' | 'approved' | 'published' | 'deprecated' | 'archived';

export interface PromptParts {
  systemInstructions: string;
  businessRules?: string;
  brandGuidelines?: string;
  retrievedMemory?: string;
  knowledgeContext?: string;
  taskInstructions: string;
  outputSchema?: string;
  validationRules?: string;
}

const SECTION_ORDER: { key: keyof PromptParts; label: string }[] = [
  { key: 'systemInstructions', label: 'System Instructions' },
  { key: 'businessRules', label: 'Business Rules' },
  { key: 'brandGuidelines', label: 'Brand Guidelines' },
  { key: 'retrievedMemory', label: 'Retrieved Memory' },
  { key: 'knowledgeContext', label: 'Knowledge Context' },
  { key: 'taskInstructions', label: 'Task Instructions' },
  { key: 'outputSchema', label: 'Output Schema' },
  { key: 'validationRules', label: 'Validation Rules' },
];

/** Ch.14 §21's exact section order; missing optional sections are skipped
 * rather than emitted empty. */
export function assemblePrompt(parts: PromptParts): string {
  return SECTION_ORDER.map(({ key, label }) => {
    const value = parts[key];
    return value ? `## ${label}\n${value}` : null;
  })
    .filter((section): section is string => section !== null)
    .join('\n\n');
}
