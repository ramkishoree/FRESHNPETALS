'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ProductMediaItem {
  id: string;
  media_type: 'image' | 'video';
  url: string;
  thumbnail_url: string | null;
  position: number;
}

const ACCEPTED_TYPES =
  'image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,video/3gpp,video/mpeg,video/ogg';

/**
 * Ch.12 §56 gallery variant — a product previously had exactly one
 * `featured_image` and nowhere else to attach photos or video. This
 * manages the `product_media` rows: upload (any common image/video
 * format, converted server-side), delete, reorder.
 */
export function ProductMediaGallery({ productId }: { productId: string | undefined }) {
  const [items, setItems] = React.useState<ProductMediaItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadItems = React.useCallback(async () => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/v1/admin/products/${productId}/media`);
      const body = await response.json();
      if (response.ok && body.success) setItems(body.data as ProductMediaItem[]);
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial gallery fetch on mount/productId change
    void loadItems();
  }, [loadItems]);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !productId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/v1/admin/products/${productId}/media`, {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Upload failed.');
      }
      setItems((prev) => [...prev, body.data as ProductMediaItem]);
      toast.success(
        file.type.startsWith('video/')
          ? 'Video uploaded and compressed.'
          : 'Photo uploaded and converted to WebP.',
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(mediaId: string) {
    if (!productId) return;
    const previous = items;
    setItems((prev) => prev.filter((item) => item.id !== mediaId));
    try {
      const response = await fetch(`/api/v1/admin/products/${productId}/media/${mediaId}`, {
        method: 'DELETE',
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Delete failed.');
      }
    } catch (cause) {
      setItems(previous);
      toast.error(cause instanceof Error ? cause.message : 'Delete failed.');
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    if (!productId) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(targetIndex, 0, moved);
    setItems(reordered);

    await Promise.all(
      reordered.map((item, position) =>
        fetch(`/api/v1/admin/products/${productId}/media/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position }),
        }),
      ),
    );
  }

  if (!productId) {
    return (
      <p className="text-caption text-muted-foreground">
        Save the product first, then come back here to add more photos and videos.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((item, index) => (
            <div key={item.id} className="border-border relative overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-only gallery thumbnail of an already-optimized Supabase-hosted asset */}
              <img
                src={item.media_type === 'video' ? (item.thumbnail_url ?? item.url) : item.url}
                alt=""
                className="aspect-square w-full object-cover"
              />
              {item.media_type === 'video' && (
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Video
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 px-1 py-1">
                <button
                  type="button"
                  className="text-xs text-white disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => void handleMove(index, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="text-xs text-white hover:text-red-300"
                  onClick={() => void handleDelete(item.id)}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="text-xs text-white disabled:opacity-30"
                  disabled={index === items.length - 1}
                  onClick={() => void handleMove(index, 1)}
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isLoading && items.length === 0 && (
        <p className="text-caption text-muted-foreground">Loading gallery…</p>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? 'Uploading…' : 'Add photo or video'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleFileSelected}
        />
        <p className="text-caption text-muted-foreground mt-1">
          Most photo and video formats accepted — converted automatically to a storage-light format.
          Videos capped at 50MB.
        </p>
      </div>
    </div>
  );
}
