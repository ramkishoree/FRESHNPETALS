import type { Metadata } from 'next';
import { LegalPage } from '@/components/storefront/legal-page';
import { BUSINESS } from '@/lib/legal/business-details';

export const metadata: Metadata = {
  title: 'Cancellation & Refund Policy',
  description:
    'When a Fresh N Petals order can be cancelled, when you are entitled to a refund or replacement, how to claim one, and how long refunds take.',
};

/**
 * The clause customers and payment gateways both read hardest, so it is
 * written to be unambiguous rather than lawyerly: what you get, when,
 * and what we need from you to give it to you.
 *
 * Owner's chosen stance: free cancellation before dispatch; no
 * cancellation after, because a made-to-order perishable cannot be
 * resold — but a full remedy where the order is defective, wrong, or
 * never arrives. That last half is what makes the first half fair, and
 * is what keeps chargebacks down.
 */
export default function RefundsPage() {
  return (
    <LegalPage
      title="Cancellation & Refund Policy"
      updated="2026-08-02"
      intro={[
        'Flowers are made to order and perish within hours, so we cannot offer open-ended returns the way a clothing shop can. What we do offer is simple: if we get it wrong, you get your money back or a fresh replacement, your choice.',
      ]}
      sections={[
        {
          heading: 'Cancelling before dispatch',
          body: [
            'You can cancel any order free of charge at any time before it is dispatched from the outlet. You will be refunded in full, including the delivery charge.',
            `To cancel, contact us at ${BUSINESS.supportEmail} or ${BUSINESS.supportPhone} with your order number. The sooner you call, the more likely we can stop it.`,
          ],
        },
        {
          heading: 'Cancelling after dispatch',
          body: [
            'Once an order has been dispatched it cannot be cancelled, and it is not eligible for a refund on change-of-mind grounds. The arrangement has been made specifically for you from perishable stock and cannot be resold.',
            'This does not affect your rights below if something is actually wrong with the order.',
          ],
        },
        {
          heading: 'When you are entitled to a refund or replacement',
          body: [
            'We will refund you in full, or send a free replacement — whichever you prefer — if:',
            [
              'The flowers or gift arrived damaged, wilted, or in visibly poor condition.',
              'You received the wrong item, or an item materially different from what you ordered.',
              'The order was never delivered.',
              'The order was delivered materially late through our fault — for example, a next-day delivery when you paid for and selected same-day.',
              'We cancelled your order because we could not fulfil it.',
            ],
            'Where we substituted a flower under clause 5 of our Terms of Service and the substitution was of equal or greater value and similar in colour and style, that is not by itself grounds for a refund.',
          ],
        },
        {
          heading: 'How to raise a claim',
          body: [
            'Tell us within 24 hours of delivery. Flowers deteriorate quickly, and after a day it is no longer possible to tell whether a problem was in the arrangement or in how it was kept.',
            'Send us:',
            [
              'Your order number.',
              'A clear photograph of what arrived, for damage or wrong-item claims. This is the single thing that gets a claim approved fastest.',
              'A one-line description of the problem.',
            ],
            `Send it to ${BUSINESS.supportEmail}, or WhatsApp/call ${BUSINESS.supportPhone} (${BUSINESS.supportHours}). We will acknowledge within 24 hours and decide within 48 hours of receiving what we asked for.`,
            'We do not require you to return the flowers. Please do not throw them away before we have seen the photograph.',
          ],
        },
        {
          heading: 'How refunds are paid',
          body: [
            'Approved refunds go back to the original payment method used for the order. We do not refund to a different account, and we do not issue cash refunds for online payments.',
            'We initiate the refund within 2 business days of approving your claim. Once initiated, it typically reaches you in 5 to 7 business days, depending on your bank or card issuer — that final leg is in their hands, not ours.',
            'Where a replacement is sent instead of a refund, there is no charge to you, including delivery.',
          ],
        },
        {
          heading: 'Cash on Delivery orders',
          body: [
            'For orders paid in cash on delivery, an approved refund is paid by bank transfer or UPI to an account in the name of the person who placed the order. We will ask you for those details when we approve the claim.',
            'If you refuse a Cash on Delivery order at the door without a valid reason under clause 3, no refund arises because no payment was taken — but we may decline to offer Cash on Delivery to that address in future.',
          ],
        },
        {
          heading: 'When we cannot refund',
          body: [
            [
              'Change of mind after dispatch.',
              'An incorrect or incomplete delivery address, or an unreachable recipient phone number, that you supplied.',
              'Nobody available to receive the order during the slot you selected, where we attempted delivery and contacted the recipient and you.',
              'Delay or failure caused by events outside our reasonable control, as described in our Terms of Service — though we will always offer to reschedule, or refund in full if rescheduling does not suit you.',
              'A claim raised more than 24 hours after delivery, where we can no longer verify the condition of the flowers.',
            ],
          ],
        },
        {
          heading: 'Failed and duplicate payments',
          body: [
            'If money left your account but the order did not confirm, it is normally an authorisation that was never captured, and your bank releases it automatically within 5 to 7 business days.',
            'If you were genuinely charged twice for the same order, contact us with both transaction references and we will refund the duplicate in full — this is not treated as a cancellation and none of the restrictions above apply.',
          ],
        },
        {
          heading: 'If you are not satisfied with our decision',
          body: [
            'Escalate to our Grievance Officer:',
            `${BUSINESS.proprietorName}\nGrievance Officer, ${BUSINESS.tradeName}\n${BUSINESS.registeredAddress}\nEmail: ${BUSINESS.supportEmail}\nPhone: ${BUSINESS.supportPhone}\nHours: ${BUSINESS.supportHours}`,
            'We respond within 48 hours and aim to resolve within 30 days, as the Consumer Protection (E-Commerce) Rules, 2020 require. Nothing in this policy affects your right to approach a Consumer Commission.',
          ],
        },
      ]}
    />
  );
}
