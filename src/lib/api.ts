import { customerClient } from './customerClient';
import { resolveTrackingStage } from './orderTracking';
import { supabase } from './supabase';
import type {
  CustomerAccountOverview,
  OrderConfirmationData,
  Product,
  QuoteResponse,
  TrackedOrderData,
} from '../types/database';

const OFFLINE = 'The studio is not connected. Please try again later.';
const UUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
export const isVariantId = (value: string) => UUID.test(value);
const productFields = '*, images:product_images(*), variants:product_variants(*)';

function message(error: unknown, fallback: string) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback;
}

/** Uses the authenticated customer session when signed in so PostgreSQL can
 * evaluate server-side loyalty discounts and free-product rewards via auth.uid(),
 * while falling back cleanly to the anonymous client for guest checkout. */
async function checkoutClient() {
  if (!supabase) return null;
  if (!customerClient) return supabase;
  try {
    const { data } = await customerClient.auth.getSession();
    if (data.session?.access_token) return customerClient;
  } catch {
    // Fall back to anonymous client for guests.
  }
  return supabase;
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
export async function quoteCodOrder(params: {
  items: Line[];
  email: string;
  promoCode?: string;
  redeemFreeReward?: boolean;
}) {
  const invalid = cartError(params.items);
  const client = await checkoutClient();
  if (!client || invalid) return { quote: null, error: invalid || OFFLINE };
  try {
    const rpcPayload: Record<string, unknown> = {
      p_items: params.items,
      p_email: params.email.trim() || null,
      p_promo_code: params.promoCode?.trim() || null,
    };
    if (params.redeemFreeReward) {
      rpcPayload.p_redeem_free_reward = true;
    }
    const { data, error } = await client.rpc('quote_cod_order', rpcPayload);
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
  redeemFreeReward?: boolean;
}): Promise<{ order: OrderConfirmationData | null; error: string | null; refreshQuote?: boolean }> {
  const invalid = cartError(params.items);
  const client = await checkoutClient();
  if (!client || invalid || params.paymentMethod !== 'COD')
    return { order: null, error: invalid || (!client ? OFFLINE : 'Select cash on delivery.') };
  const payload: Record<string, unknown> = {
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
  if (params.redeemFreeReward) {
    payload.p_redeem_free_reward = true;
  }
  try {
    // Never fall back to a signature without duplicate protection, or retry a
    // write automatically. The customer can safely retry with the same request ID.
    const response = await client.rpc('create_cod_order', payload).retry(false);
    if (response.error?.code === 'PGRST202')
      return { order: null, error: 'Order confirmation is temporarily unavailable. Please try again later.' };
    if (response.error) {
      return {
        order: null,
        error: response.error.message,
        // A rejected transaction didn't commit. Re-quote in case inventory, loyalty or promo changed.
        refreshQuote: ['P0001', '23514', '23505'].includes(response.error.code),
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

export async function trackOrder(
  orderReference: string,
  email: string
): Promise<{ order: TrackedOrderData | null; error: string | null }> {
  if (!supabase) return { order: null, error: OFFLINE };
  const cleanRef = orderReference.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanRef || !cleanEmail) {
    return { order: null, error: 'Enter your order number and the email used on the order.' };
  }
  try {
    const { data, error } = await supabase.rpc('track_order', {
      p_order_reference: cleanRef,
      p_email: cleanEmail,
    });
    if (error?.code === 'PGRST202') {
      const fallback = await fetchOrderConfirmation(cleanRef, cleanEmail);
      if (!fallback.order) return { order: null, error: fallback.error };
      const o = fallback.order;
      return {
        order: {
          order_reference: o.order_reference,
          status: o.status,
          tracking: resolveTrackingStage(o.status, o.tracking),
          payment_method: o.payment_method,
          subtotal: o.subtotal,
          shipping_cost: o.shipping_cost,
          email_discount_amount: o.email_discount_amount,
          loyalty_discount_amount: o.loyalty_discount_amount,
          loyalty_free_reward_amount: o.loyalty_free_reward_amount,
          promo_discount_amount: o.promo_discount_amount,
          discount_total: o.discount_total,
          applied_promo_code: o.applied_promo_code,
          total_amount: o.total_amount,
          city: o.city,
          governorate: o.governorate,
          created_at: o.created_at,
          updated_at: o.updated_at,
          items: o.items,
        },
        error: null,
      };
    }
    if (error) throw error;
    if (!data || !data.order_reference || !Array.isArray(data.items)) {
      return { order: null, error: 'No order matched that order number and email.' };
    }
    return {
      order: {
        ...(data as TrackedOrderData),
        tracking: resolveTrackingStage(data.status, data.tracking),
      },
      error: null,
    };
  } catch (e) {
    return { order: null, error: message(e, 'Order tracking is unavailable.') };
  }
}

export async function fetchCustomerAccountOverview(): Promise<{
  overview: CustomerAccountOverview | null;
  error: string | null;
}> {
  if (!customerClient) return { overview: null, error: OFFLINE };
  try {
    const { data, error } = await customerClient.rpc('get_customer_account_overview');
    if (error) throw error;
    if (!data || typeof data !== 'object' || !('profile' in data) || !('loyalty' in data)) {
      return { overview: null, error: null };
    }
    return { overview: data as CustomerAccountOverview, error: null };
  } catch (e) {
    return { overview: null, error: message(e, 'Could not load your account details.') };
  }
}

export async function subscribeNewsletter(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    return { ok: false, alreadySubscribed: false, message: 'Enter a valid email address.' };
  if (!supabase)
    return {
      ok: false,
      alreadySubscribed: false,
      message: 'Subscriptions are unavailable. Your email has not been saved.',
    };
  try {
    // INSERT only: the public role must never need SELECT or UPDATE on subscribers.
    const { error } = await supabase.from('newsletter_subscribers').insert({ email: normalized });
    if (error?.code === '23505')
      return {
        ok: true,
        alreadySubscribed: true,
        message: 'This address is already on the studio list.',
      };
    if (error) throw error;
    return {
      ok: true,
      alreadySubscribed: false,
      message: 'You’re on the list — your one-time 10% email discount is unlocked for checkout.',
    };
  } catch (e) {
    return {
      ok: false,
      alreadySubscribed: false,
      message: `Subscription not confirmed. ${message(e, 'Please try again.')}`,
    };
  }
}
