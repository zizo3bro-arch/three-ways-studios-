/**
 * Load the order (+ line items) needed to construct an email, server-side.
 * Never returns data supplied by the request body.
 */
import type { EmailLineItem, EmailOrder } from './types.js';

export interface OrderClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{
          data: Record<string, unknown> | null;
          error: { code?: string; message?: string } | null;
        }>;
      };
    };
  };
}

export async function loadOrderForNotification(
  client: OrderClient | null,
  orderId: string
): Promise<EmailOrder | null> {
  // null client / null orderId → cannot distinguish; treated as not found by caller contract
  if (!client) return null;
  const { data, error } = await client
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();
  if (error) {
    // PGRST116 = "0 rows" — the order does not exist.
    if (error.code === 'PGRST116') return null;
    throw new Error('order-load-failed');
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const items = Array.isArray(row.order_items)
    ? (row.order_items as Array<Record<string, unknown>>)
    : [];
  return {
    order_id: String(row.id ?? ''),
    order_reference: String(row.order_reference ?? ''),
    customer_name: String(row.customer_name ?? ''),
    customer_email: String(row.customer_email ?? ''),
    customer_phone: String(row.customer_phone ?? ''),
    governorate: String(row.governorate ?? ''),
    city: String(row.city ?? ''),
    delivery_address: String(row.delivery_address ?? ''),
    order_notes: String(row.order_notes ?? ''),
    payment_method: String(row.payment_method ?? 'COD'),
    subtotal: Number(row.subtotal) || 0,
    shipping_cost: Number(row.shipping_cost) || 0,
    email_discount_amount: Number(row.email_discount_amount) || 0,
    loyalty_discount_amount: Number(row.loyalty_discount_amount) || 0,
    loyalty_discount_percent:
      row.loyalty_discount_percent === null || row.loyalty_discount_percent === undefined
        ? 0
        : Number(row.loyalty_discount_percent) || 0,
    loyalty_free_reward_amount: Number(row.loyalty_free_reward_amount) || 0,
    loyalty_free_reward_product_name:
      row.loyalty_free_reward_product_name === null || row.loyalty_free_reward_product_name === undefined
        ? null
        : String(row.loyalty_free_reward_product_name),
    loyalty_seq: row.loyalty_seq === null || row.loyalty_seq === undefined ? null : Number(row.loyalty_seq),
    promo_discount_amount: Number(row.promo_discount_amount) || 0,
    discount_total: Number(row.discount_total) || 0,
    applied_promo_code:
      row.applied_promo_code === null || row.applied_promo_code === undefined
        ? null
        : String(row.applied_promo_code),
    total_amount: Number(row.total_amount) || 0,
    status: String(row.status ?? 'pending'),
    created_at: String(row.created_at ?? ''),
    items: items.map((item): EmailLineItem => ({
      product_name: String(item.product_name ?? ''),
      color_name: String(item.color_name ?? ''),
      size_name: String(item.size_name ?? ''),
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unit_price) || 0,
      line_total: Number(item.line_total) || 0,
      product_image:
        item.product_image === null || item.product_image === undefined
          ? null
          : String(item.product_image),
    })),
  };
}
