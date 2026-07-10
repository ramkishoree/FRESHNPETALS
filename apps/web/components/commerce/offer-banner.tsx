import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface OfferBannerProps {
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
}

/** Ch.12 §82. Ch.9: offers are public-facing promotions, meant to be advertised. */
export function OfferBanner({
  title,
  description,
  ctaLabel,
  ctaHref,
  className,
}: OfferBannerProps) {
  return (
    <div
      className={cn(
        'rounded-hero-card bg-secondary flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div>
        <p className="text-h4 tracking-heading text-foreground font-bold">{title}</p>
        {description && <p className="text-body text-muted-foreground">{description}</p>}
      </div>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="rounded-button bg-primary text-button text-primary-foreground shrink-0 px-6 py-3 font-semibold transition-transform duration-150 hover:scale-[1.02]"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
