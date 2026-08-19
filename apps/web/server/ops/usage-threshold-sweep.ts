import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/config/env';
import { isEmailConfigured, sendEmail } from '@/server/email/resend-client';
import { logger } from '@/server/logger';

/**
 * Supabase's published free-tier ceilings (as of 2026): 500 MB database,
 * 1 GB combined file storage, 50,000 MAU. Warn at 80% so there's real
 * runway to upgrade before anything actually breaks.
 */
const DATABASE_LIMIT_BYTES = 500 * 1024 * 1024;
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
const MAU_LIMIT = 50_000;
const WARN_RATIO = 0.8;

interface UsageSnapshot {
  database_size_bytes: number;
  media_bucket_bytes: number;
  invoices_bucket_bytes: number;
  auth_user_count: number;
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Owner runs on Vercel Hobby + Supabase Free by design until traffic
 * justifies paying — this is the tripwire that emails the developer
 * (not the store owner) in advance of hitting either tier's ceiling,
 * rather than finding out when writes start failing. `auth_user_count`
 * is total registered accounts, not a true rolling-30-day MAU count —
 * an honest proxy, not the real metric, but for a store this size it
 * only matters once it's already in the thousands.
 */
export async function sweepUsageThresholds(admin: SupabaseClient): Promise<void> {
  const env = getServerEnv();
  if (!env.DEV_ALERT_EMAIL) {
    logger.warn('worker.usage_threshold.no_alert_email_configured');
    return;
  }
  if (!isEmailConfigured()) {
    logger.warn('worker.usage_threshold.email_not_configured');
    return;
  }

  const { data, error } = await admin.rpc('admin_get_usage_snapshot').single();
  if (error || !data) {
    logger.error('worker.usage_threshold.snapshot_failed', { message: error?.message });
    return;
  }
  const snapshot = data as unknown as UsageSnapshot;
  const storageBytes = snapshot.media_bucket_bytes + snapshot.invoices_bucket_bytes;

  const warnings: string[] = [];
  if (snapshot.database_size_bytes >= DATABASE_LIMIT_BYTES * WARN_RATIO) {
    warnings.push(
      `Database size: ${formatMb(snapshot.database_size_bytes)} of ${formatMb(DATABASE_LIMIT_BYTES)} free-tier limit.`,
    );
  }
  if (storageBytes >= STORAGE_LIMIT_BYTES * WARN_RATIO) {
    warnings.push(
      `File storage: ${formatMb(storageBytes)} of ${formatMb(STORAGE_LIMIT_BYTES)} free-tier limit.`,
    );
  }
  if (snapshot.auth_user_count >= MAU_LIMIT * WARN_RATIO) {
    warnings.push(
      `Registered accounts: ${snapshot.auth_user_count} of ${MAU_LIMIT} free-tier MAU limit.`,
    );
  }

  if (warnings.length === 0) {
    logger.info('worker.usage_threshold.ok', {
      storageBytes,
      database: snapshot.database_size_bytes,
    });
    return;
  }

  try {
    await sendEmail({
      to: env.DEV_ALERT_EMAIL,
      subject: `Fresh N Petals: nearing free-tier limit (${warnings.length} area${warnings.length > 1 ? 's' : ''})`,
      html: `<div style="font-family:sans-serif;font-size:14px;color:#222;">
        <p><strong>Fresh N Petals is approaching a Supabase free-tier limit:</strong></p>
        <ul>${warnings.map((w) => `<li>${w}</li>`).join('')}</ul>
        <p>Upgrade the affected resource in the Supabase dashboard (Project Settings → Billing) before it's fully hit — writes/uploads start failing once a limit is reached.</p>
      </div>`,
    });
    logger.info('worker.usage_threshold.alert_sent', { warnings });
  } catch (cause) {
    logger.error('worker.usage_threshold.alert_send_failed', {
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
}
