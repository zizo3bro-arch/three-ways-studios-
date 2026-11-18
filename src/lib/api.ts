import { supabase } from './supabase';
import type { OrderConfirmationData, Product, QuoteResponse } from '../types/database';

const OFFLINE = 'The studio is not connected. Please try again later.';
const UUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
export const isVariantId = (value: string) => UUID.test(value);
const productFields = '*, images:product_images(*), variants:product_variants(*)';

function message(error: unknown, fallback: string) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback;
}
function published(row: Product): Product {
  return {
    ...row,
    images: [...(row.images ?? [])].sort((a, b) => a.display_order - b.display_order),
    variants: (row.variants ?? []).filter((v) => v.is_active),
    size_charts: [...(row.size_charts ?? [])].sort((a, b) => a.size_order - b.size_order),
  };
}
export async function fetchPublishedProducts(): Promise<{ products: Product[]; error: string | null }> {
  if (!supabase) return { products: [], error: OFFLINE };
  try {
    const { data, error } = await supabase
      .from('products')
      .select(productFields)
      .eq('is_published', true)
      .order('sort_order')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { products: (data ?? []).map(published), error: null };
  } catch (e) {
    return { products: [], error: message(e, 'Unable to load the collection.') };
  }
}

/** Detail reads are by slug, not limited to a cached page of listings. Charts
 * and fresh availability are fetched only when a piece is actually opened. */
export async function fetchProductBySlug(
  slug: string,
  signal: AbortSignal
): Promise<{ product: Product | null; error: string | null }> {
  if (!supabase) return { product: null, error: OFFLINE };
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`${productFields}, size_charts(*)`)
      .eq('slug', slug)
      .eq('is_published', true)
      .abortSignal(signal)
      .maybeSingle();
    if (error) throw error;
    return { product: data ? published(data) : null, error: null };
  } catch (e) {
    return { product: null, error: message(e, 'Unable to load this piece.') };
  }
}

type Line = { variant_id: string; quantity: number };
function cartError(items: Line[]) {
  return !items.length ||
    items.some((i) => !isVariantId(i.variant_id) || !Number.isSafeInteger(i.quantity) || i.quantity < 1)
    ? 'One or more items cannot be ordered. Please update your bag.'
    : null;
}
export async function quoteCodOrder(params: { items: Line[]; email: string; promoCode?: string }) {
  const invalid = cartError(params.items);
  if (!supabase || invalid) return { quote: null, error: invalid || OFFLINE };
  try {
    const { data, error } = await supabase.rpc('quote_cod_order', {
      p_items: params.items,
      p_email: params.email.trim() || null,
      p_promo_code: params.promoCode?.trim() || null,
    });
    if (error?.code === '55000' && error.message.includes('v_promo_rule'))
      throw new Error('Checkout verification is temporarily unavailable. Please try again later.');
    if (error) throw error;
    if (
      !data ||
      typeof data.valid !== 'boolean' ||
      !Array.isArray(data.items) ||
      !Array.isArray(data.stock_errors) ||
      !Number.isFinite(data.subtotal) ||
      !Number.isFinite(data.discount_total) ||
      !Number.isFinite(data.final_total) ||
      (data.valid && (!Number.isFinite(data.shipping_cost) || data.shipping_cost < 0))
    ) {
      throw new Error('The studio could not verify your total.');
    }
    return { quote: data as QuoteResponse, error: null };
  } catch (e) {
    return { quote: null, error: message(e, 'Could not verify pricing and stock.') };
  }
}

function receipt(data: OrderConfirmationData | null): data is OrderConfirmationData {
  return Boolean(
    data &&
      UUID.test(data.order_id) &&
      data.order_reference &&
      data.payment_method === 'COD' &&
      Number.isFinite(data.total_amount) &&
      Array.isArray(data.items) &&
      data.items.length
  );
}

export async function createCodOrder(params: {
  fullName: string;
  email: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  notes: string;
  promoCode?: string;
  paymentMethod: 'COD';
  items: Line[];
  checkoutRequestId: string;
}): Promise<{ order: OrderConfirmationData | null; error: string | null; refreshQuote?: boolean }> {
  const invalid = cartError(params.items);
  if (!supabase || invalid || params.paymentMethod !== 'COD')
    return { order: null, error: invalid || (!supabase ? OFFLINE : 'Select cash on delivery.') };
  const payload = {
    p_full_name: params.fullName.trim(),
    p_email: params.email.trim().toLowerCase(),
    p_phone: params.phone.trim(),
    p_governorate: params.governorate.trim(),
    p_city: params.city.trim(),
    p_address: params.address.trim(),
    p_notes: params.notes.trim(),
    p_promo_code: params.promoCode?.trim() || null,
    // Send IDs and quantities, never prices or discounts from the client.
    p_items: params.items.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
    p_payment_method: params.paymentMethod,
    p_checkout_request_id: params.checkoutRequestId,
  };
  try {
    // Never fall back to a signature without duplicate protection, or retry a
    // write automatically. The customer can safely retry with the same request ID.
    const response = await supabase.rpc('create_cod_order', payload).retry(false);
    if (response.error?.code === 'PGRST202')
      return { order: null, error: 'Order confirmation is temporarily unavailable. Please try again later.' };
    if (response.error) {
      return {
        order: null,
        error: response.error.message,
        // A rejected transaction didn't commit. Re-quote in case inventory or a promo has changed.
        refreshQuote: ['P0001', '23514'].includes(response.error.code),
      };
    }
    if (!receipt(response.data))
      throw new Error(
        'The studio did not return an order reference. Retry with the same bag and email.'
      );
    return { order: response.data, error: null };
  } catch (e) {
    return {
      order: null,
      error: message(e, 'The order could not be confirmed. Retry with the same bag and email.'),
    };
  }
}
export async function fetchOrderConfirmation(
  orderReference: string,
  email: string
): Promise<{ order: OrderConfirmationData | null; error: string | null }> {
  if (!supabase) return { order: null, error: OFFLINE };
  try {
    const { data, error } = await supabase.rpc('get_order_confirmation', {
      p_order_reference: orderReference.trim(),
      p_email: email.trim().toLowerCase(),
    });
    if (error) throw error;
    return receipt(data)
      ? { order: data, error: null }
      : { order: null, error: 'No order matched that reference and email.' };
  } catch (e) {
    return { order: null, error: message(e, 'Order lookup is unavailable.') };
  }
}
export async function subscribeNewsletter(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    return { ok: false, message: 'Enter a valid email address.' };
  if (!supabase)
    return { ok: false, message: 'Subscriptions are unavailable. Your email has not been saved.' };
  try {
    // INSERT only: the public role must never need SELECT or UPDATE on subscribers.
    const { error } = await supabase.from('newsletter_subscribers').insert({ email: normalized });
    if (error?.code === '23505')
      return { ok: true, message: 'This address is already on the studio list.' };
    if (error) throw error;
    return { ok: true, message: 'You’re on the list. Thank you for subscribing.' };
  } catch (e) {
    return { ok: false, message: `Subscription not confirmed. ${message(e, 'Please try again.')}` };
  }
}
