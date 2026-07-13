import { Flower2, ShieldCheck, Star, Truck } from 'lucide-react';

const FEATURES = [
  { icon: Truck, title: 'Same-day delivery', subtitle: 'Across Lucknow' },
  { icon: Flower2, title: 'Hand-picked', subtitle: 'Fresh & beautiful' },
  { icon: Star, title: 'Trusted by locals', subtitle: '4.7★ Google rating' },
  { icon: ShieldCheck, title: 'Secure payments', subtitle: '100% safe checkout' },
] as const;

/** Owner's reference mockup: a row of trust signals directly under the hero. */
export function HeroFeatureStrip() {
  return (
    <div className="container-brand grid grid-cols-2 gap-x-6 gap-y-5 pb-10 sm:grid-cols-4 sm:gap-x-8">
      {FEATURES.map(({ icon: Icon, title, subtitle }) => (
        <div key={title} className="flex items-center gap-3">
          <Icon className="size-5 shrink-0 text-[var(--gold-deep)]" strokeWidth={1.75} />
          <div className="min-w-0">
            <p className="text-caption truncate font-semibold text-[var(--sf-ink)]">{title}</p>
            <p className="text-caption truncate text-[var(--sf-ink-muted)]">{subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
