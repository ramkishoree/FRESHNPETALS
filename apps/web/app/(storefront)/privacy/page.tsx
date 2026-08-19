import type { Metadata } from 'next';
import { LegalPage } from '@/components/storefront/legal-page';
import { BUSINESS, LEGAL_OPERATOR } from '@/lib/legal/business-details';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Fresh N Petals collects, uses, shares and protects your personal data, and the rights you have under the Digital Personal Data Protection Act, 2023.',
};

/**
 * Written against the Digital Personal Data Protection Act 2023 (notice,
 * consent, rights, grievance officer), the IT Act 2000 read with the
 * SPDI Rules 2011 (payment and security disclosures), and the Consumer
 * Protection (E-Commerce) Rules 2020 (identity and contact disclosure).
 *
 * The processor list is not generic boilerplate — it is the actual set
 * this codebase transmits personal data to. Anything added to that list
 * in code (a new analytics vendor, a courier API, a chat widget) has to
 * be added here too, or the notice stops being accurate.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="2026-08-02"
      intro={[
        `This policy explains what personal data ${BUSINESS.tradeName} collects when you browse or order from this website, why we collect it, who we share it with, and the control you have over it.`,
        'We ask for the least we need to take an order and get flowers to the right door. We do not sell personal data, and we do not share it for anyone else’s advertising.',
      ]}
      sections={[
        {
          heading: 'Who is responsible for your data',
          body: [
            `${LEGAL_OPERATOR} ("we", "us") is the Data Fiduciary for the personal data described in this policy. Our principal place of business is ${BUSINESS.registeredAddress}.`,
            `You can reach us at ${BUSINESS.supportEmail} or ${BUSINESS.supportPhone}, ${BUSINESS.supportHours}.`,
          ],
        },
        {
          heading: 'What we collect',
          body: [
            'We collect only the following, and only when you give it to us or when it is created by your use of the site:',
            [
              'Identity and contact details — your name, email address and phone number, given when you create an account or place an order.',
              'Delivery details — the recipient name, phone number, the delivery pin you drop on the map, the address Google returns for that pin, and any flat, floor or landmark you add.',
              'Order records — what you ordered, when, the amount, your chosen delivery date and time slot, and any gift message or instruction you write.',
              'Payment status — whether a payment succeeded or failed, and the reference our payment gateway returns. We never receive or store your card number, UPI PIN, CVV or netbanking credentials.',
              'Account security data — your login email and, if you set one, a password stored only as a cryptographic hash.',
              'Aggregate usage counts — a per-day, per-page count of visits, held site-wide with no visitor identifier attached. It cannot be traced back to you.',
            ],
            'We do not collect government identity numbers, biometric data, health data, or your precise background location.',
          ],
        },
        {
          heading: 'Why we use it, and on what basis',
          body: [
            'Under the DPDP Act 2023 we process your data on the basis of the consent you give when you place an order or create an account, and for the legitimate uses the Act permits — chiefly performing the contract you entered into with us. Specifically:',
            [
              'To accept, prepare, deliver and invoice your order.',
              'To calculate the delivery fee, which depends on the distance from the nearest outlet to your pin.',
              'To send you order confirmations, delivery updates and receipts.',
              'To let you sign in, see past orders and reuse a saved address.',
              'To answer your questions and handle complaints, refunds and replacements.',
              'To keep tax and accounting records we are legally required to retain.',
              'To detect and prevent fraud and abuse of the site.',
            ],
            'We do not use your data for automated decision-making that produces a legal effect on you, and we do not build advertising profiles.',
          ],
        },
        {
          heading: 'Who we share it with',
          body: [
            'We share the minimum necessary with the service providers who operate parts of this business. Each acts as a Data Processor on our instructions and is contractually bound to protect the data:',
            [
              'Razorpay — payment processing. Receives your name, email, phone and order amount. Your card and UPI credentials go directly to Razorpay and never pass through our systems.',
              'Supabase — our database, authentication and file storage provider. Holds your account and order records.',
              'Vercel — hosting for this website. Processes request data in the ordinary course of serving pages.',
              'Resend — transactional email delivery. Receives your email address and order details to send confirmations and receipts.',
              'Google Maps Platform — address lookup and the delivery pin. Receives the location you search for or the point you drop.',
              'Meta (WhatsApp Business API) — used to notify the shop owner that an order has come in, and to send you order updates if you have opted into them.',
              'Upstash — caching and rate limiting, which processes technical request data.',
            ],
            'We also disclose data where the law requires it: to a court, a tax authority, or a law-enforcement agency acting under lawful authority.',
            'We do not sell, rent or trade your personal data to anyone.',
          ],
        },
        {
          heading: 'Where your data is stored',
          body: [
            'Our database and file storage are hosted in the United States (Supabase, us-east-1 region), and some of the providers listed above process data outside India. Where data is transferred abroad we rely on those providers’ contractual data-protection commitments, and we transfer only to countries not restricted by the Central Government under section 16 of the DPDP Act.',
          ],
        },
        {
          heading: 'How long we keep it',
          body: [
            [
              'Order, invoice and payment records — retained for eight years from the end of the relevant financial year, as required by Indian tax and company law.',
              'Account details and saved addresses — retained while your account is open, and deleted within 30 days of you closing it, except where an order record must be kept under the line above.',
              'Support correspondence — up to three years from the last message.',
              'Aggregate page-view counts — indefinitely, because they contain no personal data.',
            ],
          ],
        },
        {
          heading: 'Your rights',
          body: [
            'Under the DPDP Act 2023 you may:',
            [
              'Ask for a summary of the personal data we hold about you and how it is being processed.',
              'Ask us to correct anything inaccurate, or complete anything incomplete.',
              'Ask us to erase your data, where we are not required to keep it by law.',
              'Withdraw your consent at any time. Withdrawing it does not affect processing already carried out, and we may then be unable to complete an order in progress.',
              'Nominate another person to exercise these rights on your behalf if you die or become incapacitated.',
              'Complain to the Data Protection Board of India if you are not satisfied with our response.',
            ],
            `To exercise any of these, write to ${BUSINESS.supportEmail}. We will respond within 30 days. We may ask you to confirm your identity first, so that we do not disclose your data to someone else.`,
          ],
        },
        {
          heading: 'How we protect it',
          body: [
            'The site is served only over HTTPS. Passwords are stored as salted hashes, never in readable form. Database access is restricted by row-level security policies so that one customer cannot read another customer’s orders or addresses. Administrative access is limited to the owner and staff who need it. Payment credentials never touch our servers.',
            'No system is perfectly secure, and we do not claim otherwise. If a breach affects your personal data we will notify you and the Data Protection Board as the DPDP Act requires.',
          ],
        },
        {
          heading: 'Cookies and similar technologies',
          body: [
            'We use only what the site needs to work: a session cookie that keeps you signed in, and local storage that remembers your cart between visits. We do not use advertising cookies, third-party trackers, or cross-site analytics. Blocking these will sign you out and empty your cart, but nothing else breaks.',
          ],
        },
        {
          heading: 'Children’s data',
          body: [
            'This site is not intended for children under 18, and we do not knowingly collect their personal data. If you believe a child has given us data, write to us and we will delete it.',
          ],
        },
        {
          heading: 'Changes to this policy',
          body: [
            'If we change this policy we will update the "Last updated" date above. Material changes will also be announced on the site. Continuing to use the site after a change means you accept the updated policy.',
          ],
        },
        {
          heading: 'Grievance officer',
          body: [
            'In accordance with the DPDP Act 2023 and the Information Technology (Intermediary Guidelines) Rules 2021, complaints about the handling of your personal data may be addressed to:',
            `${BUSINESS.proprietorName}\nGrievance Officer, ${BUSINESS.tradeName}\n${BUSINESS.registeredAddress}\nEmail: ${BUSINESS.supportEmail}\nPhone: ${BUSINESS.supportPhone}\nHours: ${BUSINESS.supportHours}`,
            'We acknowledge complaints within 48 hours and aim to resolve them within 30 days.',
          ],
        },
      ]}
    />
  );
}
