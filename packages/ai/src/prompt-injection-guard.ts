/**
 * Ch.14 §70/§71 (OWASP LLM01): heuristic, defense-in-depth scanning for the
 * eight named attack shapes. This is pattern-matching, not a trained
 * classifier — it catches the shapes the handbook explicitly names and is
 * meant to run on both direct user input AND retrieved knowledge/memory
 * text (indirect injection specifically arrives via the latter). It is one
 * layer of "Defense in Depth" (Ch.14 §65), not the only one — output
 * validation and the policy engine are separate layers.
 */

export type PromptInjectionCategory =
  | 'instruction_override'
  | 'role_escalation'
  | 'prompt_leakage'
  | 'system_prompt_request'
  | 'data_exfiltration'
  | 'tool_abuse'
  | 'hidden_unicode'
  | 'indirect_injection_marker';

const PATTERNS: { category: PromptInjectionCategory; pattern: RegExp }[] = [
  {
    category: 'instruction_override',
    pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+instructions/i,
  },
  { category: 'instruction_override', pattern: /disregard\s+(the\s+)?(system|above|prior)/i },
  { category: 'role_escalation', pattern: /you\s+are\s+now\s+(a|an)?\s*\w+/i },
  {
    category: 'role_escalation',
    pattern: /act\s+as\s+(an?\s+)?(admin|root|system|developer|unrestricted)/i,
  },
  { category: 'role_escalation', pattern: /pretend\s+(you\s+are|to\s+be)/i },
  { category: 'prompt_leakage', pattern: /reveal\s+(your|the)\s+(system\s+)?prompt/i },
  {
    category: 'prompt_leakage',
    pattern: /print\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
  },
  {
    category: 'system_prompt_request',
    pattern: /what\s+(is|are)\s+your\s+(system\s+)?instructions/i,
  },
  { category: 'system_prompt_request', pattern: /repeat\s+(the\s+text\s+)?above/i },
  {
    category: 'data_exfiltration',
    pattern: /list\s+all\s+(customers|users|passwords|api\s*keys|secrets)/i,
  },
  { category: 'data_exfiltration', pattern: /dump\s+(the\s+)?database/i },
  { category: 'tool_abuse', pattern: /execute\s+(arbitrary|any)\s+(code|command)/i },
  { category: 'tool_abuse', pattern: /run\s+(shell|sql|system)\s+command/i },
  // Markers that commonly indicate a retrieved document is trying to
  // inject its own instructions (indirect injection via RAG content).
  { category: 'indirect_injection_marker', pattern: /###\s*(system|instruction)/i },
  { category: 'indirect_injection_marker', pattern: /^\s*(system|assistant)\s*:/im },
];

// Zero-width/format/bidi-control characters used to hide instructions:
// U+200B-200F (zero-width space/non-joiner/joiner/LTR/RTL marks),
// U+202A-202E (embedding/override formatting), U+2066-2069 (isolates),
// U+FEFF (BOM / zero-width no-break space). Written as \u escapes, not
// literal invisible characters, so this file stays legible and diff-able.
const HIDDEN_UNICODE_PATTERN = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;

export interface PromptInjectionResult {
  blocked: boolean;
  categories: PromptInjectionCategory[];
}

export function scanForPromptInjection(text: string): PromptInjectionResult {
  const categories = new Set<PromptInjectionCategory>();

  for (const { category, pattern } of PATTERNS) {
    if (pattern.test(text)) categories.add(category);
  }
  if (HIDDEN_UNICODE_PATTERN.test(text)) categories.add('hidden_unicode');

  return { blocked: categories.size > 0, categories: [...categories] };
}
