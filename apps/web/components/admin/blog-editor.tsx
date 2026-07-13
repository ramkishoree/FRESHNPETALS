'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { ImageUploadField } from '@/components/admin/image-upload-field';
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
import { slugify } from '@/lib/slugify';

const BLOG_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const;

type BlockType = 'heading' | 'subheading' | 'paragraph' | 'image';

interface EditorBlock {
  key: string;
  blockType: BlockType;
  text: string;
  url: string;
  alt: string;
}

interface RawBlock {
  blockType: 'heading' | 'paragraph' | 'image';
  text?: string;
  level?: number;
  url?: string;
  alt?: string;
}

let keyCounter = 0;
function newKey(): string {
  keyCounter += 1;
  return `block-${keyCounter}-${Date.now()}`;
}

function rawToEditorBlock(raw: RawBlock): EditorBlock {
  const blockType: BlockType =
    raw.blockType === 'heading' ? (raw.level === 3 ? 'subheading' : 'heading') : raw.blockType;
  return { key: newKey(), blockType, text: raw.text ?? '', url: raw.url ?? '', alt: raw.alt ?? '' };
}

function editorBlockToRaw(block: EditorBlock): RawBlock {
  if (block.blockType === 'image') return { blockType: 'image', url: block.url, alt: block.alt };
  if (block.blockType === 'heading') return { blockType: 'heading', level: 2, text: block.text };
  if (block.blockType === 'subheading') return { blockType: 'heading', level: 3, text: block.text };
  return { blockType: 'paragraph', text: block.text };
}

export interface BlogEditorProps {
  blog?: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    featured_image: string;
    status: string;
  };
  initialBlocks?: RawBlock[];
}

/**
 * Owner's explicit ask: "a blog maker with all headings subheading etc
 * like notion and ability to add pictures where I want like blogspot."
 * blog_blocks (migration 0009) has always been position-ordered and
 * type-generic — this is the missing manual writing surface for it, now
 * that apply-agent-output.ts (the AI's own writer) is gone. Blocks have
 * no identity beyond position, so editing is add/reorder/delete freely
 * in local state, then one Save replaces the whole ordered list
 * server-side (see /api/v1/admin/blogs/[id]/blocks).
 */
export function BlogEditor({ blog, initialBlocks }: BlogEditorProps) {
  const router = useRouter();
  const isNew = !blog;

  const [title, setTitle] = React.useState(blog?.title ?? '');
  const [slug, setSlug] = React.useState(blog?.slug ?? '');
  const [slugTouched, setSlugTouched] = React.useState(Boolean(blog?.slug));
  const [excerpt, setExcerpt] = React.useState(blog?.excerpt ?? '');
  const [featuredImage, setFeaturedImage] = React.useState(blog?.featured_image ?? '');
  const [status, setStatus] = React.useState(blog?.status ?? 'draft');
  const [blocks, setBlocks] = React.useState<EditorBlock[]>(() =>
    (initialBlocks ?? []).map(rawToEditorBlock),
  );
  const [isSaving, setIsSaving] = React.useState(false);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function addBlock(blockType: BlockType) {
    setBlocks((prev) => [...prev, { key: newKey(), blockType, text: '', url: '', alt: '' }]);
  }

  function updateBlock(key: string, patch: Partial<EditorBlock>) {
    setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }

  function removeBlock(key: string) {
    setBlocks((prev) => prev.filter((b) => b.key !== key));
  }

  function moveBlock(key: string, direction: -1 | 1) {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.key === key);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim() || !slug.trim()) {
      toast.error('Title and slug are required.');
      return;
    }

    setIsSaving(true);
    try {
      const metadata = {
        title,
        slug,
        excerpt,
        featured_image: featuredImage,
        status,
      };

      let blogId = blog?.id;
      if (isNew) {
        const response = await fetch('/api/v1/admin/blogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata),
        });
        const body = await response.json();
        if (!response.ok || !body.success)
          throw new Error(body.error?.message ?? 'Failed to create post.');
        blogId = body.data.id;
      } else {
        const response = await fetch(`/api/v1/admin/blogs/${blogId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata),
        });
        const body = await response.json();
        if (!response.ok || !body.success)
          throw new Error(body.error?.message ?? 'Failed to save post.');
      }

      const blocksResponse = await fetch(`/api/v1/admin/blogs/${blogId}/blocks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: blocks.map(editorBlockToRaw) }),
      });
      const blocksBody = await blocksResponse.json();
      if (!blocksResponse.ok || !blocksBody.success)
        throw new Error(blocksBody.error?.message ?? 'Failed to save content.');

      toast.success('Saved.');
      if (isNew) {
        router.push(`/admin/blogs/${blogId}`);
      } else {
        router.refresh();
      }
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* ---- Post details ---- */}
      <section className="border-border grid gap-4 rounded-[var(--r-lg)] border p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Title</Label>
          <Input value={title} onChange={(e) => handleTitleChange(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block">Slug</Label>
          <Input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOG_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Excerpt</Label>
          <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block">Featured image</Label>
          <ImageUploadField id="featured_image" value={featuredImage} onChange={setFeaturedImage} />
        </div>
      </section>

      {/* ---- Content blocks ---- */}
      <section className="space-y-4">
        <h2 className="text-h4 text-foreground font-semibold">Content</h2>

        {blocks.length === 0 && (
          <p className="text-body text-muted-foreground">
            No content yet — add a heading, paragraph, or image to start writing.
          </p>
        )}

        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div
              key={block.key}
              className="border-border flex gap-2 rounded-[var(--r-md)] border p-4"
            >
              <div className="flex flex-1 flex-col gap-2">
                <span className="text-caption text-muted-foreground uppercase">
                  {block.blockType}
                </span>
                {block.blockType === 'image' ? (
                  <>
                    <ImageUploadField
                      id={`${block.key}-url`}
                      value={block.url}
                      onChange={(url) => updateBlock(block.key, { url })}
                    />
                    <Input
                      placeholder="Alt text (for accessibility)"
                      value={block.alt}
                      onChange={(e) => updateBlock(block.key, { alt: e.target.value })}
                    />
                  </>
                ) : block.blockType === 'paragraph' ? (
                  <Textarea
                    value={block.text}
                    onChange={(e) => updateBlock(block.key, { text: e.target.value })}
                    rows={4}
                    placeholder="Write a paragraph..."
                  />
                ) : (
                  <Input
                    value={block.text}
                    onChange={(e) => updateBlock(block.key, { text: e.target.value })}
                    placeholder={block.blockType === 'heading' ? 'Heading' : 'Subheading'}
                    className={
                      block.blockType === 'heading'
                        ? 'text-h4 font-bold'
                        : 'text-body-lg font-semibold'
                    }
                  />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => moveBlock(block.key, -1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === blocks.length - 1}
                  onClick={() => moveBlock(block.key, 1)}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => removeBlock(block.key)}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock('heading')}>
            + Heading
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock('subheading')}>
            + Subheading
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock('paragraph')}>
            + Paragraph
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addBlock('image')}>
            + Image
          </Button>
        </div>
      </section>

      <div className="flex gap-3">
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/admin/blogs')}>
          Back to list
        </Button>
      </div>
    </div>
  );
}
