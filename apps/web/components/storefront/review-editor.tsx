'use client';

import { Star, X } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const MAX_IMAGES = 3;

/**
 * Editing a review you already left.
 *
 * Same three things the form collects, because the thing people most
 * often want to change is the part they got wrong: a comment written in
 * annoyance, a photo that came out badly, a star count they
 * reconsidered. Name stays as written — changing the attribution on a
 * published review is a different thing from correcting it.
 *
 * Photos are submitted as the complete intended set (`keepImages` plus
 * any new files) rather than as add/remove instructions, so what the
 * reviewer sees here is exactly what gets stored.
 */
export function ReviewEditor({
  productId,
  reviewId,
  token,
  initialRating,
  initialComment,
  initialImages,
  onDone,
  onCancel,
}: {
  productId: string;
  reviewId: string;
  token: string;
  initialRating: number;
  initialComment: string;
  initialImages: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [rating, setRating] = React.useState(initialRating);
  const [hoverRating, setHoverRating] = React.useState(0);
  const [comment, setComment] = React.useState(initialComment);
  const [keptImages, setKeptImages] = React.useState(initialImages);
  const [files, setFiles] = React.useState<File[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  const totalImages = keptImages.length + files.length;

  function pickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    const room = MAX_IMAGES - keptImages.length;
    if (picked.length > room) {
      toast.error(`Up to ${MAX_IMAGES} photos in total — remove one first.`);
    }
    setFiles(picked.slice(0, Math.max(0, room)));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1) {
      toast.error('Please choose a star rating.');
      return;
    }

    setIsSaving(true);
    try {
      const body = new FormData();
      body.set('rating', String(rating));
      body.set('comment', comment.trim());
      // Always sent, even when empty: an empty list is how "remove every
      // photo" is expressed.
      for (const url of keptImages) body.append('keepImages', url);
      for (const file of files) body.append('images', file);

      const response = await fetch(`/api/v1/products/${productId}/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'x-review-token': token },
        body,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? 'Could not save your changes.');
      }

      toast.success('Your review has been updated.');
      onDone();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not save your changes.');
    } finally {
      setIsSaving(false);
    }
  }

  const shownRating = hoverRating || rating;

  return (
    <form onSubmit={save} className="rounded-card border-border space-y-4 border p-4">
      <div className="grid gap-1.5">
        <span className="text-caption text-foreground font-medium">Your rating</span>
        <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
          {Array.from({ length: 5 }, (_, index) => {
            const value = index + 1;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoverRating(value)}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                aria-pressed={rating === value}
                className="p-0.5"
              >
                <Star
                  className={
                    value <= shownRating
                      ? 'fill-accent text-accent size-6'
                      : 'text-muted-foreground size-6 fill-none'
                  }
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`edit-comment-${reviewId}`}>Comment</Label>
        <Textarea
          id={`edit-comment-${reviewId}`}
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Leave this empty to remove your comment."
        />
      </div>

      {keptImages.length > 0 && (
        <div className="grid gap-1.5">
          <span className="text-caption text-foreground font-medium">Your photos</span>
          <div className="flex flex-wrap gap-2">
            {keptImages.map((url) => (
              <div key={url} className="relative">
                <Image
                  src={url}
                  alt="Photo from your review"
                  width={80}
                  height={80}
                  className="size-20 rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => setKeptImages((current) => current.filter((it) => it !== url))}
                  aria-label="Remove this photo"
                  className="bg-background border-border absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {keptImages.length < MAX_IMAGES && (
        <div className="grid gap-1.5">
          <Label htmlFor={`edit-images-${reviewId}`}>
            Add photos ({totalImages} of {MAX_IMAGES})
          </Label>
          <Input
            id={`edit-images-${reviewId}`}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            onChange={pickFiles}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
