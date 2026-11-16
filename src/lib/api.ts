import { DEMO_PRODUCTS } from '../data/demoProducts';
import { isSupabaseConfigured, supabase } from './supabase';
import type {
  OrderConfirmationData,
  OrderItem,
  Product,
  ProductImage,
  ProductVariant,
  QuoteResponse,
  SizeChartRow,
} from '../types/database';

const LOCAL_ORDERS_KEY = 'tws_local_orders_v1';
const LOCAL_NEWSLETTER_KEY = 'tws_newsletter_emails_v1';
export const STANDARD_SHIPPING_EGP = 75;
export const FREE_SHIPPING_THRESHOLD_EGP = 3500;

function lookupDemoVariant(variantId: string) {
  for (const product of DEMO_PRODUCTS) {
    const variant = product.variants?.find((v) => v.id === variantId);
    if (variant) {
      return { product, variant };
    }
  }
  return null;
}

export function calculateShippingCost(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD_EGP ? 0 : STANDARD_SHIPPING_EGP;
}

export async function fetchPublishedProducts(): Promise<{
  products: Product[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { products: DEMO_PRODUCTS, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        images:product_images(*),
        variants:product_variants(*)
      `)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      return { products: DEMO_PRODUCTS, error: error.message };
    }

    const rows = (data ?? []).map((p) => ({
      ...p,
      images: ((p.images ?? []) as ProductImage[]).sort((a, b) => a.display_order - b.display_order),
      variants: (p.variants ?? []) as ProductVariant[],
    }));

    return { products: rows.length > 0 ? rows : DEMO_PRODUCTS, error: null };
  } catch {
    return { products: DEMO_PRODUCTS, error: null };
  }
}

export async function fetchProductBySlug(slug: string): Promise<{
  product: Product | null;
  related: Product[];
  error: string | null;
}> {
  const demoMatch = DEMO_PRODUCTS.find((p) => p.slug === slug);

  if (!isSupabaseConfigured || !supabase) {
    return {
      product: demoMatch ?? null,
      related: DEMO_PRODUCTS.filter((p) => p.slug !== slug).slice(0, 4),
      error: demoMatch ? null : 'Product not found.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        images:product_images(*),
        variants:product_variants(*),
        size_charts:product_size_charts(*)
      `)
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();

    if (error || !data) {
      if (demoMatch) {
        return {
          product: demoMatch,
          related: DEMO_PRODUCTS.filter((p) => p.slug !== slug).slice(0, 4),
          error: null,
        };
      }
      return { product: null, related: [], error: error?.message ?? 'Product not found.' };
    }

    const product: Product = {
      ...data,
      images: ((data.images ?? []) as ProductImage[]).sort((a, b) => a.display_order - b.display_order),
      variants: (data.variants ?? []) as ProductVariant[],
      size_charts: ((data.size_charts ?? []) as SizeChartRow[]).sort((a, b) => a.size_order - b.size_order),
    };

    const { data: relatedData } = await supabase
      .from('products')
      .select(`*, images:product_images(*), variants:product_variants(*)`)
      .eq('is_published', true)
      .neq('id', product.id)
      .order('sort_order', { ascending: true })
      .limit(4);

    const related = (relatedData ?? []).map((p) => ({
      ...p,
      images: ((p.images ?? []) as ProductImage[]).sort((a, b) => a.display_order - b.display_order),
      variants: (p.variants ?? []) as ProductVariant[],
    }));

    return {
      product,
      related: related.length > 0 ? related : DEMO_PRODUCTS.filter((p) => p.slug !== slug).slice(0, 4),
      error: null,
    };
  } catch {
    return {
      product: demoMatch ?? null,
      related: DEMO_PRODUCTS.filter((p) => p.slug !== slug).slice(0, 4),
      error: demoMatch ? null : 'Product not found.',
    };
  }
}

