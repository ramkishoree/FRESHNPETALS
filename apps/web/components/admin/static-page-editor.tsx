'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const PAGE_STATUSES = ['draft', 'published', 'archived'] as const;

interface HomeHeroContent {
  title?: string;
  titleHighlight?: string;
  subtitle?: string;
  ctaLabel?: string;
}

interface StaticPageBlock {
  type?: string;
  text?: string;
}

export interface StaticPageEditorProps {
  page: {
    id: string;
    title: string;
    slug: string;
    status: string;
    content: unknown;
  };
}

/**
 * Owner's explicit call: the old form exposed `content` as a raw JSON
 * textarea ("too technical... just edit text, replace picture"). The
 * homepage hero is the one page with real structured fields (headline/
 * highlight/subtitle/button) — those get plain text inputs. Every other
 * static page (About/Contact/Privacy/Terms/FAQ/Delivery Policy) only
 * ever renders `content.blocks[].text` as plain paragraphs
 * (static-page-content.tsx, whitespace-pre-line), so one big plain-text
 * box — blank line between paragraphs — round-trips through that same
 * shape with zero JSON in sight.
 */
export function StaticPageEditor({ page }: StaticPageEditorProps) {
  const router = useRouter();
  const isHome = page.slug === 'home';

  const [title, setTitle] = React.useState(page.title);
  const [status, setStatus] = React.useState(page.status);
  const [isSaving, setIsSaving] = React.useState(false);

  const hero = (isHome ? (page.content as HomeHeroContent | null) : null) ?? {};
  const [heroTitle, setHeroTitle] = React.useState(hero.title ?? '');
  const [heroHighlight, setHeroHighlight] = React.useState(hero.titleHighlight ?? '');
  const [heroSubtitle, setHeroSubtitle] = React.useState(hero.subtitle ?? '');
  const [heroCta, setHeroCta] = React.useState(hero.ctaLabel ?? '');

  const initialBodyText = React.useMemo(() => {
    if (isHome) return '';
    const blocks = (page.content as { blocks?: StaticPageBlock[] } | null)?.blocks ?? [];
    return blocks
      .map((block) => block.text ?? '')
      .join('\n\n')
      .trim();
  }, [isHome, page.content]);
  const [bodyText, setBodyText] = React.useState(initialBodyText);

  async function handleSave() {
    if (!title.trim()) {
      toast.error('Title is required.');
      return;
    }

    setIsSaving(true);
    try {
      const content = isHome
        ? {
            title: heroTitle,
            titleHighlight: heroHighlight,
            subtitle: heroSubtitle,
            ctaLabel: heroCta,
          }
        : { blocks: bodyText.trim() ? [{ type: 'paragraph', text: bodyText }] : [] };

      const response = await fetch(`/api/v1/admin/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status, content }),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error?.message ?? 'Failed to save page.');

      toast.success('Saved.');
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <section className="border-border grid gap-4 rounded-[var(--r-lg)] border p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Page title</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {isHome ? (
        <section className="border-border space-y-4 rounded-[var(--r-lg)] border p-6">
          <h2 className="text-h4 text-foreground font-semibold">Homepage hero</h2>
          <div>
            <Label className="mb-1.5 block">Headline</Label>
            <Input
              value={heroTitle}
              onChange={(event) => setHeroTitle(event.target.value)}
              placeholder="Fresh flowers, delivered"
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Highlighted word</Label>
            <Input
              value={heroHighlight}
              onChange={(event) => setHeroHighlight(event.target.value)}
              placeholder="same-day."
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Subtitle</Label>
            <Textarea
              value={heroSubtitle}
              onChange={(event) => setHeroSubtitle(event.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">Button text</Label>
            <Input
              value={heroCta}
              onChange={(event) => setHeroCta(event.target.value)}
              placeholder="Shop now"
            />
          </div>
        </section>
      ) : (
        <section className="border-border space-y-2 rounded-[var(--r-lg)] border p-6">
          <h2 className="text-h4 text-foreground font-semibold">Page text</h2>
          <p className="text-caption text-muted-foreground">
            Leave a blank line between paragraphs.
          </p>
          <Textarea
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            rows={14}
          />
        </section>
      )}

      <div className="flex gap-3">
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/pages')}>
          Back to list
        </Button>
      </div>
    </div>
  );
}
