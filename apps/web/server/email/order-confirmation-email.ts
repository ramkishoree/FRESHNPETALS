import 'server-only';

export interface OrderConfirmationItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string | null;
}

export interface OrderConfirmationEmailParams {
  recipient: 'customer' | 'owner';
  orderNumber: string;
  orderDate: Date;
  recipientName: string;
  formattedAddress: string;
  deliveryDate?: string;
  deliveryTime?: string;
  items: OrderConfirmationItem[];
  subtotal: number;
  deliveryFee: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  businessName: string;
  businessPhone: string | null;
  adminOrderUrl?: string;
}

function formatInr(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Real gap this fills: no customer-facing order email existed at all
 * before this — only a bare owner alert (order number + total, no
 * items). One template covers both recipients since the content is
 * almost entirely the same; `recipient` only changes the greeting and
 * whether an admin deep-link is shown.
 *
 * deliveryDate/deliveryTime are only shown when the checkout snapshot
 * actually recorded a slot (customer picked one) — never fabricated.
 */
export function buildOrderConfirmationEmailHtml(params: OrderConfirmationEmailParams): string {
  const {
    recipient,
    orderNumber,
    orderDate,
    recipientName,
    formattedAddress,
    deliveryDate,
    deliveryTime,
    items,
    subtotal,
    deliveryFee,
    taxTotal,
    discountTotal,
    grandTotal,
    businessName,
    businessPhone,
    adminOrderUrl,
  } = params;

  // Distinct products and total units are different numbers, and a
  // multi-item order was only ever implying either. Two roses and one
  // lily reads "2 products · 3 items", so nothing has to be counted by
  // eye against the packing list.
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemCountLabel =
    items.length === totalUnits
      ? `${items.length} ${items.length === 1 ? 'item' : 'items'}`
      : `${items.length} products · ${totalUnits} items`;

  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            ${
              item.imageUrl
                ? `<td style="padding-right:12px;"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" width="56" height="56" style="border-radius:8px;object-fit:cover;display:block;" /></td>`
                : ''
            }
            <td>
              <div style="font-weight:600;color:#1a1a1a;">${escapeHtml(item.name)}</div>
              <div style="color:#777;font-size:13px;">Qty ${item.quantity} × ${formatInr(item.unitPrice)}</div>
            </td>
          </tr></table>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:#1a1a1a;">
          ${formatInr(item.lineTotal)}
        </td>
      </tr>`,
    )
    .join('');

  const greeting =
    recipient === 'customer'
      ? `<h1 style="font-size:20px;margin:0 0 6px;">Thank you, ${escapeHtml(recipientName)}! 🌸</h1>
         <p style="color:#555;margin:0 0 24px;">Your order is confirmed and being arranged fresh.</p>`
      : `<h1 style="font-size:20px;margin:0 0 6px;">New order placed</h1>
         <p style="color:#555;margin:0 0 24px;">${escapeHtml(recipientName)} — ${escapeHtml(orderNumber)}</p>`;

  const adminLink =
    recipient === 'owner' && adminOrderUrl
      ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(adminOrderUrl)}" style="color:#a1732d;">Open this order in the admin panel →</a></p>`
      : '';

  const careLine = businessPhone
    ? `<p style="color:#555;font-size:14px;margin:16px 0 0;">Questions about your order? Call us at <strong>${escapeHtml(businessPhone)}</strong>.</p>`
    : '';

  const deliverySlotLine =
    deliveryDate || deliveryTime
      ? `<p style="color:#555;font-size:14px;margin:0 0 4px;">Scheduled delivery: <strong>${escapeHtml([deliveryDate, deliveryTime].filter(Boolean).join(' · '))}</strong></p>`
      : '';

  const deliveryCommitment =
    recipient === 'customer'
      ? `<p style="color:#555;font-size:14px;margin:0 0 20px;">We arrange and dispatch same-day wherever possible — we'll be in touch if your delivery window changes. Your invoice is attached to this email.</p>`
      : '';

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#faf7f2;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#2f4a3c;padding:24px 32px;">
                <span style="color:#fff;font-size:18px;font-weight:700;">${escapeHtml(businessName)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${greeting}
                <p style="color:#555;font-size:14px;margin:0 0 4px;"><strong>Order ${escapeHtml(orderNumber)}</strong> · ${orderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p style="color:#555;font-size:14px;margin:0 0 4px;">Delivering to: ${escapeHtml(formattedAddress)}</p>
                ${deliverySlotLine}
                <div style="margin-bottom:16px;"></div>
                ${deliveryCommitment}

                <p style="color:#777;font-size:13px;margin:0 0 4px;font-weight:600;">${itemCountLabel}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${itemsHtml}
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                  <tr><td style="padding:4px 0;color:#555;">Subtotal</td><td style="padding:4px 0;text-align:right;color:#555;">${formatInr(subtotal)}</td></tr>
                  ${discountTotal > 0 ? `<tr><td style="padding:4px 0;color:#555;">Discount</td><td style="padding:4px 0;text-align:right;color:#555;">-${formatInr(discountTotal)}</td></tr>` : ''}
                  <tr><td style="padding:4px 0;color:#555;">Delivery fee</td><td style="padding:4px 0;text-align:right;color:#555;">${formatInr(deliveryFee)}</td></tr>
                  <tr><td style="padding:4px 0;color:#555;">Tax</td><td style="padding:4px 0;text-align:right;color:#555;">${formatInr(taxTotal)}</td></tr>
                  <tr><td style="padding:10px 0 0;font-weight:700;font-size:16px;border-top:1px solid #eee;">Total</td><td style="padding:10px 0 0;text-align:right;font-weight:700;font-size:16px;border-top:1px solid #eee;">${formatInr(grandTotal)}</td></tr>
                </table>

                ${careLine}
                ${adminLink}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