export async function quoteCodOrder(params: {
  items: Array<{ variant_id: string; quantity: number; unit_price?: number }>;
  governorate?: string;
  email?: string;
  discountCode?: string | null;
  promoCode?: string | null;
}): Promise<{ quote: QuoteResponse; error: string | null }> {
  const quoteItems = params.items.map((item) => {
    const demo = lookupDemoVariant(item.variant_id);
    const unitPrice = demo?.product.price ?? item.unit_price ?? 2650;
    return {
      variant_id: item.variant_id,
      product_id: demo?.product.id ?? '',
      product_name: demo?.product.name ?? 'THREE WAYS STUDIOS Piece',
      product_slug: demo?.product.slug ?? '',
      product_image: demo?.product.images?.[0]?.url ?? null,
      color_name: demo?.variant.color_name ?? 'Onyx Black',
      color_hex: demo?.variant.color_hex ?? '#09090b',
      size_name: demo?.variant.size_name ?? 'M',
      quantity: item.quantity,
      available_stock: demo?.variant.stock_quantity ?? 10,
      unit_price: unitPrice,
      line_total: unitPrice * item.quantity,
    };
  });

  const subtotal = quoteItems.reduce((sum, item) => sum + item.line_total, 0);
  const shippingCost = calculateShippingCost(subtotal);
  const cleanEmail = (params.email ?? '').trim().toLowerCase();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
  const emailDiscountPercent = isEmailValid && subtotal > 0 ? 10 : 0;
  const emailDiscountAmount = emailDiscountPercent > 0 ? Math.round(subtotal * 0.1) : 0;

  const normalizedCode = (params.discountCode ?? params.promoCode)?.trim().toUpperCase() || '';
  const isWelcomeCode = normalizedCode === 'WELCOME10' || normalizedCode === 'TWS10';
  const promoError =
    normalizedCode && !isWelcomeCode ? 'Invalid or inactive promo code.' : null;
  const promoDiscountPercent = isWelcomeCode ? 10 : 0;
  const promoDiscountAmount = isWelcomeCode
    ? Math.round(Math.max(0, subtotal - emailDiscountAmount) * 0.1)
    : 0;

  const discountTotal = Math.min(subtotal, emailDiscountAmount + promoDiscountAmount);
  const finalTotal = Math.max(0, subtotal - discountTotal + shippingCost);

  const fallbackQuote: QuoteResponse = {
    valid: true,
    stock_errors: [],
    items: quoteItems,
    subtotal,
    shipping_cost: shippingCost,
    email_discount_applied: emailDiscountAmount > 0,
    email_discount_percent: emailDiscountPercent,
    email_discount_amount: emailDiscountAmount,
    promo_code_applied: isWelcomeCode ? normalizedCode : null,
    promo_discount_percent: promoDiscountPercent,
    promo_discount_amount: promoDiscountAmount,
    promo_error: promoError,
    discount_total: discountTotal,
    final_total: finalTotal,
  };

  if (!isSupabaseConfigured || !supabase) {
    return { quote: fallbackQuote, error: null };
  }

  // Only query Supabase RPC when variant IDs are database UUIDs (not demo-* IDs)
  const hasDemoIds = params.items.some((i) => !/^[0-9a-f-]{36}$/i.test(i.variant_id));
  if (hasDemoIds) {
    return { quote: fallbackQuote, error: null };
  }

  try {
    const { data, error } = await supabase.rpc('quote_cod_order', {
      p_items: params.items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
      })),
      p_email: params.email?.trim() || null,
      p_promo_code: (params.discountCode ?? params.promoCode)?.trim() || null,
    });

    if (error || !data) {
      return { quote: fallbackQuote, error: null };
    }

    const rpcQuote = data as QuoteResponse;
    const rpcShipping = rpcQuote.shipping_cost ?? calculateShippingCost(rpcQuote.subtotal);
    return {
      quote: {
        ...rpcQuote,
        shipping_cost: rpcShipping,
        final_total: Math.max(0, rpcQuote.subtotal - rpcQuote.discount_total + rpcShipping),
      },
      error: null,
    };
  } catch {
    return { quote: fallbackQuote, error: null };
  }
}

