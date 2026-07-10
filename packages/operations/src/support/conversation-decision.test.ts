import { describe, expect, it } from 'vitest';
import {
  decideAfterAiAttempt,
  decideForCustomerMessage,
  interpretFeedback,
  requestsHuman,
} from './conversation-decision';

describe('decideForCustomerMessage', () => {
  it('runs an AI attempt for a fresh bot_active conversation', () => {
    expect(
      decideForCustomerMessage(
        { status: 'bot_active', aiAttemptCount: 0 },
        { requestsHuman: false },
      ),
    ).toEqual({ action: 'run_ai_attempt' });
  });

  it('escalates immediately when the customer explicitly asks for a human, even on the first message', () => {
    expect(
      decideForCustomerMessage(
        { status: 'bot_active', aiAttemptCount: 0 },
        { requestsHuman: true },
      ),
    ).toEqual({ action: 'escalate', reason: 'customer_requested_human' });
  });

  it('escalates once the attempt cap is already reached (safety net)', () => {
    expect(
      decideForCustomerMessage(
        { status: 'bot_active', aiAttemptCount: 2 },
        { requestsHuman: false },
      ),
    ).toEqual({ action: 'escalate', reason: 'max_attempts_reached' });
  });

  it('routes to feedback interpretation once the conversation is resolved', () => {
    expect(
      decideForCustomerMessage({ status: 'resolved', aiAttemptCount: 1 }, { requestsHuman: false }),
    ).toEqual({ action: 'interpret_feedback' });
  });

  it('ignores new messages on an already-escalated conversation (human owns it now)', () => {
    expect(
      decideForCustomerMessage(
        { status: 'escalated', aiAttemptCount: 2 },
        { requestsHuman: false },
      ),
    ).toEqual({ action: 'ignore', reason: 'already_escalated' });
  });

  it('ignores new messages on a closed conversation', () => {
    expect(
      decideForCustomerMessage({ status: 'closed', aiAttemptCount: 1 }, { requestsHuman: false }),
    ).toEqual({ action: 'ignore', reason: 'conversation_closed' });
  });
});

describe('decideAfterAiAttempt', () => {
  it('marks resolved when the model reports it resolved the query', () => {
    expect(decideAfterAiAttempt({ status: 'bot_active', aiAttemptCount: 0 }, true)).toEqual({
      newStatus: 'resolved',
      newAttemptCount: 1,
      shouldEscalate: false,
    });
  });

  it('stays bot_active after a first unresolved attempt', () => {
    expect(decideAfterAiAttempt({ status: 'bot_active', aiAttemptCount: 0 }, false)).toEqual({
      newStatus: 'bot_active',
      newAttemptCount: 1,
      shouldEscalate: false,
    });
  });

  it('escalates after the second unresolved attempt', () => {
    expect(decideAfterAiAttempt({ status: 'bot_active', aiAttemptCount: 1 }, false)).toEqual({
      newStatus: 'escalated',
      newAttemptCount: 2,
      shouldEscalate: true,
      escalationReason: 'max_attempts_reached',
    });
  });

  it('resolves even on what would have been the final attempt', () => {
    expect(decideAfterAiAttempt({ status: 'bot_active', aiAttemptCount: 1 }, true)).toEqual({
      newStatus: 'resolved',
      newAttemptCount: 2,
      shouldEscalate: false,
    });
  });
});

describe('requestsHuman', () => {
  it.each([
    'I want to talk to a human',
    'can I speak to an agent',
    'give me a real person',
    'HUMAN',
  ])('detects an explicit human request: %s', (body) => {
    expect(requestsHuman(body)).toBe(true);
  });

  it('does not flag an ordinary question', () => {
    expect(requestsHuman('Where is my order, it is 2 days late?')).toBe(false);
  });
});

describe('interpretFeedback', () => {
  it.each(['yes thanks!', 'Great, resolved', '👍'])('classifies positive feedback: %s', (body) => {
    expect(interpretFeedback(body)).toBe('positive');
  });

  it.each(["no, doesn't work", 'still broken', '👎'])(
    'classifies negative feedback: %s',
    (body) => {
      expect(interpretFeedback(body)).toBe('negative');
    },
  );

  it('does not false-positive on "no" appearing inside an unrelated word', () => {
    expect(interpretFeedback('I know this already, all good')).not.toBe('negative');
  });

  it('classifies an ambiguous reply as unclear', () => {
    expect(interpretFeedback('ok')).toBe('unclear');
  });
});
