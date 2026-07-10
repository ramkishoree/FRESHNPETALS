import 'server-only';
import {
  decideAfterAiAttempt,
  decideForCustomerMessage,
  interpretFeedback,
  MAX_AI_ATTEMPTS,
  requestsHuman,
} from '@prana/operations';
import { AiOrchestrationError, type AiOrchestrator } from '@/server/ai/orchestrator';
import { logger } from '@/server/logger';
import { notifyOwnerEscalation } from '@/server/support/notify-owner';
import type { OrderContext, SupportRepository } from '@/server/support/support-repository';
import { sendWhatsAppText } from '@/server/whatsapp/meta-client';
import type { WhatsAppInboundMessage } from '@/server/whatsapp/meta-client';

const ORDER_PREFIX_PATTERN = /^order\s*#?\s*(\S+)\s*:\s*/i;

const AI_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    resolved: { type: 'boolean' },
  },
  required: ['reply', 'resolved'],
};

const CONNECTING_TO_TEAM_MESSAGE =
  "I'm connecting you with our team — they'll reply here shortly. You can also describe more detail in the meantime.";

function formatOrderContext(order: OrderContext | null): string {
  if (!order) return 'No order is linked to this conversation yet.';
  return [
    `Order ${order.orderNumber}`,
    `Order status: ${order.status}`,
    `Payment status: ${order.paymentStatus}`,
    `Fulfillment status: ${order.fulfillmentStatus}`,
    `Grand total: ${order.grandTotal}`,
    order.deliveryStatus ? `Delivery status: ${order.deliveryStatus}` : null,
    order.estimatedDelivery ? `Estimated delivery: ${order.estimatedDelivery}` : null,
    order.trackingCode ? `Tracking code: ${order.trackingCode}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function handleInboundWhatsAppMessage(
  deps: { repo: SupportRepository; orchestrator: AiOrchestrator },
  message: WhatsAppInboundMessage,
): Promise<void> {
  const { repo } = deps;

  let conversation = await repo.findOpenConversationByWaId(message.waId);
  let queryText = message.body;
  let orderContext: OrderContext | null = null;

  if (!conversation) {
    const prefixMatch = ORDER_PREFIX_PATTERN.exec(message.body);
    let orderId: string | null = null;
    let customerId: string | null = null;

    if (prefixMatch?.[1]) {
      const order = await repo.findOrderContextByOrderNumber(prefixMatch[1]);
      if (order) {
        orderId = order.orderId;
        customerId = order.customerId;
        orderContext = order;
        queryText =
          message.body.slice(prefixMatch[0].length).trim() || 'No specific question provided.';
      }
    }

    conversation = await repo.createConversation({ waId: message.waId, orderId, customerId });
  } else if (conversation.orderId) {
    orderContext = await repo.findOrderContextById(conversation.orderId);
  }

  await repo.appendMessage({
    conversationId: conversation.id,
    sender: 'customer',
    body: message.body,
    whatsappMessageId: message.messageId,
  });
  await repo.updateConversation(conversation.id, {
    lastCustomerMessageAt: new Date().toISOString(),
  });

  const decision = decideForCustomerMessage(
    { status: conversation.status, aiAttemptCount: conversation.aiAttemptCount },
    { requestsHuman: requestsHuman(message.body) },
  );

  if (decision.action === 'ignore') {
    logger.info('support.inbound.ignored', {
      conversationId: conversation.id,
      reason: decision.reason,
    });
    return;
  }

  if (decision.action === 'escalate') {
    await escalate(deps, conversation.id, message.waId, orderContext, decision.reason);
    return;
  }

  if (decision.action === 'interpret_feedback') {
    const sentiment = interpretFeedback(message.body);
    if (sentiment === 'positive') {
      await repo.updateConversation(conversation.id, {
        status: 'closed',
        closedAt: new Date().toISOString(),
      });
      await sendWhatsAppText({ to: message.waId, body: 'Glad that helped! Have a great day. 🌸' });
      return;
    }
    await escalate(
      deps,
      conversation.id,
      message.waId,
      orderContext,
      sentiment === 'negative' ? 'customer_feedback_negative' : 'customer_feedback_unclear',
    );
    return;
  }

  // decision.action === 'run_ai_attempt'
  const recentMessages = await repo.getRecentMessages(conversation.id);
  const attemptNumber = conversation.aiAttemptCount + 1;

  let aiReply: string;
  let aiResolved: boolean;
  try {
    const result = await deps.orchestrator.execute({
      promptName: 'whatsapp-support-bot',
      taskInstructions:
        `Order context:\n${formatOrderContext(orderContext)}\n\n` +
        `Conversation so far:\n${recentMessages.map((m) => `${m.sender}: ${m.body}`).join('\n')}\n\n` +
        `This is attempt ${attemptNumber} of ${MAX_AI_ATTEMPTS}.\n\n` +
        `Customer's latest message: ${queryText}`,
      routingPolicy: 'fastest',
      requiresStructuredOutput: true,
      jsonSchema: AI_OUTPUT_SCHEMA,
      budgetScope: { scope: 'agent', scopeRef: 'whatsapp-support-bot', period: 'daily' },
      killSwitchCheck: { agent: 'whatsapp-support-bot' },
    });

    const parsed = JSON.parse(result.text) as { reply?: unknown; resolved?: unknown };
    aiReply = typeof parsed.reply === 'string' ? parsed.reply : '';
    aiResolved = parsed.resolved === true;
    if (!aiReply) throw new Error('AI returned an empty reply.');
  } catch (cause) {
    logger.error('support.ai_attempt_failed', {
      conversationId: conversation.id,
      message:
        cause instanceof AiOrchestrationError ? `${cause.reason}: ${cause.message}` : String(cause),
    });
    // Infra/governance failure — don't leave the customer hanging on a
    // broken AI call; treat it the same as an unresolved attempt.
    aiReply = '';
    aiResolved = false;
  }

  const outcome = decideAfterAiAttempt(
    { status: conversation.status, aiAttemptCount: conversation.aiAttemptCount },
    aiResolved,
  );

  await repo.updateConversation(conversation.id, {
    status: outcome.newStatus,
    aiAttemptCount: outcome.newAttemptCount,
    ...(outcome.newStatus === 'resolved' ? { resolvedAt: new Date().toISOString() } : {}),
    ...(outcome.shouldEscalate ? { escalatedAt: new Date().toISOString() } : {}),
  });

  if (outcome.shouldEscalate) {
    if (aiReply) {
      await repo.appendMessage({ conversationId: conversation.id, sender: 'bot', body: aiReply });
      await sendWhatsAppText({ to: message.waId, body: aiReply });
    }
    await escalate(
      deps,
      conversation.id,
      message.waId,
      orderContext,
      outcome.escalationReason ?? 'max_attempts_reached',
      {
        skipStatusUpdate: true,
      },
    );
    return;
  }

  const replyBody =
    outcome.newStatus === 'resolved' ? `${aiReply}\n\nDid this help? Reply YES or NO.` : aiReply;
  await repo.appendMessage({ conversationId: conversation.id, sender: 'bot', body: replyBody });
  await sendWhatsAppText({ to: message.waId, body: replyBody });
}

async function escalate(
  deps: { repo: SupportRepository },
  conversationId: string,
  customerWaId: string,
  orderContext: OrderContext | null,
  reason: string,
  options: { skipStatusUpdate?: boolean } = {},
): Promise<void> {
  const { repo } = deps;

  if (!options.skipStatusUpdate) {
    await repo.updateConversation(conversationId, {
      status: 'escalated',
      escalatedAt: new Date().toISOString(),
    });
  }

  const recentMessages = await repo.getRecentMessages(conversationId);
  await notifyOwnerEscalation({
    orderNumber: orderContext?.orderNumber ?? null,
    customerWaId,
    reason,
    recentMessages,
  });
  await sendWhatsAppText({ to: customerWaId, body: CONNECTING_TO_TEAM_MESSAGE });
}
