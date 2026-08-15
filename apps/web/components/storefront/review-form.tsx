'use client';

import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { rememberReviewToken } from '@/lib/my-reviews';

const MAX_IMAGES = 3;

/**
 * Leave a review without an account.
 *
 * The owner's call: a customer should be able to say what arrived
 * without signing up first. A name and a rating are required — an
 * unattributed or unrated review tells nobody anything — while the
 * comment and photos are optional, because plenty of people will rate
 * and move on.
 *
 * Client-side checks here are for a quick answer, not for safety: the
 * route re-validates everything, sniffs the real file type and
 * re-encodes each image, since nothing arriving from a browser can be
 * trusted.
 */
export function ReviewForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [authorName, setAuthorName] = React.useState('');
  const [rating, setRating] = React.useState(0);
  const [hoverRating, setHoverRating] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  function pickFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length > MAX_IMAGES) {
      toast.error(`Up to ${MAX_IMAGES} photos, please.`);
    }
    setFiles(picked.slice(0, MAX_IMAGES));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (authorName.trim().length < 2) {
      toast.error('Please enter your name.');
      return;
    }
    if (rating < 1) {
      toast.error('Please choose a star rating.');
      return;
    }

    setIsSubmitting(true);
    try {
      const body = new FormData();
      body.set('authorName', authorName.trim());
      body.set('rating', String(rating));
      body.set('comment', comment.trim());
      for (const file of files) body.append('images', file);

      const response = await fetch(`/api/v1/products/${productId}/reviews`, {
        method: 'POST',
        body,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? 'Could not post your review.');
      }

      // The token is the only way back to this review: without an
      // account, it is what proves authorship when they want to edit or
      // withdraw it later.
      if (payload.data?.id && payload.data?.editToken) {
        rememberReviewToken(payload.data.id, payload.data.editToken);
      }

      toast.success('Thank you — your review is live.');
      setAuthorName('');
      setRating(0);
      setComment('');
      setFiles([]);
      // The list is server-rendered, so refresh rather than splicing the
      // new review in — that way what's on screen is what's stored.
      router.refresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not post your review.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const shownRating = hoverRating || rating;

  return (
    <form onSubmit={submit} className="rounded-card border-border mb-6 space-y-4 border p-4 sm:p-5">
      <div>
        <h3 className="text-h4 text-foreground font-semibold">Write a review</h3>
        <p className="text-caption text-muted-foreground">
          No account needed. Your name and rating are required — a comment and photos are up to you.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="review-name">Your name *</Label>
          <Input
            id="review-name"
            required
            maxLength={80}
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Anaya S."
          />
        </div>

        <div className="grid gap-1.5">
          <span className="text-caption text-foreground font-medium">Your rating *</span>
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
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="review-comment">Comment (optional)</Label>
        <Textarea
          id="review-comment"
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="How did it arrive? Was it as expected?"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="review-images">Photos (optional, up to {MAX_IMAGES})</Label>
        <Input
          id="review-images"
          type="file"
          accept="image/jpeg,image/png"
          multiple
          onChange={pickFiles}
        />
        {files.length > 0 && (
          <p className="text-caption text-muted-foreground">
            {files.length} photo{files.length === 1 ? '' : 's'} selected
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Posting…' : 'Post review'}
      </Button>
    </form>
  );
}
