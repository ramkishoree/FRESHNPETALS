import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { stripUndefined } from '@/lib/strip-undefined';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.16 §72 Customer Profile API. */
const patchSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  phone: z.string().min(6).max(20).optional(),
  preferredLanguage: z.string().min(2).max(10).optional(),
  marketingOptIn: z.boolean().optional(),
});

const getProfile = createApiRoute({
  handler: async () => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('customers')
      .select(
        'id, first_name, last_name, email, phone, preferred_language, marketing_opt_in, created_at',
      )
      .eq('id', customer.id)
      .single();
    if (error)
      return err(new InfrastructureError('Failed to load profile.', { cause: error.message }));
    return ok(data);
  },
});

const updateProfile = createApiRoute({
  bodySchema: patchSchema,
  handler: async ({ body }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const patch: Record<string, unknown> = {};
    if (body.firstName !== undefined) patch['first_name'] = body.firstName;
    if (body.lastName !== undefined) patch['last_name'] = body.lastName;
    if (body.phone !== undefined) patch['phone'] = body.phone;
    if (body.preferredLanguage !== undefined) patch['preferred_language'] = body.preferredLanguage;
    if (body.marketingOptIn !== undefined) patch['marketing_opt_in'] = body.marketingOptIn;

    const { data, error } = await supabase
      .from('customers')
      .update(stripUndefined(patch))
      .eq('id', customer.id)
      .select('id, first_name, last_name, email, phone, preferred_language, marketing_opt_in')
      .single();
    if (error)
      return err(new InfrastructureError('Failed to update profile.', { cause: error.message }));
    return ok(data);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return getProfile(request);
}

export async function PATCH(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return updateProfile(request);
}
