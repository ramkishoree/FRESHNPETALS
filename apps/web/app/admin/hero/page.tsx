import { HeroSlidesPanel } from '@/components/admin/hero-slides-panel';

export default function HeroBannersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2 text-foreground font-bold">Hero banners</h1>
        <p className="text-caption text-muted-foreground">
          The band at the top of the homepage. Four photo slots, rotating every four seconds. Upload
          at 2400 × 900 px for the sharpest result. Changes go live the moment you save; nothing
          needs deploying.
        </p>
      </div>
      <HeroSlidesPanel />
    </div>
  );
}
