import { DEMO_PRODUCTS } from '../data/demoProducts';
import { isSupabaseConfigured, supabase } from './supabase';
import type { Product, ProductImage, ProductVariant, SizeChartRow } from '../types/database';

const LOCAL_ORDERS_KEY = 'tws_local_orders_v1';
const LOCAL_NEWSLETTER_KEY = 'tws_newsletter_emails_v1';

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
}) {
  const gov = params.governorate || 'Cairo';
  const subtotal = params.items.reduce((sum, item) => sum + (item.unit_price ?? 2500) * item.quantity, 0);
  const shippingCost = subtotal >= 3500 ? 0 : gov.toLowerCase().includes('cairo') || gov.toLowerCase().includes('giza') ? 75 : 110;
  const normalizedCode = (params.discountCode ?? params.promoCode)?.trim().toUpperCase() || '';
  const isWelcomeCode = normalizedCode === 'WELCOME10' || normalizedCode === 'TWS10';
  const localDiscount = isWelcomeCode ? Math.round(subtotal * 0.1) : 0;
  const fallbackQuote = {
    valid: true,
    stock_errors: [] as string[],
    subtotal,
    discount_amount: localDiscount,
    shipping_cost: shippingCost,
    total: Math.max(0, subtotal - localDiscount + shippingCost),
    discount_valid: isWelcomeCode,
    email_discount_applied: false,
    email_discount_percent: 0,
    email_discount_amount: 0,
    promo_discount_applied: isWelcomeCode,
    promo_code: isWelcomeCode ? normalizedCode : null,
    promo_discount_percent: isWelcomeCode ? 10 : 0,
    promo_discount_amount: localDiscount,
    promo_code_applied: isWelcomeCode ? normalizedCode : '',
    promo_error: null as string | null,
    discount_total: localDiscount,
    final_total: Math.max(0, subtotal - localDiscount + shippingCost),
    free_shipping_threshold: 3500,
    items: params.items.map((i) => ({
      variant_id: i.variant_id,
      product_id: '',
      product_name: 'THREE WAYS STUDIOS Piece',
      product_slug: '',
      product_image: null as string | null,
      color_name: 'Obsidian',
      color_hex: '#0c0a0b',
      size_name: 'M',
      quantity: i.quantity,
      available_stock: 10,
      unit_price: i.unit_price ?? 2500,
      line_total: (i.unit_price ?? 2500) * i.quantity,
    })),
  };

  if (!isSupabaseConfigured || !supabase) {
    return { quote: fallbackQuote, error: null };
  }

  try {
    const { data, error } = await supabase.rpc('quote_cod_order', {
      p_items: params.items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
      })),
      p_governorate: params.governorate,
      p_discount_code: (params.discountCode ?? params.promoCode)?.trim() || null,
    });

    if (error || !data) {
      return { quote: fallbackQuote, error: null };
    }

    return { quote: data as typeof fallbackQuote, error: null };
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
}) {
  const effectiveCode = params.discountCode ?? params.promoCode ?? null;
  const { quote } = await quoteCodOrder({
    items: params.items,
    governorate: params.governorate,
    email: params.email,
    discountCode: effectiveCode,
  });

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('create_cod_order', {
        p_full_name: params.fullName.trim(),
        p_email: params.email.trim(),
        p_phone: params.phone.trim(),
        p_governorate: params.governorate.trim(),
        p_city: params.city.trim(),
        p_address: params.address.trim(),
        p_notes: params.notes?.trim() || '',
        p_discount_code: effectiveCode?.trim() || null,
        p_items: params.items.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
        })),
      });

      if (!error && data) {
        return { order: data, error: null };
      }
    } catch {
      // Fallback to local order persistence if RPC fails (e.g. demo products)
    }
  }

  const orderNumber = `TWS-${Math.floor(100000 + Math.random() * 900000)}`;
  const orderRecord = {
    order_number: orderNumber,
    full_name: params.fullName.trim(),
    email: params.email.trim(),
    phone: params.phone.trim(),
    governorate: params.governorate.trim(),
    city: params.city.trim(),
    address: params.address.trim(),
    notes: params.notes?.trim() || '',
    payment_method: 'cod',
    status: 'pending',
    subtotal: quote?.subtotal ?? 0,
    discount_amount: quote?.discount_amount ?? 0,
    shipping_cost: quote?.shipping_cost ?? 0,
    total: quote?.total ?? 0,
    items: params.items,
    created_at: new Date().toISOString(),
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

export async function fetchOrderConfirmation(orderNumber: string, phone: string) {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('get_order_confirmation', {
        p_order_number: orderNumber,
        p_phone: phone,
      });
      if (!error && data) {
        return { order: data, error: null };
      }
    } catch {
      // fallback below
    }
  }

  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]');
    const found = existing.find((o: { order_number: string }) => o.order_number === orderNumber);
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