export async function createCodOrder(params: {
  fullName: string;
  email: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  notes?: string;
  discountCode?: string | null;
  promoCode?: string | null;
  items: Array<{ variant_id: string; quantity: number; unit_price?: number }>;
}): Promise<{ order: OrderConfirmationData | null; error: string | null }> {
  const effectiveCode = params.discountCode ?? params.promoCode ?? null;
  const { quote } = await quoteCodOrder({
    items: params.items,
    governorate: params.governorate,
    email: params.email,
    discountCode: effectiveCode,
  });

  const hasDemoIds = params.items.some((i) => !/^[0-9a-f-]{36}$/i.test(i.variant_id));

  if (isSupabaseConfigured && supabase && !hasDemoIds) {
    try {
      const { data, error } = await supabase.rpc('create_cod_order', {
        p_full_name: params.fullName.trim(),
        p_email: params.email.trim(),
        p_phone: params.phone.trim(),
        p_governorate: params.governorate.trim(),
        p_city: params.city.trim(),
        p_address: params.address.trim(),
        p_notes: params.notes?.trim() || '',
        p_items: params.items.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
        })),
        p_promo_code: effectiveCode?.trim() || null,
      });

      if (!error && data) {
        const rpcOrder = data as OrderConfirmationData;
        const shippingCost = rpcOrder.shipping_cost ?? calculateShippingCost(rpcOrder.subtotal);
        return {
          order: {
            ...rpcOrder,
            shipping_cost: shippingCost,
            total_amount: rpcOrder.total_amount + (rpcOrder.shipping_cost !== undefined ? 0 : shippingCost),
          },
          error: null,
        };
      }
    } catch {
      // Fallback to local order persistence if RPC fails
    }
  }

  const orderRef = `TWS-${Math.floor(100000 + Math.random() * 900000)}`;
  const orderItems: OrderItem[] = quote.items.map((qi) => ({
    variant_id: qi.variant_id,
    product_id: qi.product_id || null,
    product_name: qi.product_name,
    product_slug: qi.product_slug || null,
    product_image: qi.product_image,
    color_name: qi.color_name,
    color_hex: qi.color_hex,
    size_name: qi.size_name,
    unit_price: qi.unit_price,
    quantity: qi.quantity,
    line_total: qi.line_total,
  }));

  const shippingCost = quote.shipping_cost ?? calculateShippingCost(quote.subtotal);
  const orderRecord: OrderConfirmationData = {
    order_id: orderRef,
    order_reference: orderRef,
    customer_name: params.fullName.trim(),
    customer_email: params.email.trim().toLowerCase(),
    customer_phone: params.phone.trim(),
    governorate: params.governorate.trim(),
    city: params.city.trim(),
    delivery_address: params.address.trim(),
    order_notes: params.notes?.trim() || '',
    payment_method: 'COD',
    subtotal: quote.subtotal,
    shipping_cost: shippingCost,
    email_discount_amount: quote.email_discount_amount,
    promo_discount_amount: quote.promo_discount_amount,
    discount_total: quote.discount_total,
    applied_promo_code: quote.promo_code_applied,
    total_amount: quote.final_total,
    status: 'pending',
    created_at: new Date().toISOString(),
    items: orderItems,
  };

  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
    existing.unshift(orderRecord);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(existing));
  } catch {
    // ignore storage errors
  }

  return { order: orderRecord, error: null };
}

export async function fetchOrderConfirmation(
  orderReference: string,
  email: string
): Promise<{ order: OrderConfirmationData | null; error: string | null }> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('get_order_confirmation', {
        p_order_reference: orderReference,
        p_email: email,
      });
      if (!error && data) {
        return { order: data as OrderConfirmationData, error: null };
      }
    } catch {
      // fallback below
    }
  }

  try {
    const existing = JSON.parse(
      localStorage.getItem(LOCAL_ORDERS_KEY) || '[]'
    ) as OrderConfirmationData[];
    const found = existing.find(
      (o) =>
        o.order_reference?.toUpperCase() === orderReference.trim().toUpperCase() &&
        o.customer_email?.toLowerCase() === email.trim().toLowerCase()
    );
    if (found) {
      return { order: found, error: null };
    }
  } catch {
    // ignore
  }

  return { order: null, error: 'Order not found.' };
}

export async function subscribeNewsletter(
  email: string
): Promise<{ ok: boolean; error: string | null; discountCode?: string }> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }

  try {
    const seen = JSON.parse(localStorage.getItem(LOCAL_NEWSLETTER_KEY) || '[]') as string[];
    if (seen.includes(normalized)) {
      return {
        ok: true,
        error: null,
        discountCode: 'WELCOME10',
      };
    }
    seen.push(normalized);
    localStorage.setItem(LOCAL_NEWSLETTER_KEY, JSON.stringify(seen));
  } catch {
    // ignore
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('newsletter_subscribers')
        .upsert({ email: normalized }, { onConflict: 'email' });
    } catch {
      // ignore if table not present
    }
  }

  return { ok: true, error: null, discountCode: 'WELCOME10' };
}
