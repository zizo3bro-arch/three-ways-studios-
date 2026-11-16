import { supabase } from './supabase';
import type {
  OrderConfirmationData,
  Product,
  ProductImage,
  ProductVariant,
  QuoteResponse,
  SizeChartRow,
} from '../types/database';

export async function fetchPublishedProducts(): Promise<{
  products: Product[];
  error: string | null;
}> {
  if (!supabase) {
    return { products: [], error: null };
  }

  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      images:product_images(*),
      variants:product_variants(*),
      size_charts:size_charts(*)
    `
    )
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return { products: [], error: error.message };
  }

  const normalized = (data ?? []).map((p: Product) => ({
    ...p,
    price: Number(p.price),
    original_price: p.original_price !== null ? Number(p.original_price) : null,
    images: [...(p.images ?? [])].sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.display_order - b.display_order;
    }),
    variants: (p.variants ?? []).filter((v) => v.is_active),
    size_charts: [...(p.size_charts ?? [])].sort((a, b) => a.size_order - b.size_order),
  }));

  return { products: normalized, error: null };
}

export async function fetchProductBySlug(slug: string): Promise<{
  product: Product | null;
  related: Product[];
  error: string | null;
}> {
  if (!supabase) {
    return { product: null, related: [], error: null };
  }

  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      images:product_images(*),
      variants:product_variants(*),
      size_charts:size_charts(*)
    `
    )
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) {
    return { product: null, related: [], error: error.message };
  }

  if (!data) {
    return { product: null, related: [], error: null };
  }

  const product: Product = {
    ...data,
    price: Number(data.price),
    original_price: data.original_price !== null ? Number(data.original_price) : null,
    images: [...((data.images ?? []) as ProductImage[])].sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.display_order - b.display_order;
    }),
    variants: ((data.variants ?? []) as ProductVariant[]).filter((v) => v.is_active),
    size_charts: [...((data.size_charts ?? []) as SizeChartRow[])].sort(
      (a, b) => a.size_order - b.size_order
    ),
  };

  const { data: relatedData } = await supabase
    .from('products')
    .select(
      `
      *,
      images:product_images(*),
      variants:product_variants(*)
    `
    )
    .eq('is_published', true)
    .neq('id', product.id)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(4);

  const related = (relatedData ?? []).map((p: Product) => ({
    ...p,
    price: Number(p.price),
    original_price: p.original_price !== null ? Number(p.original_price) : null,
    images: [...(p.images ?? [])].sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.display_order - b.display_order;
    }),
    variants: (p.variants ?? []).filter((v) => v.is_active),
  }));

  return { product, related, error: null };
}

export async function quoteCodOrder(params: {
  items: Array<{ variant_id: string; quantity: number }>;
  email: string;
  promoCode?: string;
}): Promise<{ quote: QuoteResponse | null; error: string | null }> {
  if (!supabase) {
    return { quote: null, error: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase.rpc('quote_cod_order', {
    p_items: params.items,
    p_email: params.email || null,
    p_promo_code: params.promoCode || null,
  });

  if (error) {
    return { quote: null, error: error.message };
  }

  return { quote: data as QuoteResponse, error: null };
}

export async function createCodOrder(params: {
  fullName: string;
  email: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  notes: string;
  items: Array<{ variant_id: string; quantity: number }>;
  promoCode?: string;
}): Promise<{ order: OrderConfirmationData | null; error: string | null }> {
  if (!supabase) {
    return { order: null, error: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase.rpc('create_cod_order', {
    p_full_name: params.fullName,
    p_email: params.email,
    p_phone: params.phone,
    p_governorate: params.governorate,
    p_city: params.city,
    p_address: params.address,
    p_notes: params.notes,
    p_items: params.items,
    p_promo_code: params.promoCode || null,
  });

  if (error) {
    return { order: null, error: error.message };
  }

  return { order: data as OrderConfirmationData, error: null };
}

export async function fetchOrderConfirmation(
  orderReference: string,
  email: string
): Promise<{ order: OrderConfirmationData | null; error: string | null }> {
  if (!supabase) {
    return { order: null, error: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase.rpc('get_order_confirmation', {
    p_order_reference: orderReference,
    p_email: email,
  });

  if (error) {
    return { order: null, error: error.message };
  }

  return { order: (data as OrderConfirmationData) ?? null, error: null };
}

export async function subscribeNewsletter(email: string): Promise<{ ok: boolean; error: string | null }> {
  if (!supabase) {
    return { ok: false, error: 'Newsletter backend requires Supabase configuration.' };
  }

  const clean = email.trim().toLowerCase();
  const { error } = await supabase.from('newsletter_subscribers').insert({ email: clean });
  if (error) {
    if (error.code === '23505') {
      return { ok: true, error: null };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}
