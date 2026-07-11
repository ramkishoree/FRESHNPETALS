import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/**
 * Ch.16 §75 Account Preferences API. `preferred_language`/
 * `marketing_opt_in` are real `customers` columns (Ch.10 §31); Preferred
 * Outlet/Delivery Time/Newsletter have no dedicated columns anywhere in
 * Ch.10 — held in `customers.metadata.preferences` (already a flexible
 * jsonb column) rather than a new migration for three narrow fields.
 */
const patchSchema = z.object({
  preferredOutletId: zUuid().optional(),
  preferredDeliveryTime: z.string().optional(),
  newsletterOptIn: z.boolean().optional(),
  preferredLanguage: z.string().min(2).max(10).optional(),
  marketingOptIn: z.boolean().optional(),
});

const getPreferences = createApiRoute({
  handler: async () => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('customers')
      .select('preferred_language, marketing_opt_in, metadata')
      .eq('id', customer.id)
      .single();
    if (error)
      return err(new InfrastructureError('Failed to load preferences.', { cause: error.message }));

    const metadata = (data.metadata as Record<string, unknown> | null) ?? {};
    return ok({
      preferredLanguage: data.preferred_language,
      marketingOptIn: data.marketing_opt_in,
      ...((metadata['preferences'] as Record<string, unknown> | undefined) ?? {}),
    });
  },
});

const updatePreferences = createApiRoute({
  bodySchema: patchSchema,
  handler: async ({ body }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { preferredLanguage, marketingOptIn, ...metadataPrefs } = body;

    const { data: current } = await supabase
      .from('customers')
      .select('metadata')
      .eq('id', customer.id)
      .single();
    const currentMetadata = (current?.metadata as Record<string, unknown> | null) ?? {};
    const currentPreferences =
      (currentMetadata['preferences'] as Record<string, unknown> | undefined) ?? {};

    const patch: Record<string, unknown> = {
      metadata: {
        ...currentMetadata,
        preferences: { ...currentPreferences, ...metadataPrefs },
      },
    };
    if (preferredLanguage !== undefined) patch['preferred_language'] = preferredLanguage;
    if (marketingOptIn !== undefined) patch['marketing_opt_in'] = marketingOptIn;

    const { error } = await supabase.from('customers').update(patch).eq('id', customer.id);
    if (error)
      return err(
        new InfrastructureError('Failed to update preferences.', { cause: error.message }),
      );
    return ok({ ...metadataPrefs, preferredLanguage, marketingOptIn });
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return getPreferences(request);
}

export async function PATCH(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return updatePreferences(request);
}
