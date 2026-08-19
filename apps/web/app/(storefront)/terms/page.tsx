import type { Metadata } from 'next';
import { LegalPage } from '@/components/storefront/legal-page';
import { BUSINESS, LEGAL_OPERATOR, serviceCityList } from '@/lib/legal/business-details';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms on which Fresh N Petals sells and delivers flowers, bouquets and gifts, including ordering, pricing, substitution, liability and dispute resolution.',
};

/**
 * Written against the Indian Contract Act 1872, the Consumer Protection
 * Act 2019 with the E-Commerce Rules 2020, and the IT Act 2000.
 *
 * Two clauses here are specific to selling flowers rather than generic
 * e-commerce boilerplate, and both exist because they are the things
 * that actually go wrong: substitution (clause 5 — stems vary daily and
 * a florist cannot promise an identical stem count), and recipient
 * absence (clause 8 — a gift is delivered to someone who did not order
 * it and may not be home).
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="2026-08-02"
      intro={[
        `These terms govern your use of this website and every order you place on it. Please read them before ordering — placing an order means you accept them.`,
        'They do not take away any right you have as a consumer under the Consumer Protection Act, 2019.',
      ]}
      sections={[
        {
          heading: 'Who you are contracting with',
          body: [
            `This website is operated by ${LEGAL_OPERATOR}, with its principal place of business at ${BUSINESS.registeredAddress}${BUSINESS.gstin ? `, GSTIN ${BUSINESS.gstin}` : ''}.`,
            `In these terms "we" and "us" mean that business, and "you" means the person placing an order. Contact: ${BUSINESS.supportEmail}, ${BUSINESS.supportPhone}, ${BUSINESS.supportHours}.`,
          ],
        },
        {
          heading: 'Using this site',
          body: [
            'You must be at least 18 years old and able to enter into a binding contract to place an order.',
            'If you create an account, keep your login details to yourself. You are responsible for orders placed through your account. Tell us immediately if you think someone else has access to it.',
            'You agree not to misuse the site — no attempting to breach its security, scrape it at scale, interfere with other customers, or use it for anything unlawful.',
          ],
        },
        {
          heading: 'Products, pricing and availability',
          body: [
            'All prices are shown in Indian Rupees and include applicable taxes unless stated otherwise at checkout. Delivery charges are shown separately before you pay.',
            'Product photographs are indicative. Flowers are a natural product: colour, size, stem count and exact form vary between batches and seasons, and what arrives may differ in appearance from the photograph.',
            'We try to keep availability accurate, but stock is limited and can sell out between your adding an item and paying for it. If an item becomes unavailable after you have paid, we will contact you to offer a substitution or a full refund.',
            'If a price is listed in obvious error (for example a decimal place in the wrong position), we may cancel the order and refund you in full rather than fulfil it at that price. We will tell you as soon as we notice.',
          ],
        },
        {
          heading: 'Orders and when a contract is formed',
          body: [
            'Your order is an offer to buy. A contract is formed only when we confirm the order — by on-screen confirmation and confirmation email after your payment is captured, or, for a Cash on Delivery order, when we confirm acceptance.',
            'We may decline an order before that point, including where the delivery address is outside our service area, where stock has run out, where we suspect fraud, or where we cannot verify the details you gave. If we decline an order you have already paid for, we refund it in full.',
          ],
        },
        {
          heading: 'Substitution',
          body: [
            'Flowers are seasonal and perishable, and market supply changes daily. Where a specific bloom in an arrangement is unavailable on the day, we may substitute a flower of equal or greater value, in a similar colour and style, so that your delivery still happens on time and looks like what you ordered.',
            'We will not substitute the arrangement for something materially different without asking you first. If you would rather we contacted you before any substitution, say so in the order instructions and we will call you.',
          ],
        },
        {
          heading: 'Payment',
          body: [
            'We accept online payment through Razorpay, our payment gateway, and Cash on Delivery where it is offered for your address.',
            'Card, UPI and netbanking details are entered on Razorpay’s systems and are never received or stored by us. Payment is subject to Razorpay’s own terms in addition to these.',
            'For a Cash on Delivery order, the full amount is payable in cash to the delivery person at the time of delivery. We may withdraw the Cash on Delivery option for a particular address or customer.',
          ],
        },
        {
          heading: 'Delivery',
          body: [
            `We currently deliver in ${serviceCityList()}. Delivery charges are calculated by distance from the nearest outlet: ₹${BUSINESS.deliveryBaseFee} for the first ${BUSINESS.deliveryBaseKm} km, plus ₹${BUSINESS.deliveryPerKmFee} per additional kilometre.`,
            `Same-day delivery is available for orders placed before ${BUSINESS.sameDayCutoff}, subject to stock and slot availability. Delivery windows are estimates, not guarantees.`,
            'Our full delivery terms — slots, failed deliveries, address accuracy and delays — are set out in our Shipping & Delivery Policy, which forms part of these terms.',
          ],
        },
        {
          heading: 'When nobody is there to receive the order',
          body: [
            'Because most of what we deliver is a gift, the recipient is often not the person who ordered it. It is your responsibility to give an address where someone can receive the delivery during the chosen slot, and a phone number on which the recipient can be reached.',
            'If nobody is available, our delivery person will attempt to contact the recipient and then you. Where it is safe and reasonable, we may leave the order with a neighbour, a building security desk, or a reception, and that counts as delivered. Where we cannot deliver at all, the order may be returned to the outlet, and because flowers perish quickly we cannot generally re-deliver or refund in that case. See our Cancellation & Refund Policy.',
          ],
        },
        {
          heading: 'Cancellation and refunds',
          body: [
            'You may cancel free of charge at any time before your order is dispatched. Once it has been dispatched it cannot be cancelled, because the arrangement has been made to order and cannot be resold.',
            'If what arrives is damaged, wrong, or does not arrive at all, you are entitled to a full refund or a free replacement. The full process, timelines and evidence we ask for are in our Cancellation & Refund Policy, which forms part of these terms.',
          ],
        },
        {
          heading: 'Reviews and anything you post',
          body: [
            'If you leave a review, you confirm it reflects your genuine experience and that you have the right to post what you have written. Do not post anything unlawful, abusive, defamatory, or that identifies another person without their consent.',
            'You keep ownership of what you write, and grant us a non-exclusive, royalty-free licence to display it on this site. We may decline to publish, or remove, any review that breaches this clause.',
          ],
        },
        {
          heading: 'Our content',
          body: [
            'The Fresh N Petals name, logo, site design, photographs and text are our property or licensed to us, and are protected by Indian copyright and trade mark law. You may not copy or reuse them commercially without our written permission.',
          ],
        },
        {
          heading: 'Liability',
          body: [
            'We are responsible for delivering what you ordered, in good condition, on the date you selected, on the terms set out here.',
            'We are not liable for indirect or consequential loss — for example a missed occasion, disappointment, or loss of profit — arising from a late or failed delivery. Except where the law does not allow it to be limited, our total liability for any order is capped at the amount you paid for that order.',
            'Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot lawfully be limited.',
          ],
        },
        {
          heading: 'Events outside our control',
          body: [
            'We are not liable for failure or delay caused by something beyond our reasonable control: extreme weather, floods, strikes, civil unrest, curfews or restrictions imposed by authority, transport failures, power or internet outages, or supply failures at the flower market. If such an event prevents delivery, we will contact you to reschedule or refund you in full.',
          ],
        },
        {
          heading: 'Changes to these terms',
          body: [
            'We may update these terms. The version in force for your order is the one published when you place it, and the "Last updated" date above tells you when the current version took effect.',
          ],
        },
        {
          heading: 'Governing law and disputes',
          body: [
            `These terms are governed by the laws of India. Subject to the paragraph below, the courts at ${BUSINESS.jurisdictionCity}, ${BUSINESS.jurisdictionState} have exclusive jurisdiction.`,
            'Nothing here prevents you from bringing a complaint before a Consumer Commission having jurisdiction where you live, as the Consumer Protection Act, 2019 entitles you to do.',
            'Please contact us first — most problems are resolved the same day.',
          ],
        },
        {
          heading: 'Grievance redressal',
          body: [
            'Complaints may be addressed to our Grievance Officer:',
            `${BUSINESS.proprietorName}\nGrievance Officer, ${BUSINESS.tradeName}\n${BUSINESS.registeredAddress}\nEmail: ${BUSINESS.supportEmail}\nPhone: ${BUSINESS.supportPhone}\nHours: ${BUSINESS.supportHours}`,
            'We acknowledge complaints within 48 hours and aim to resolve them within 30 days, as required by the Consumer Protection (E-Commerce) Rules, 2020.',
          ],
        },
      ]}
    />
  );
}
