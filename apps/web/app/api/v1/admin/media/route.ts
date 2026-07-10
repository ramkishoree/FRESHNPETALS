import { z } from 'zod';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/**
 * Ch.16 (Media Library, under CMS) / Ch.12 §56. The file bytes themselves
 * go straight from the browser to Supabase Storage via a signed upload
 * URL (standard direct-to-storage pattern, not routed through this API);
 * this endpoint registers the resulting asset's metadata once that
 * upload completes.
 */
const schema = z.object({
  filename: z.string().min(1),
  mime_type: z.string().min(1),
  storage_path: z.string().min(1),
  cdn_url: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  filesize: z.number().int().positive().optional(),
  dominant_color: z.string().optional(),
  blur_hash: z.string().optional(),
  alt_text: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'media_library',
  service: 'media',
  aggregateType: 'media_asset',
  searchColumns: ['filename', 'alt_text'],
  trackAttribution: false,
  createSchema: schema,
});
