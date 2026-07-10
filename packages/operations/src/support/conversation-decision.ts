/**
 * WhatsApp Support conversation state machine — pure decision logic, no
 * I/O. The AI call (Groq by default), the WhatsApp send, and the DB
 * writes all live in apps/web/server, same framework-agnostic-core split
 * as job-queue.ts. Owner's stated design: "AI gets 2 replies to resolve,
 * more than that escalate to a human."
 */
export const MAX_AI_ATTEMPTS = 2;

export type SupportConversationStatus = 'bot_active' | 'resolved' | 'escalated' | 'closed';

export interface ConversationSnapshot {
  status: SupportConversationStatus;
  aiAttemptCount: number;
}

export type InboundMessageDecision =
  | { action: 'run_ai_attempt' }
  | { action: 'interpret_feedback' }
  | { action: 'escalate'; reason: 'customer_requested_human' | 'max_attempts_reached' }
  | { action: 'ignore'; reason: 'conversation_closed' | 'already_escalated' };

/**
 * What to do with a new inbound customer message, given the
 * conversation's current state. Called before any AI call is made — an
 * explicit "talk to a human" request short-circuits straight to
 * escalation without spending an AI attempt on it.
 */
export function decideForCustomerMessage(
  snapshot: ConversationSnapshot,
  message: { requestsHuman: boolean },
): InboundMessageDecision {
  if (snapshot.status === 'closed') return { action: 'ignore', reason: 'conversation_closed' };
  if (snapshot.status === 'escalated') return { action: 'ignore', reason: 'already_escalated' };
  if (snapshot.status === 'resolved') return { action: 'interpret_feedback' };

  if (message.requestsHuman) return { action: 'escalate', reason: 'customer_requested_human' };
  if (snapshot.aiAttemptCount >= MAX_AI_ATTEMPTS) {
    return { action: 'escalate', reason: 'max_attempts_reached' };
  }
  return { action: 'run_ai_attempt' };
}

export interface AiAttemptOutcome {
  newStatus: SupportConversationStatus;
  newAttemptCount: number;
  shouldEscalate: boolean;
  escalationReason?: 'max_attempts_reached';
}

/**
 * What happens after the AI has actually replied. `aiResolved` is the
 * model's own self-assessment (its structured output includes a
 * `resolved: boolean`), not a re-analysis of its text — the model is in
 * the best position to know whether it actually answered the question.
 */
export function decideAfterAiAttempt(
  snapshot: ConversationSnapshot,
  aiResolved: boolean,
): AiAttemptOutcome {
  const newAttemptCount = snapshot.aiAttemptCount + 1;

  if (aiResolved) {
    return { newStatus: 'resolved', newAttemptCount, shouldEscalate: false };
  }

  if (newAttemptCount >= MAX_AI_ATTEMPTS) {
    return {
      newStatus: 'escalated',
      newAttemptCount,
      shouldEscalate: true,
      escalationReason: 'max_attempts_reached',
    };
  }

  return { newStatus: 'bot_active', newAttemptCount, shouldEscalate: false };
}

const HUMAN_REQUEST_KEYWORDS = [
  'human',
  'agent',
  'person',
  'representative',
  'talk to someone',
  'real person',
  'owner',
  'manager',
];

/** Rule-based, not AI — an explicit request for a human shouldn't cost an AI call to detect. */
export function requestsHuman(messageBody: string): boolean {
  const normalized = messageBody.trim().toLowerCase();
  return HUMAN_REQUEST_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export type FeedbackSentiment = 'positive' | 'negative' | 'unclear';

// Whole-word matches only — a substring check on short words like "no" or
// "yes" would false-positive inside unrelated words ("know", "yesterday").
const POSITIVE_FEEDBACK_PATTERN = /\b(yes|yep|yeah|thanks|thank you|resolved|great|solved)\b|👍/;
const NEGATIVE_FEEDBACK_PATTERN = /\b(no|nope|not resolved|still|doesn'?t work|does not work)\b|👎/;

/**
 * After a `resolved` conversation gets one more customer message, this
 * classifies it as the feedback response the bot asked for. Unclear
 * feedback escalates rather than silently closing — a possibly-unhappy
 * customer getting no response at all is worse than one extra
 * unnecessary owner notification.
 */
export function interpretFeedback(messageBody: string): FeedbackSentiment {
  const normalized = messageBody.trim().toLowerCase();
  if (POSITIVE_FEEDBACK_PATTERN.test(normalized)) return 'positive';
  if (NEGATIVE_FEEDBACK_PATTERN.test(normalized)) return 'negative';
  return 'unclear';
}
