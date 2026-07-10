import 'server-only';
import { getServerEnv } from '@/config/env';
import { isEmailConfigured, sendEmail } from '@/server/email/resend-client';
import { isWhatsAppConfigured, sendWhatsAppTemplate } from '@/server/whatsapp/meta-client';
import { logger } from '@/server/logger';

/**
 * Owner-facing alerts always try both channels and never let one
 * channel's failure block the other — a WhatsApp outage shouldn't also
 * suppress the email, and vice versa (this is exactly the redundancy the
 * owner asked for). Each failure is logged, never thrown, since a
 * notification failure must not fail the checkout/webhook request that
 * triggered it.
 *
 * Template names below (`order_placed_alert`, `support_escalation_alert`)
 * must be submitted to Meta for approval before they'll actually send —
 * see docs/whatsapp-support.md for the exact wording to submit.
 */
async function notifyBothChannels(params: {
  whatsappTemplateName: string;
  whatsappParams: string[];
  emailSubject: string;
  emailHtml: string;
  logContext: Record<string, unknown>;
}): Promise<void> {
  const env = getServerEnv();

  if (isWhatsAppConfigured() && env.META_WHATSAPP_OWNER_WA_ID) {
    try {
      await sendWhatsAppTemplate({
        to: env.META_WHATSAPP_OWNER_WA_ID,
        templateName: params.whatsappTemplateName,
        bodyParams: params.whatsappParams,
      });
    } catch (cause) {
      logger.error('support.notify_owner.whatsapp_failed', {
        ...params.logContext,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  } else {
    logger.warn('support.notify_owner.whatsapp_not_configured', params.logContext);
  }

  if (isEmailConfigured() && env.OWNER_NOTIFICATION_EMAIL) {
    try {
      await sendEmail({
        to: env.OWNER_NOTIFICATION_EMAIL,
        subject: params.emailSubject,
        html: params.emailHtml,
      });
    } catch (cause) {
      logger.error('support.notify_owner.email_failed', {
        ...params.logContext,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    }
  } else {
    logger.warn('support.notify_owner.email_not_configured', params.logContext);
  }
}

export async function notifyOwnerOrderPlaced(params: {
  orderNumber: string;
  grandTotal: number;
  currency: string;
}): Promise<void> {
  await notifyBothChannels({
    whatsappTemplateName: 'order_placed_alert',
    whatsappParams: [params.orderNumber, `${params.currency} ${params.grandTotal.toFixed(2)}`],
    emailSubject: `New order ${params.orderNumber} — ${params.currency} ${params.grandTotal.toFixed(2)}`,
    emailHtml: `<p>New order placed.</p><p><strong>Order:</strong> ${params.orderNumber}</p><p><strong>Total:</strong> ${params.currency} ${params.grandTotal.toFixed(2)}</p>`,
    logContext: { event: 'order_placed', orderNumber: params.orderNumber },
  });
}

export async function notifyOwnerEscalation(params: {
  orderNumber: string | null;
  customerWaId: string;
  reason: string;
  recentMessages: Array<{ sender: string; body: string }>;
}): Promise<void> {
  const transcript = params.recentMessages.map((m) => `${m.sender}: ${m.body}`).join('\n');

  await notifyBothChannels({
    whatsappTemplateName: 'support_escalation_alert',
    whatsappParams: [params.orderNumber ?? 'unknown order', params.reason],
    emailSubject: `WhatsApp support escalation${params.orderNumber ? ` — ${params.orderNumber}` : ''}`,
    emailHtml:
      `<p>A customer conversation needs a human reply.</p>` +
      `<p><strong>Order:</strong> ${params.orderNumber ?? 'unknown'}</p>` +
      `<p><strong>Reason:</strong> ${params.reason}</p>` +
      `<p><strong>Customer WhatsApp:</strong> ${params.customerWaId}</p>` +
      `<pre>${transcript}</pre>` +
      `<p>Reply from the Support Inbox in the admin dashboard.</p>`,
    logContext: {
      event: 'support_escalation',
      orderNumber: params.orderNumber,
      customerWaId: params.customerWaId,
      reason: params.reason,
    },
  });
}
