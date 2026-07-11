import { BusinessRuleError, err, InfrastructureError, ok } from '@prana/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createApiRoute } from '@/server/http/route-handler';
import { getCurrentCustomer } from '@/server/customer/current-customer';
import { runSecurityChain } from '@/server/security/chain';

/** Ch.16 §73 Address API. RLS (`customer_addresses_select_own`/`_insert_own`) is the real ownership boundary; `customer_id` here still has to be supplied for the insert (RLS's WITH CHECK verifies it, doesn't invent it). */
const createSchema = z.object({
  label: z.string().max(40).optional(),
  recipientName: z.string().min(1).max(120),
  phone: z.string().min(6).max(20),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postalCode: z.string().min(4).max(12),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
  deliveryNotes: z.string().optional(),
});

const listAddresses = createApiRoute({
  handler: async () => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('customer_addresses')
      .select(
        'id, label, recipient_name, phone, address_line_1, address_line_2, city, state, postal_code, latitude, longitude, is_default, delivery_notes',
      )
      .eq('customer_id', customer.id)
      .is('deleted_at', null)
      .order('is_default', { ascending: false });
    if (error)
      return err(new InfrastructureError('Failed to list addresses.', { cause: error.message }));
    return ok(data ?? []);
  },
});

const createAddress = createApiRoute({
  bodySchema: createSchema,
  handler: async ({ body }) => {
    const supabase = await createSupabaseServerClient();
    const customer = await getCurrentCustomer(supabase);
    if (!customer)
      return err(new BusinessRuleError('No customer profile found.', { httpStatus: 404 }));

    const { data, error } = await supabase
      .from('customer_addresses')
      .insert({
        customer_id: customer.id,
        label: body.label,
        recipient_name: body.recipientName,
        phone: body.phone,
        address_line_1: body.addressLine1,
        address_line_2: body.addressLine2,
        city: body.city,
        state: body.state,
        postal_code: body.postalCode,
        latitude: body.latitude,
        longitude: body.longitude,
        is_default: body.isDefault ?? false,
        delivery_notes: body.deliveryNotes,
      })
      .select()
      .single();
    if (error)
      return err(new InfrastructureError('Failed to create address.', { cause: error.message }));
    return ok(data);
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return listAddresses(request);
}

export async function POST(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'authenticated', requireAuth: true });
  if (blocked) return blocked;
  return createAddress(request);
}
