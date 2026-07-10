import { StaticPageContent } from '@/components/storefront/static-page-content';

// A submittable contact form needs an outbound email integration (Resend)
// that hasn't been wired into this build yet — this renders whatever
// contact information is published in the CMS (phone/email/address)
// rather than a form that would silently go nowhere.
export default function ContactPage() {
  return <StaticPageContent slug="contact" fallbackTitle="Contact us" />;
}
