import 'server-only';

export interface OrderAlertItem {
  name: string;
  quantity: number;
  /** Customer-facing (migration 0069). */
  color?: string | null;
  /** Owner-only packing details (migration 0070) — never rendered to a
   *  customer, only in the owner's order alert. */
  flowerType?: string | null;
  sizeLabel?: string | null;
  packaging?: string | null;
  ownerNote?: string | null;
}

/**
 * Meta caps a single template parameter at 1024 characters. Leaving room
 * for the "N products, M units — " prefix and the truncation suffix.
 */
const SUMMARY_BUDGET = 900;

/**
 * Trims, and collapses any internal whitespace to single spaces.
 *
 * The collapsing is not cosmetic: Meta rejects a template parameter
 * containing a newline or tab outright, and the owner note is free text
 * typed into an admin field — one stray line break there would fail the
 * entire order alert. Normalising here means no caller has to remember.
 */
function clean(value: string | null | undefined): string | null {
  const normalised = value?.replace(/\s+/g, ' ').trim();
  return normalised ? normalised : null;
}

/**
 * One item as it appears in the owner's WhatsApp alert:
 *
 *   Dozen Red Roses — Red · Rose · 12 stems · Hand-tie ×2 (note: gold ribbon)
 *
 * Every descriptor is optional and absent ones simply vanish, so a
 * product with nothing filled in still reads `Dozen Red Roses ×2`
 * exactly as before these fields existed.
 *
 * The descriptors exist because the product title alone was ambiguous
 * when an alert arrived — two similarly-named arrangements are hard to
 * tell apart, but the flower, colour and size are not.
 */
export function buildOrderItemLabel(item: OrderAlertItem): string {
  const descriptors = [
    clean(item.color),
    clean(item.flowerType),
    clean(item.sizeLabel),
    clean(item.packaging),
  ].filter((value): value is string => value !== null);

  const note = clean(item.ownerNote);

  return [
    clean(item.name) ?? item.name,
    descriptors.length > 0 ? ` — ${descriptors.join(' · ')}` : '',
    ` ×${item.quantity}`,
    note ? ` (note: ${note})` : '',
  ].join('');
}

/**
 * The whole order as the alert's `{{2}}` parameter.
 *
 * Joined with " · " rather than newlines because Meta rejects template
 * parameters containing newline or tab characters outright — a
 * multi-line list fails the send rather than looking untidy.
 *
 * Truncated to a character budget for the same reason: with four
 * descriptors per item a large order can pass Meta's 1024-character
 * parameter limit and have the whole alert refused. The counts in the
 * prefix are computed from the *full* list, so they stay accurate even
 * when the visible list is cut short — the owner is never misled about
 * how much was ordered.
 */
export function buildOrderItemsSummary(items: OrderAlertItem[]): string {
  if (items.length === 0) return 'No items on file';

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const prefix = `${items.length} product${items.length === 1 ? '' : 's'}, ${totalUnits} unit${totalUnits === 1 ? '' : 's'} — `;

  const labels = items.map(buildOrderItemLabel);

  const included: string[] = [];
  let used = 0;
  for (const label of labels) {
    const cost = label.length + (included.length > 0 ? 3 : 0);
    if (used + cost > SUMMARY_BUDGET && included.length > 0) break;
    included.push(label);
    used += cost;
  }

  const omitted = labels.length - included.length;
  const body =
    included.join(' · ') +
    (omitted > 0 ? ` · +${omitted} more item${omitted === 1 ? '' : 's'}` : '');

  return `${prefix}${body}`;
}
