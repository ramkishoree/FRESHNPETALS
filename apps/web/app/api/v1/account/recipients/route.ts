import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.16 §74 Recipient API — "frequently used recipients," available during checkout (Phase 10). */
const createSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(6).max(20),
  relationship: z.string().max(60).optional(),
  defaultMessage: z.string().max(500).optional(),
  addressId: z.string().uuid().optional(),
});

const listRecipients = createApiRoute({
  handler: async () => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('recipients')
      .select('id, name, phone, relationship, default_message, address_id')
      .eq('customer_id', customer.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error)
      return err(new InfrastructureError('Failed to list recipients.', { cause: error.message }));
    return ok(data ?? []);
  },
});

const createRecipient = createApiRoute({
  bodySchema: createSchema,
  handler: async ({ body }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('recipients')
      .insert({
        customer_id: customer.id,
        name: body.name,
        phone: body.phone,
        relationship: body.relationship,
        default_message: body.defaultMessage,
        address_id: body.addressId,
      })
      .select()
      .single();
    if (error)
      return err(new InfrastructureError('Failed to create recipient.', { cause: error.message }));
    return ok(data);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return listRecipients(request);
}

export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return createRecipient(request);
}
