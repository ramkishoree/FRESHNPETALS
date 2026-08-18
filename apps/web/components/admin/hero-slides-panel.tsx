'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface HeroSlideRow {
  id: string;
  slot_order: number;
  media_type: 'image' | 'video';
  media_url: string;
  caption_text: string | null;
  is_active: boolean;
}

const SLOTS = [1, 2, 3, 4] as const;
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/webm';
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

/**
 * The four homepage hero slots.
 *
 * Fixed cards rather than an add/remove list, because the hero itself is
 * fixed: four slots, the first of them video. That is a property of the
 * band on the homepage, not a preference, so the screen states it
 * instead of letting an admin build a fifth slot that would never
 * appear.
 *
 * Each card previews at the real shape the homepage will use (21:9), so
 * "will my crop survive?" is answered here rather than after publishing.
 */
export function HeroSlidesPanel() {
  const [slides, setSlides] = React.useState<HeroSlideRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [busySlot, setBusySlot] = React.useState<number | null>(null);
  const [captions, setCaptions] = React.useState<Record<number, string>>({});
  const fileInputs = React.useRef<Record<number, HTMLInputElement | null>>({});

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/admin/hero-slides');
      const body = await response.json();
      if (response.ok && body.success) {
        const rows = body.data as HeroSlideRow[];
        setSlides(rows);
        setCaptions(
          Object.fromEntries(rows.map((row) => [row.slot_order, row.caption_text ?? ''])),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void load();
  }, [load]);

  async function save(slot: number, options: { file?: File; isActive?: boolean }) {
    setBusySlot(slot);
    try {
      const existing = slides.find((row) => row.slot_order === slot);
      const body = new FormData();
      body.set('slotOrder', String(slot));
      body.set('captionText', captions[slot] ?? '');
      body.set('isActive', String(options.isActive ?? existing?.is_active ?? true));
      if (options.file) body.set('file', options.file);

      const response = await fetch('/api/v1/admin/hero-slides', { method: 'POST', body });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? 'Could not save this slot.');
      }

      const saved = payload.data as HeroSlideRow;
      setSlides((current) => [...current.filter((row) => row.slot_order !== slot), saved]);
      toast.success(`Slot ${slot} is live on the homepage.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not save this slot.');
    } finally {
      setBusySlot(null);
    }
  }

  async function clear(slot: number) {
    setBusySlot(slot);
    try {
      const response = await fetch(`/api/v1/admin/hero-slides/${slot}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? 'Could not empty this slot.');
      }
      setSlides((current) => current.filter((row) => row.slot_order !== slot));
      setCaptions((current) => ({ ...current, [slot]: '' }));
      toast.success(`Slot ${slot} is empty. The hero skips it.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not empty this slot.');
    } finally {
      setBusySlot(null);
    }
  }

  if (isLoading) {
    return <p className="text-caption text-muted-foreground">Loading hero slots…</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {SLOTS.map((slot) => {
        const slide = slides.find((row) => row.slot_order === slot);
        const isVideoSlot = slot === 1;
        const busy = busySlot === slot;

        return (
          <section key={slot} className="border-border space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-foreground font-semibold">
                Slot {slot}
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {isVideoSlot ? 'Video — max ~4 sec' : 'Photo'}
                </span>
              </h2>
              {slide && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={slide.is_active}
                    disabled={busy}
                    onCheckedChange={(checked) => void save(slot, { isActive: checked })}
                  />
                  {slide.is_active ? 'Showing' : 'Hidden'}
                </label>
              )}
            </div>

            {/* The real homepage shape, so a crop is judged here and not
                after it is already live. */}
            <div className="bg-muted relative aspect-[21/9] w-full overflow-hidden rounded-md">
              {slide ? (
                slide.media_type === 'video' ? (
                  <video
                    src={slide.media_url}
                    muted
                    loop
                    autoPlay
                    playsInline
                    className="size-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-only preview of an already-optimized Supabase asset
                  <img src={slide.media_url} alt="" className="size-full object-cover" />
                )
              ) : (
                <p className="text-caption text-muted-foreground grid size-full place-items-center">
                  Empty — the hero skips this slot
                </p>
              )}
              {slide?.caption_text && (
                <p className="absolute right-3 bottom-2 left-3 text-sm font-medium text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">
                  {slide.caption_text}
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`hero-caption-${slot}`}>Caption (optional)</Label>
              <Input
                id={`hero-caption-${slot}`}
                maxLength={160}
                placeholder="Summer blooms are near"
                value={captions[slot] ?? ''}
                onChange={(event) =>
                  setCaptions((current) => ({ ...current, [slot]: event.target.value }))
                }
              />
              <p className="text-caption text-muted-foreground">
                Recommended: 1440×480px landscape{' '}
                {isVideoSlot ? 'video (MP4, about 4 seconds)' : 'image'} — it is cropped to a taller
                16:9 shape on phones, so keep anything important away from the left and right edges.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => fileInputs.current[slot]?.click()}
              >
                {busy ? 'Working…' : slide ? 'Replace file' : 'Upload file'}
              </Button>
              <Button type="button" disabled={busy || !slide} onClick={() => void save(slot, {})}>
                Save caption
              </Button>
              {slide && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void clear(slot)}
                >
                  Empty this slot
                </Button>
              )}
              <input
                ref={(element) => {
                  fileInputs.current[slot] = element;
                }}
                type="file"
                accept={isVideoSlot ? VIDEO_ACCEPT : IMAGE_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void save(slot, { file });
                }}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
