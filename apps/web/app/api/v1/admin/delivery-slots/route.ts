import { BusinessRuleError } from '@prana/core';
import { z } from 'zod';
import { zUuid } from '@/lib/uuid';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createAdminCrudCollectionRoute } from '@/server/http/admin-crud-route';

/** Ch.16 §106 Delivery Slot Management API. */
const schema = z.object({
  // Optional, and resolved below. There is one delivery group ("Standard
  // delivery"), every slot belongs to it, and the admin form was asking
  // for its UUID by hand — a required field whose only correct answer
  // the owner had to go and look up. Still accepted when supplied, so an
  // API client can target a specific group if a second one is ever added.
  delivery_group_id: zUuid().optional(),
  label: z.string().min(1),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  max_capacity: z.number().int().positive(),
  is_active: z.boolean().optional(),
  holiday_override: z.record(z.string(), z.unknown()).optional(),
});

export const { GET, POST } = createAdminCrudCollectionRoute({
  table: 'delivery_slots',
  service: 'delivery',
  aggregateType: 'delivery_slot',
  filterKeys: ['delivery_group_id', 'is_active'],
  createSchema: schema,
  async beforeCreate(body) {
    if (body['delivery_group_id']) return body;

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('delivery_groups')
      .select('id')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BusinessRuleError('Could not look up the delivery group for this slot.', {
        httpStatus: 500,
      });
    }
    if (!data) {
      // Nothing to attach the slot to. Saying so beats a foreign-key
      // violation surfacing as an opaque infrastructure error.
      throw new BusinessRuleError(
        'No active delivery group exists, so this slot has nothing to belong to.',
        { httpStatus: 409 },
      );
    }
    return { ...body, delivery_group_id: data.id };
  },
});
