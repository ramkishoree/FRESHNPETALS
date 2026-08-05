#!/usr/bin/env node
// Uploads a `.jpg` sibling next to every `.webp` image already in the media
// bucket. New uploads get both formats from the media route, but everything
// stored before that change has only the WebP — and Meta's WhatsApp template
// header refuses WebP, which is what silenced the owner's order alerts.
//
// Safe to re-run: an object whose sibling already exists is skipped, and
// nothing is ever deleted or overwritten.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/backfill-jpeg-siblings.mjs [--dry-run]

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BUCKET = 'media';
const JPEG_QUALITY = 82;
const dryRun = process.argv.includes('--dry-run');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

/** Every object path under `prefix`, recursing into folders. */
async function listAll(prefix) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`);

  const paths = [];
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Storage marks folders by returning no object id.
    if (entry.id === null) paths.push(...(await listAll(path)));
    else paths.push(path);
  }
  return paths;
}

async function main() {
  const all = await listAll('');
  const webps = all.filter((path) => path.toLowerCase().endsWith('.webp'));
  const existing = new Set(all);

  console.log(`${all.length} objects in "${BUCKET}", ${webps.length} of them .webp`);

  let created = 0;
  let skipped = 0;
  const failures = [];

  for (const webpPath of webps) {
    const jpegPath = `${webpPath.slice(0, -'.webp'.length)}.jpg`;
    if (existing.has(jpegPath)) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  would create ${jpegPath}`);
      created += 1;
      continue;
    }

    try {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(webpPath);
      if (downloadError) throw new Error(downloadError.message);

      const jpeg = await sharp(Buffer.from(await blob.arrayBuffer()))
        .rotate()
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(jpegPath, jpeg, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      console.log(`  ✓ ${jpegPath} (${jpeg.length} bytes)`);
      created += 1;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.log(`  ✗ ${jpegPath}: ${message}`);
      failures.push(jpegPath);
    }
  }

  console.log(
    `\n${dryRun ? 'would create' : 'created'} ${created}, skipped ${skipped} already present, ${failures.length} failed`,
  );
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
