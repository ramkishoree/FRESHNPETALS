import { Button } from '@/components/ui/button';

/**
 * Deep-links straight into a chat with the dedicated support number,
 * pre-filled with "Order #<number>: " — this prefix is how
 * bot-runtime.ts links a brand-new conversation to the right order and
 * customer without needing a phone-number-to-customer lookup table.
 */
export function WhatsAppSupportButton({
  orderNumber,
  whatsappBusinessNumber,
}: {
  orderNumber: string;
  whatsappBusinessNumber: string | undefined;
}) {
  if (!whatsappBusinessNumber) return null;

  const prefilledText = encodeURIComponent(`Order #${orderNumber}: `);
  const href = `https://wa.me/${whatsappBusinessNumber}?text=${prefilledText}`;

  return (
    <Button asChild variant="outline">
      <a href={href} target="_blank" rel="noopener noreferrer">
        WhatsApp Support
      </a>
    </Button>
  );
}
