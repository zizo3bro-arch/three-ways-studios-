import type { EmailOrder, EmailLineItem } from './types.js';

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BRAND = {
  crimson: '#8a1f2c',
  paper: '#f8f4ec',
  ink: '#1c1a16',
  muted: '#6d675c',
};

function money(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `EGP ${n.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLine(value: unknown): string {
  const d = new Date(String(value ?? ''));
  if (Number.isNaN(d.getTime())) return '';
  return d.toUTCString();
}

function itemsTable(items: EmailLineItem[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5dece;font-size:14px;color:${BRAND.ink};">
            ${esc(item.product_name)}<br />
            <span style="color:${BRAND.muted};font-size:12px;">${esc(item.color_name)} &middot; ${esc(item.size_name)}</span>
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5dece;font-size:14px;color:${BRAND.ink};text-align:center;">${esc(item.quantity)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5dece;font-size:14px;color:${BRAND.ink};text-align:right;white-space:nowrap;">${esc(money(item.unit_price))}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5dece;font-size:14px;color:${BRAND.ink};text-align:right;white-space:nowrap;">${esc(money(item.line_total))}</td>
        </tr>`
    )
    .join('');
  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0;">
      <thead>
        <tr>
          <th style="padding:8px;border-bottom:2px solid ${BRAND.crimson};text-align:left;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">Item</th>
          <th style="padding:8px;border-bottom:2px solid ${BRAND.crimson};text-align:center;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">Qty</th>
          <th style="padding:8px;border-bottom:2px solid ${BRAND.crimson};text-align:right;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">Unit price</th>
          <th style="padding:8px;border-bottom:2px solid ${BRAND.crimson};text-align:right;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">Line total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function totalsTable(rows: Array<[string, unknown, boolean?]>): string {
  return rows
    .map(([label, value, emphasis]) => {
      const emphasisStyle = emphasis
        ? `font-weight:700;font-size:16px;color:${BRAND.crimson};`
        : 'color:${BRAND.ink};';
      return `
        <tr>
          <td style="padding:6px 0;font-size:14px;${emphasisStyle}">${esc(label)}</td>
          <td style="padding:6px 0;text-align:right;font-size:14px;${emphasisStyle}">${esc(money(value))}</td>
        </tr>`;
    })
    .join('');
}


/**
 * Order-level totals, shared by both email layouts. Subtotal → discounts →
 * shipping → total. Discount lines are shown whenever > 0 so a customer never
 * mistakes the email for a receipt with discounts applied elsewhere.
 */
function totalsTableRows(order: EmailOrder): Array<[string, unknown, boolean?]> {
  const rows: Array<[string, unknown, boolean?]> = [['Subtotal', order.subtotal]];
  if (Number(order.email_discount_amount) > 0) rows.push(['Email discount', order.email_discount_amount]);
  if (Number(order.loyalty_discount_amount) > 0) rows.push(['Loyalty discount', order.loyalty_discount_amount]);
  if (Number(order.promo_discount_amount) > 0) {
    rows.push(order.applied_promo_code ? [`Promo ${order.applied_promo_code}`, order.promo_discount_amount] : ['Promo discount', order.promo_discount_amount]);
  }
  if (Number(order.shipping_cost) > 0) rows.push(['Shipping', order.shipping_cost]);
  rows.push(['Total', order.total_amount, true]);
  return rows;
}

function layout(title: string, subtitle: string, innerHtml: string, footerNote: string): string {
  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper};font-family: Georgia, 'Times New Roman', serif;color:${BRAND.ink};">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding:26px 0 6px;">
      <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:${BRAND.crimson};font-weight:700;">Three Ways Studios</div>
      <div style="margin-top:10px;">
        <div style="font-size:24px;line-height:1.3;font-weight:700;letter-spacing:.01em;">${esc(title)}</div>
        <div style="margin-top:8px;font-size:13px;color:${BRAND.muted};">${esc(subtitle)}</div>
      </div>
    </div>

    <div style="background:#ffffff;border-radius:14px;padding:8px 28px 18px;box-shadow:0 1px 10px rgba(28,26,22,.07);">
      ${innerHtml}
    </div>

    <div style="text-align:center;font-size:12px;color:${BRAND.muted};padding:18px 10px 30px;line-height:1.7;">
      ${footerNote}
    </div>
  </div>
