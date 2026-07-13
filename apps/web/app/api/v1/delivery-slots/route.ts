import type { NextRequest } from 'next/server';
import { InfrastructureError, ValidationError, err, ok } from '@prana/core';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createApiRoute } from '@/server/http/route-handler';
import { runSecurityChain } from '@/server/security/chain';

/**
 * GET /api/v1/delivery-slots?date=YYYY-MM-DD (optional, defaults to today IST)
 *
 * Storefront-facing read of the same delivery_slots admin manages at
 * /admin/delivery-slots. A slot is "bookable" when it's active, has
 * remaining capacity, and — for today only — starts at least 90 minutes
 * from now (owner's explicit rule: no slot within 1.5h of checkout time,
 * since prep + dispatch needs the lead time). Slots for any future date
 * are bookable purely on capacity; there's no per-date row, the same
 * slot template repeats daily.
 *
 * IST is a fixed UTC+5:30 offset (no DST), computed directly rather than
 * pulling in a timezone library for one conversion.
 */
const CUTOFF_MINUTES = 90;

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function istPartsNow(): { year: number; month: number; day: number; minutesOfDay: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    minutesOfDay: get('hour') * 60 + get('minute'),
  };
}

function istDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addDays(
  year: number,
  month: number,
  day: number,
  delta: number,
): [number, number, number] {
  // UTC noon avoids any DST-adjacent edge case in Date's own arithmetic;
  // only the calendar date component is used from the result.
  const d = new Date(Date.UTC(year, month - 1, day, 12));
  d.setUTCDate(d.getUTCDate() + delta);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const route = createApiRoute({
  querySchema,
  handler: async ({ query }) => {
    const now = istPartsNow();
    const todayStr = istDateString(now.year, now.month, now.day);
    const requestedDate = query.date ?? todayStr;

    if (requestedDate < todayStr) {
      return err(new ValidationError('That date has already passed — pick today or later.'));
    }

    const isToday = requestedDate === todayStr;

    const admin = createSupabaseAdminClient();
    const { data: slots, error } = await admin
      .from('delivery_slots')
      .select('id, label, start_time, end_time, max_capacity, current_bookings, is_active')
      .eq('is_active', true)
      .order('start_time', { ascending: true });

    if (error) {
      return err(
        new InfrastructureError('Failed to load delivery slots.', { cause: error.message }),
      );
    }

    const cutoffMinutes = now.minutesOfDay + CUTOFF_MINUTES;

    const result = (slots ?? []).map((slot) => {
      const startMinutes = timeStringToMinutes(slot.start_time);
      const hasCapacity = slot.current_bookings < slot.max_capacity;
      const meetsLeadTime = !isToday || startMinutes >= cutoffMinutes;
      return {
        id: slot.id,
        label: slot.label,
        startTime: slot.start_time,
        endTime: slot.end_time,
        bookable: hasCapacity && meetsLeadTime,
      };
    });

    const hasBookableSlot = result.some((s) => s.bookable);
    const nextAvailableDate = hasBookableSlot
      ? null
      : istDateString(...addDays(now.year, now.month, now.day, 1));

    return ok({ date: requestedDate, slots: result, hasBookableSlot, nextAvailableDate });
  },
});

export async function GET(request: NextRequest) {
  const blocked = await runSecurityChain(request, { tier: 'anonymous' });
  if (blocked) return blocked;
  return route(request);
}
