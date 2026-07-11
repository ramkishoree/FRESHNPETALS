'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Ch.12 §56 Media Library upload — the real thing, not the metadata-only
 * form AdminResourcePage's generic dialog can offer (it has no file-input
 * field type; file uploads are multipart, not the JSON body every other
 * admin resource form sends). Every file goes through
 * /api/v1/admin/media/upload, which converts it to WebP server-side —
 * this button never sees or trusts a client-side conversion.
 */
export function MediaUploadButton({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [altText, setAltText] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      toast.error('Choose an image first.');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (altText) formData.append('altText', altText);

      const response = await fetch('/api/v1/admin/media/upload', {
        method: 'POST',
        body: formData,
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Upload failed.');
      }
      toast.success('Uploaded and converted to WebP.');
      setOpen(false);
      setFile(null);
      setAltText('');
      onUploaded();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Upload image</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleUpload}>
            <DialogHeader>
              <DialogTitle>Upload image</DialogTitle>
              <DialogDescription>
                Converted to WebP automatically. JPEG, PNG, WebP, GIF, or AVIF, up to 15MB.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="media-file">Image</Label>
                <Input
                  id="media-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="media-alt">Alt text</Label>
                <Input
                  id="media-alt"
                  value={altText}
                  onChange={(event) => setAltText(event.target.value)}
                  placeholder="Describes the image for accessibility and SEO"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading || !file}>
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
