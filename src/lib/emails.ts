import { formatEGP } from './format';
import type { OrderItem } from '../types/database';

/* ========================================================================
   THREE WAYS STUDIOS — transactional email content
   Pure presentational layer: no network, no secrets, no framework imports.
   Brand: crimson #a5121b, ink #17130f, paper #f2eee6 / white.
   Responsive: single column, max 600px, stacks cleanly on mobile.
   ======================================================================== */

export interface EmailOrder {
  order_id: string;
  order_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  governorate: string;
  city: string;
  delivery_address: string;
  order_notes: string;
  payment_method: string;
  subtotal: number;
  shipping_cost: number;
  email_discount_amount: number;
  promo_discount_amount: number;
  discount_total: number;
  applied_promo_code: string | null;
  total_amount: number;
  created_at: string;
  status: string;
  items: OrderItem[];
}

export interface EmailAssets {
  /** Public origin of the storefront, used for absolute links and images. */
  siteUrl: string;
  /** Absolute URL of the uploaded Three Ways Studios logo. */
  logoUrl: string;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const BRAND_DISPLAY_NAME = 'Three Ways Studios';
const LOGO_ALT = 'Three Ways Studios logo';

function esc(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(amount: number): string {
  return formatEGP(Number.isFinite(amount) ? amount : 0);
}

function paymentLabel(method: string): string {
  const m = String(method ?? '').trim().toUpperCase();
  return m === 'COD' ? 'Cash on Delivery' : m;
}

function orderDate(createdAt: string): string {
  const date = new Date(createdAt);
  return isNaN(date.getTime())
    ? createdAt
    : date.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function assetUrl(path: string | null | undefined, assets: EmailAssets): string {
  if (!path) return assets.logoUrl;
  if (/^https?:\/\//i.test(path)) return path;
  const root = path.startsWith('/') ? path : `/${path}`;
  return `${assets.siteUrl}${root}`;
}

function itemImageHtml(item: OrderItem, assets: EmailAssets): string {
  const url = assetUrl(item.product_image ?? null, assets);
  return `
    <td class="item-cell">
      <div class="item-image">
        <img src="${esc(url)}" alt="${esc(item.product_name)}" width="64" height="64" />
      </div>
    </td>`;
}

function shell(title: string, body: string, assets: EmailAssets): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} — ${esc(BRAND_DISPLAY_NAME)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');
    body, table, td, p, a, div, span, h1, h2, h3 {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #f2eee6;
      color: #17130f;
      line-height: 1.6;
      -webkit-text-size-adjust: 100%;
    }
    table { border-collapse: collapse; }
    a { color: #a5121b; text-decoration: underline; font-weight: 600; }
    .wrapper { width: 100%; background: #f2eee6; padding: 24px 12px; }
    .panel {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #d8d0c6;
      border-radius: 6px;
      overflow: hidden;
    }
    .header {
      background: #a5121b;
      padding: 26px 24px;
      text-align: center;
    }
    .header img { display: block; margin: 0 auto; width: 132px; height: auto; }
    .header-brand {
      margin-top: 12px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #ffffff;
    }
    .content { padding: 28px 24px 24px; }
    .content-sm { padding: 0 24px 24px; }
    h1 {
      margin: 0 0 8px;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #17130f;
      text-align: center;
    }
    h1.crimson { color: #a5121b; }
    p { margin: 0 0 14px; font-size: 15px; color: #514940; }
    .lead { font-size: 16px; color: #17130f; text-align: center; }
    .intro { text-align: center; }
    .meta-table { width: 100%; margin: 20px 0 10px; }
    .meta-table td {
      padding: 8px 2px;
      font-size: 13.5px;
      color: #514940;
      border-bottom: 1px solid #f0ebe5;
    }
    .meta-table td.label {
      width: 34%;
      font-weight: 700;
      color: #17130f;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.12em;
      border-bottom: 1px solid #f0ebe5;
    }
    .tag {
      display: inline-block;
      margin: 10px 10px 10px 0;
      padding: 6px 10px;
      border: 1px solid #a5121b;
      background: rgba(165, 18, 27, 0.08);
      color: #a5121b;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      border-radius: 20px;
    }
    .tag.crimson-bg {
      background: #a5121b;
      color: #ffffff;
      border-color: #a5121b;
    }
    .items-table {
      width: 100%;
      margin: 18px 0 6px;
      border: 1px solid #d8d0c6;
    }
    .items-table th {
      background: #f2eee6;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #6c635a;
      text-align: left;
      padding: 12px 10px;
      border-bottom: 1px solid #d8d0c6;
    }
    .items-table td {
      font-size: 14px;
      color: #17130f;
      padding: 14px 10px;
      border-bottom: 1px solid #f0ebe5;
      vertical-align: middle;
    }
    .items-table tr:last-child td { border-bottom: none; }
    .item-name { font-weight: 700; display: block; }
    .item-meta { margin-top: 4px; font-size: 12.5px; color: #514940; }
    .item-image { width: 64px; height: 64px; border: 1px solid #d8d0c6; border-radius: 4px; overflow: hidden; background: #f2eee6; }
    .item-image img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .item-price { font-weight: 700; font-variant-numeric: tabular-nums; }
    .totals {
      width: 100%;
      margin-top: 22px;
      border-top: 2px solid #17130f;
    }
    .totals td {
      padding: 9px 4px;
      font-size: 14px;
      color: #514940;
      border-bottom: 1px solid #f0ebe5;
    }
    .totals td.label { font-weight: 700; color: #17130f; width: 60%; }
    .totals td.value { text-align: right; font-variant-numeric: tabular-nums; }
    .totals .discount td { color: #a5121b; }
    .totals .grand td {
      border-top: 1px solid #17130f;
      color: #17130f;
      font-size: 16px;
      font-weight: 800;
    }
    .cta-row { margin: 26px 0 10px; text-align: center; }
    .cta {
      display: inline-block;
      background: #a5121b;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 800;
      font-size: 15px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 14px 30px;
      border-radius: 6px;
      border: 1px solid #a5121b;
    }
    .cta:hover { background: #790e16; border-color: #790e16; }
    .cta-outline {
      background: transparent;
      color: #17130f !important;
      border-color: #17130f;
    }
    .cta-outline:hover { background: #17130f; color: #ffffff !important; }
    .notes {
      background: #f2eee6;
      border-left: 3px solid #a5121b;
      padding: 12px 16px;
      margin: 18px 0;
      font-size: 13.5px;
      color: #17130f;
    }
    .notes p { margin: 0; }
    .footer {
      padding: 22px 24px;
      border-top: 1px solid #d8d0c6;
      font-size: 11.5px;
      color: #6c635a;
      text-align: center;
    }
    .footer p { margin: 4px 0; }
    .footer .divider { border: none; border-top: 1px solid #d8d0c6; margin: 12px 0; }
    .footer-text b { color: #17130f; }
    .plain { padding: 24px; color: #17130f; font-size: 15px; line-height: 1.7; background: #ffffff; }
    @media (max-width: 480px) {
      .wrapper { padding: 12px 6px; }
      .panel { border-width: 1px 0 0 0; border-radius: 0; }
      .header { padding: 22px 18px; }
      .header img { width: 110px; }
      .content { padding: 22px 18px 18px; }
      h1 { font-size: 22px; }
      .items-table td, .items-table th { font-size: 13px; padding: 10px 8px; }
      .item-image { width: 52px; height: 52px; }
      .cta { width: 100%; box-sizing: border-box; text-align: center; }
      .meta-table td.label { width: 40%; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="panel">
      ${body}
      <div class="footer">
        <img src="${esc(assets.logoUrl)}" alt="${LOGO_ALT}" width="96" height="auto" style="display:block;margin:0 auto;" />
        <hr class="divider" />
        <p><b>${esc(BRAND_DISPLAY_NAME)}</b> — Independent streetwear from Cairo, Egypt.</p>
        <p>Questions about your order? Reply to this email or visit the studio at ${esc(assets.siteUrl)}.</p>
        <p style="margin-top:8px">This is an automated transactional message. Please do not share your order reference publicly.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function metaRows(order: EmailOrder): string {
  return `
    <tr><td class="label">Order number</td><td><span style="font-variant-numeric: tabular-nums; font-weight:700;">${esc(order.order_reference)}</span></td></tr>
    <tr><td class="label">Order date</td><td>${esc(orderDate(order.created_at))}</td></tr>
    <tr><td class="label">Status</td><td>${esc(String(order.status).charAt(0).toUpperCase() + String(order.status).slice(1))}</td></tr>
    <tr><td class="label">Payment method</td><td>${esc(paymentLabel(order.payment_method))}</td></tr>`;
}

function itemsHtml(order: EmailOrder, assets: EmailAssets): string {
  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td>
          <span class="item-name">${esc(item.product_name)}</span>
          <span class="item-meta">${esc(item.color_name)} / Size ${esc(item.size_name)} · Qty ${esc(String(item.quantity))}</span>
        </td>
        ${itemImageHtml(item, assets)}
        <td class="item-price" style="text-align:right;">${money(item.unit_price)}</td>
        <td class="item-price" style="text-align:right;">${money(item.line_total)}</td>
      </tr>`
    )
    .join('');
  return `
    <table class="items-table">
      <thead>
        <tr>
          <th>Piece</th>
          <th style="width:72px;text-align:right;">Unit</th>
          <th style="width:86px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function totalsHtml(order: EmailOrder): string {
  const rows: Array<{label: string; value: string; discount?: boolean}> = [
    { label: 'Subtotal', value: money(order.subtotal) },
  ];
  if (order.email_discount_amount > 0)
    rows.push({ label: 'Email privilege (10%)', value: `−${money(order.email_discount_amount)}`, discount: true });
  if (order.promo_discount_amount > 0)
    rows.push({
      label: `Promo ${esc(order.applied_promo_code ?? '')}`,
      value: `−${money(order.promo_discount_amount)}`,
      discount: true,
    });
  if (order.shipping_cost > 0)
    rows.push({ label: 'Shipping', value: money(order.shipping_cost) });
  else rows.push({ label: 'Shipping', value: 'Free' });
  rows.push({ label: 'Total', value: money(order.total_amount) });
  return `
    <table class="totals">
      <tbody>
        ${rows
          .map(
            ({ label, value, discount }) => `
          <tr class="${discount ? 'discount' : ''}${label === 'Total' ? ' grand' : ''}">
            <td class="label">${esc(label)}</td>
            <td class="value">${esc(value)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`;
}

function customerBlock(order: EmailOrder): string {
  return `
    <table class="meta-table">
      <tr><td class="label">Name</td><td>${esc(order.customer_name)}</td></tr>
      <tr><td class="label">Email</td><td><a href="mailto:${esc(order.customer_email)}">${esc(order.customer_email)}</a></td></tr>
      <tr><td class="label">Phone</td><td><a href="tel:${esc(order.customer_phone)}">${esc(order.customer_phone)}</a></td></tr>
      <tr><td class="label">Delivery address</td><td>${esc(order.delivery_address)}<br>${esc(order.city)}, ${esc(order.governorate)}</td></tr>
      ${order.order_notes ? `<tr><td class="label">Customer note</td><td>${esc(order.order_notes)}</td></tr>` : ''}
    </table>`;
}

/**
 * Order confirmation email sent to the customer right after the order is
 * saved in the database. Confirms receipt — not shipment or delivery.
 */
export function customerConfirmationEmail(order: EmailOrder, assets: EmailAssets): EmailContent {
  const orderUrl = `${assets.siteUrl}/order-confirmation/${encodeURIComponent(order.order_reference)}?email=${encodeURIComponent(order.customer_email)}`;
  const subject = `Order Confirmed — ${order.order_reference}`;
  const body = `
    <div class="content-sm">
      <div class="header">
        <img src="${esc(assetUrl(null, assets))}" alt="${LOGO_ALT}" width="132" height="auto" />
        <div class="header-brand">${esc(BRAND_DISPLAY_NAME)}</div>
      </div>
      <h1 class="crimson">ORDER CONFIRMED</h1>
      <p class="intro">Thank you, ${esc(order.customer_name.split(' ')[0] || 'friend')}. Your order has been received and saved by the studio.</p>
      <span class="tag crimson-bg">#${esc(order.order_reference)}</span>
      <table class="meta-table">
        <tr><td class="label">Order date</td><td>${esc(orderDate(order.created_at))}</td></tr>
        <tr><td class="label">Payment method</td><td>${esc(paymentLabel(order.payment_method))}</td></tr>
      </table>
      <p style="text-align:center;">Your pieces are listed below. Dispatch will call ${esc(order.customer_phone)} before the parcel leaves the atelier.</p>
      ${itemsHtml(order, assets)}
      ${totalsHtml(order)}
      <div class="cta-row">
        <a href="${esc(orderUrl)}" class="cta">View my order</a>
      </div>
      ${customerBlock(order)}
    </div>`;
  const text = `
${BRAND_DISPLAY_NAME} — Order confirmed
Order #${order.order_reference} · ${orderDate(order.created_at)}
Thank you, ${order.customer_name}. Your order has been received and saved by the studio.
Payment method: ${order.payment_method}

Pieces:
${order.items.map((i) => `- ${i.product_name} (${i.color_name} / Size ${i.size_name}) × ${i.quantity} — ${money(i.line_total)}`).join('\n')}

${totalsText(order)}

View your order: ${orderUrl}

${customerBlockText(order)}

— ${BRAND_DISPLAY_NAME}, Cairo, Egypt
${assets.siteUrl}`;
  return { subject, html: shell('Order confirmed', body, assets), text };
}

function totalsText(order: EmailOrder): string {
  const lines = [`Subtotal: ${money(order.subtotal)}`];
  if (order.email_discount_amount > 0)
    lines.push(`Email privilege (10%): −${money(order.email_discount_amount)}`);
  if (order.promo_discount_amount > 0)
    lines.push(`Promo ${order.applied_promo_code}: −${money(order.promo_discount_amount)}`);
  lines.push(`Shipping: ${order.shipping_cost > 0 ? money(order.shipping_cost) : 'Free'}`);
  lines.push(`Total: ${money(order.total_amount)}`);
  return lines.join('\n');
}

function customerBlockText(order: EmailOrder): string {
  return `
Customer: ${order.customer_name}
Email: ${order.customer_email}
Phone: ${order.customer_phone}
Delivery: ${order.delivery_address}, ${order.city}, ${order.governorate}
${order.order_notes ? `Note: ${order.order_notes}\n` : ''}`;
}

/**
 * New order notification sent to the studio after a customer order is saved.
 * Built for fast scanning on mobile: customer first, then pieces and totals.
 */
export function adminNewOrderEmail(order: EmailOrder, assets: EmailAssets): EmailContent {
  const adminUrl = `${assets.siteUrl}/admin`;
  const orderUrl = `${assets.siteUrl}/order-confirmation/${encodeURIComponent(order.order_reference)}?email=${encodeURIComponent(order.customer_email)}`;
  const subject = `NEW ORDER RECEIVED — ${order.order_reference}`;
  const body = `
    <div class="content">
      <div class="header">
        <img src="${esc(assetUrl(null, assets))}" alt="${LOGO_ALT}" width="132" height="auto" />
        <div class="header-brand">${esc(BRAND_DISPLAY_NAME)} — New Order Notification</div>
      </div>
      <span class="tag">NEW ORDER</span>
      <h1>New order received</h1>
      <p class="lead">A customer has just placed an order. It is awaiting your review in the Admin Panel.</p>
      ${metaRows(order)}
      <div style="margin:18px 0;">
        <strong>Customer</strong><br>
        ${esc(order.customer_name)}<br>
        <a href="mailto:${esc(order.customer_email)}">${esc(order.customer_email)}</a><br>
        <a href="tel:${esc(order.customer_phone)}">${esc(order.customer_phone)}</a>
      </div>
      <strong>Delivery address</strong><br>
      ${esc(order.delivery_address)}<br>${esc(order.city)}, ${esc(order.governorate)}
      ${order.order_notes ? `<div class="notes"><p><b>Customer note / delivery instructions:</b> ${esc(order.order_notes)}</p></div>` : ''}
      <p style="margin:18px 0 6px;"><strong>Ordered pieces</strong></p>
      ${itemsHtml(order, assets)}
      ${totalsHtml(order)}
      <div class="cta-row" style="margin-top:6px;">
        <a href="${esc(adminUrl)}" class="cta">Open order in Admin Panel</a>
        <a href="${esc(orderUrl)}" class="cta cta-outline" style="margin-left:10px;">View customer receipt</a>
      </div>
    </div>`;
  const text = `
${BRAND_DISPLAY_NAME} — New order notification
NEW ORDER RECEIVED — ${order.order_reference}

Order date: ${orderDate(order.created_at)}
Status: ${String(order.status).charAt(0).toUpperCase() + String(order.status).slice(1)}
Payment method: ${order.payment_method}

Customer: ${order.customer_name}
Email: ${order.customer_email}
Phone: ${order.customer_phone}
Delivery: ${order.delivery_address}, ${order.city}, ${order.governorate}
${order.order_notes ? `Note: ${order.order_notes}\n` : ''}
Pieces:
${order.items.map((i) => `- ${i.product_name} (${i.color_name} / Size ${i.size_name}) × ${i.quantity} — ${money(i.line_total)}`).join('\n')}

${totalsText(order)}

Open in Admin Panel: ${adminUrl}
View customer receipt: ${orderUrl}

— ${BRAND_DISPLAY_NAME}, Cairo, Egypt`;
  return { subject, html: shell('New order notification', body, assets), text };
}
