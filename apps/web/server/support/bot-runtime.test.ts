// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleInboundWhatsAppMessage } from './bot-runtime';
import type { AiOrchestrator } from '@/server/ai/orchestrator';
import { AiOrchestrationError } from '@/server/ai/orchestrator';
import type { OrderContext, SupportConversation } from './support-repository';

vi.mock('@/server/whatsapp/meta-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/whatsapp/meta-client')>();
  return { ...actual, sendWhatsAppText: vi.fn().mockResolvedValue({ messageId: 'wamid.sent' }) };
});
vi.mock('@/server/support/notify-owner', () => ({
  notifyOwnerEscalation: vi.fn().mockResolvedValue(undefined),
}));

const { sendWhatsAppText } = await import('@/server/whatsapp/meta-client');
const { notifyOwnerEscalation } = await import('@/server/support/notify-owner');

function makeConversation(overrides: Partial<SupportConversation> = {}): SupportConversation {
  return {
    id: 'conv-1',
    customerId: 'cust-1',
    orderId: 'order-1',
    whatsappWaId: '911234567890',
    status: 'bot_active',
    aiAttemptCount: 0,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<OrderContext> = {}): OrderContext {
  return {
    orderId: 'order-1',
    customerId: 'cust-1',
    orderNumber: 'FP-0001',
    status: 'processing',
    paymentStatus: 'paid',
    fulfillmentStatus: 'unfulfilled',
    grandTotal: 999,
    deliveryStatus: 'pending',
    estimatedDelivery: null,
    trackingCode: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findOpenConversationByWaId: vi.fn().mockResolvedValue(makeConversation()),
    createConversation: vi.fn().mockResolvedValue(makeConversation()),
    updateConversation: vi.fn().mockResolvedValue(undefined),
    appendMessage: vi.fn().mockResolvedValue(undefined),
    getRecentMessages: vi.fn().mockResolvedValue([]),
    findOrderContextByOrderNumber: vi.fn().mockResolvedValue(makeOrder()),
    findOrderContextById: vi.fn().mockResolvedValue(makeOrder()),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeOrchestrator(response: { reply: string; resolved: boolean }) {
  return {
    execute: vi.fn().mockResolvedValue({
      text: JSON.stringify(response),
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      promptTokens: 50,
      completionTokens: 20,
      costUsd: 0,
    }),
  } as unknown as AiOrchestrator;
}

const inboundMessage = {
  waId: '911234567890',
  messageId: 'wamid.1',
  body: 'Where is my order?',
  timestamp: '1',
};

describe('handleInboundWhatsAppMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new conversation and links order/customer from an "Order #X:" deep-link prefix', async () => {
    const repo = makeRepo({ findOpenConversationByWaId: vi.fn().mockResolvedValue(null) });
    const orchestrator = makeOrchestrator({ reply: 'It ships tomorrow.', resolved: true });

    await handleInboundWhatsAppMessage(
      { repo, orchestrator },
      { ...inboundMessage, body: 'Order #FP-0001: is this delayed?' },
    );

    expect(repo.findOrderContextByOrderNumber).toHaveBeenCalledWith('FP-0001');
    expect(repo.createConversation).toHaveBeenCalledWith({
      waId: '911234567890',
      orderId: 'order-1',
      customerId: 'cust-1',
    });
  });

  it('runs an AI attempt for a fresh conversation and replies + asks for feedback when resolved', async () => {
    const repo = makeRepo();
    const orchestrator = makeOrchestrator({ reply: 'Your order ships tomorrow.', resolved: true });

    await handleInboundWhatsAppMessage({ repo, orchestrator }, inboundMessage);

    expect(orchestrator.execute).toHaveBeenCalledWith(
      expect.objectContaining({ promptName: 'whatsapp-support-bot', routingPolicy: 'fastest' }),
    );
    expect(repo.updateConversation).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ status: 'resolved', aiAttemptCount: 1 }),
    );
    expect(sendWhatsAppText).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Did this help?') }),
    );
  });

  it('stays bot_active after a first unresolved attempt (no escalation yet)', async () => {
    const repo = makeRepo();
    const orchestrator = makeOrchestrator({
      reply: 'Can you share your order number?',
      resolved: false,
    });

    await handleInboundWhatsAppMessage({ repo, orchestrator }, inboundMessage);

    expect(repo.updateConversation).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ status: 'bot_active', aiAttemptCount: 1 }),
    );
    expect(notifyOwnerEscalation).not.toHaveBeenCalled();
  });

  it('escalates and notifies the owner after the second unresolved attempt', async () => {
    const repo = makeRepo({
      findOpenConversationByWaId: vi
        .fn()
        .mockResolvedValue(makeConversation({ aiAttemptCount: 1 })),
    });
    const orchestrator = makeOrchestrator({
      reply: 'Still not sure, let me check.',
      resolved: false,
    });

    await handleInboundWhatsAppMessage({ repo, orchestrator }, inboundMessage);

    expect(repo.updateConversation).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ status: 'escalated', aiAttemptCount: 2 }),
    );
    expect(notifyOwnerEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'max_attempts_reached' }),
    );
  });

  it('escalates immediately when the customer explicitly asks for a human, skipping the AI entirely', async () => {
    const repo = makeRepo();
    const orchestrator = makeOrchestrator({ reply: 'unused', resolved: true });

    await handleInboundWhatsAppMessage(
      { repo, orchestrator },
      { ...inboundMessage, body: 'I want to talk to a human please' },
    );

    expect(orchestrator.execute).not.toHaveBeenCalled();
    expect(repo.updateConversation).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ status: 'escalated' }),
    );
    expect(notifyOwnerEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'customer_requested_human' }),
    );
  });

  it('closes the conversation on positive feedback after a resolved conversation', async () => {
    const repo = makeRepo({
      findOpenConversationByWaId: vi
        .fn()
        .mockResolvedValue(makeConversation({ status: 'resolved' })),
    });
    const orchestrator = makeOrchestrator({ reply: 'unused', resolved: true });

    await handleInboundWhatsAppMessage(
      { repo, orchestrator },
      { ...inboundMessage, body: 'yes thanks!' },
    );

    expect(orchestrator.execute).not.toHaveBeenCalled();
    expect(repo.updateConversation).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ status: 'closed' }),
    );
    expect(notifyOwnerEscalation).not.toHaveBeenCalled();
  });

  it('escalates on negative feedback after a resolved conversation', async () => {
    const repo = makeRepo({
      findOpenConversationByWaId: vi
        .fn()
        .mockResolvedValue(makeConversation({ status: 'resolved' })),
    });
    const orchestrator = makeOrchestrator({ reply: 'unused', resolved: true });

    await handleInboundWhatsAppMessage(
      { repo, orchestrator },
      { ...inboundMessage, body: 'no still broken' },
    );

    expect(repo.updateConversation).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ status: 'escalated' }),
    );
    expect(notifyOwnerEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'customer_feedback_negative' }),
    );
  });

  it('ignores a new message on an already-escalated conversation (human owns it)', async () => {
    const repo = makeRepo({
      findOpenConversationByWaId: vi
        .fn()
        .mockResolvedValue(makeConversation({ status: 'escalated' })),
    });
    const orchestrator = makeOrchestrator({ reply: 'unused', resolved: true });

    await handleInboundWhatsAppMessage({ repo, orchestrator }, inboundMessage);

    expect(orchestrator.execute).not.toHaveBeenCalled();
    expect(sendWhatsAppText).not.toHaveBeenCalled();
    expect(notifyOwnerEscalation).not.toHaveBeenCalled();
  });

  it('treats an AI/governance failure (e.g. kill switch) as an unresolved attempt rather than throwing', async () => {
    const repo = makeRepo();
    const orchestrator = {
      execute: vi.fn().mockRejectedValue(new AiOrchestrationError('kill_switch', 'Blocked.')),
    } as unknown as AiOrchestrator;

    await expect(
      handleInboundWhatsAppMessage({ repo, orchestrator }, inboundMessage),
    ).resolves.not.toThrow();

    expect(repo.updateConversation).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ status: 'bot_active', aiAttemptCount: 1 }),
    );
  });
});
