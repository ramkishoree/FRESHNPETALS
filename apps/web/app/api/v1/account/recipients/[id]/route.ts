import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { stripUndefined } from '@/lib/strip-undefined';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().min(6).max(20).optional(),
  relationship: z.string().max(60).optional(),
  defaultMessage: z.string().max(500).optional(),
  addressId: zUuid().optional(),
});

const updateRecipient = createApiRoute<
  undefined,
  unknown,
  z.infer<typeof patchSchema>,
  RouteParams
>({
  bodySchema: patchSchema,
  handler: async ({ body, params }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const patch = stripUndefined({
      name: body.name,
      phone: body.phone,
      relationship: body.relationship,
      default_message: body.defaultMessage,
      address_id: body.addressId,
    });

    const { data, error } = await supabase
      .from('recipients')
      .update(patch)
      .eq('id', params.id)
      .eq('customer_id', customer.id)
      .select()
      .single();
    if (error)
      return err(new InfrastructureError('Failed to update recipient.', { cause: error.message }));
    return ok(data);
  },
});

const deleteRecipient = createApiRoute<undefined, { id: string }, undefined, RouteParams>({
  handler: async ({ params }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { error } = await supabase
      .from('recipients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('customer_id', customer.id);
    if (error)
      return err(new InfrastructureError('Failed to delete recipient.', { cause: error.message }));
    return ok({ id: params.id });
  },
});

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return updateRecipient(request, await context.params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return deleteRecipient(request, await context.params);
}