</body>
</html>`.trim();
}

export function buildCustomerConfirmationEmailHtml(order: EmailOrder): { subject: string; html: string } {
  const ref = esc(order.order_reference);
  const rawRef = order.order_reference;
  const items = itemsTable(order.items);
  const subtotal = money(order.subtotal);
  const discountRows = totalsTableRows(order);
  const html = layout(
    'Order received',
    `We have received your order. ${rawRef} will be prepared with care.`,
    `
      <div style="padding:14px 0 4px;">
        <p style="font-size:16px;line-height:1.65;margin:0;">Dear ${esc(order.customer_name)},</p>
        <p style="font-size:15px;line-height:1.65;margin:14px 0 0;">Your order <strong>${ref}</strong> has been received. Cash on delivery — no payment is taken online.</p>
        <p style="font-size:13px;color:${BRAND.muted};line-height:1.6;margin:12px 0 0;">Placed ${esc(dateLine(order.created_at))}. Delivery to ${esc(order.city)}, ${esc(order.governorate)}.</p>
      </div>
      ${items}
      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <tbody>${totalsTable(discountRows)}</tbody>
      </table>
      ${order.loyalty_free_reward_product_name ? `<p style="font-size:13px;line-height:1.6;color:${BRAND.crimson};margin:10px 0 4px;"><em>${esc(order.loyalty_free_reward_product_name)}</em> is included as your loyalty reward.</p>` : ''}
      <p style="font-size:13px;line-height:1.7;margin:12px 0 8px;">Questions? Reply to this email — the studio team handles every customer.</p>
      <p style="font-size:12px;line-height:1.7;color:${BRAND.muted};margin:0 0 18px;">Subtotal: ${esc(subtotal)}. After discounts and shipping, your total is ${esc(money(order.total_amount))}.</p>
    `,
    'Three Ways Studios &middot; Cairo, Egypt. Cash on delivery — we never charge you online.'
  );
  return {
    subject: `Order confirmation — ${order.order_reference}`,
    html,
  };
}

export function buildAdminNewOrderEmailHtml(order: EmailOrder): { subject: string; html: string } {
  const ref = esc(order.order_reference);
  const subtotal = money(order.subtotal);
  const html = layout(
    'New order received',
    'A new cash-on-delivery order was placed and is ready for preparation.',
    `
      <p style="font-size:15px;line-height:1.65;margin:10px 0 0;">New order <strong>${ref}</strong></p>
      <p style="font-size:13px;color:${BRAND.muted};line-height:1.6;margin:8px 0 0;">Placed ${esc(dateLine(order.created_at))} &middot; Payment: ${esc(order.payment_method)} &middot; Status: ${esc(order.status)}</p>

      <div style="margin:16px 0 0;padding:14px 16px;background:${BRAND.paper};border-radius:10px;">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.muted};">Customer</div>
        <p style="font-size:15px;font-weight:700;margin:6px 0 0;">${esc(order.customer_name)}</p>
        <p style="font-size:13px;line-height:1.7;margin:8px 0 0;">
          ${esc(order.customer_phone)}<br />
          ${esc(order.customer_email)}<br />
          ${esc(order.city)}, ${esc(order.governorate)}<br />
          ${esc(order.delivery_address)}
        </p>
        ${order.order_notes ? `<p style="font-size:12px;line-height:1.6;color:${BRAND.muted};margin:10px 0 0;">Notes: ${esc(order.order_notes)}</p>` : ''}
      </div>

      ${itemsTable(order.items)}

      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <tbody>${totalsTable(totalsTableRows(order))}</tbody>
      </table>
      <p style="font-size:12px;line-height:1.7;color:${BRAND.muted};margin:8px 0 14px;">Subtotal before discounts: ${esc(subtotal)}. Do not reply to this email — reply to the customer on the studio console.</p>
    `,
    'Internal notification &middot; Three Ways Studios staff only.'
  );
  return {
    subject: `New order ${order.order_reference} — Three Ways Studios`,
    html,
  };
}
