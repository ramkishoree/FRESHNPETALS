import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Owner's explicit call after removing the WhatsApp support bot: a
 * plain direct-call button, nothing more — tapping it just dials the
 * owner's real number (tel: link), no backend involvement, no call
 * routing/IVR.
 */
export function ContactUsButton({ ownerPhoneNumber }: { ownerPhoneNumber: string | undefined }) {
  if (!ownerPhoneNumber) return null;

  return (
    <Button asChild variant="outline">
      <a href={`tel:${ownerPhoneNumber}`}>
        <Phone className="size-4" />
        Contact us
      </a>
    </Button>
  );
}
