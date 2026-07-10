import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { stripUndefined } from '@/lib/strip-undefined';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

interface RouteParams {
  id: string;
}

const patchSchema = z.object({
  label: z.string().max(40).optional(),
  recipientName: z.string().min(1).max(120).optional(),
  phone: z.string().min(6).max(20).optional(),
  addressLine1: z.string().min(1).optional(),
  addressLine2: z.string().optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  postalCode: z.string().min(4).max(12).optional(),
  isDefault: z.boolean().optional(),
  deliveryNotes: z.string().optional(),
});

const updateAddress = createApiRoute<undefined, unknown, z.infer<typeof patchSchema>, RouteParams>({
  bodySchema: patchSchema,
  handler: async ({ body, params }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const patch = stripUndefined({
      label: body.label,
      recipient_name: body.recipientName,
      phone: body.phone,
      address_line_1: body.addressLine1,
      address_line_2: body.addressLine2,
      city: body.city,
      state: body.state,
      postal_code: body.postalCode,
      is_default: body.isDefault,
      delivery_notes: body.deliveryNotes,
    });

    const { data, error } = await supabase
      .from('customer_addresses')
      .update(patch)
      .eq('id', params.id)
      .eq('customer_id', customer.id)
      .select()
      .single();
    if (error)
      return err(new InfrastructureError('Failed to update address.', { cause: error.message }));
    return ok(data);
  },
});

const deleteAddress = createApiRoute<undefined, { id: string }, undefined, RouteParams>({
  handler: async ({ params }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { error } = await supabase
      .from('customer_addresses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('customer_id', customer.id);
    if (error)
      return err(new InfrastructureError('Failed to delete address.', { cause: error.message }));
    return ok({ id: params.id });
  },
});

export async function PATCH(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return updateAddress(request, await context.params);
}

export async function DELETE(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return deleteAddress(request, await context.params);
}
