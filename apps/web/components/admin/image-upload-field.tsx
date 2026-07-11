'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * A URL text field an admin can still paste into directly, plus an Upload
 * button that goes through the same /api/v1/admin/media/upload pipeline as
 * the Media Library (real file → server-side WebP conversion → Supabase
 * Storage) rather than requiring a separate trip to Media Library to
 * upload, then copy the CDN URL, then paste it back here.
 */
export function ImageUploadField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/v1/admin/media/upload', {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Upload failed.');
      }
      onChange(body.data.cdn_url as string);
      toast.success('Uploaded and converted to WebP.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          placeholder="https:// or upload a file"
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-only preview of an arbitrary external/uploaded URL, not a storefront asset next/image should optimize
        <img
          src={value}
          alt="Preview"
          className="border-border h-24 w-24 rounded-md border object-cover"
        />
      )}
    </div>
  );
}
