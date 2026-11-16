export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  fabric_info: string;
  fit_info: string;
  care_instructions: string;
  price: number;
  original_price: number | null;
  category: string;
  collection_name: string;
  is_new_arrival: boolean;
  is_best_seller: boolean;
  is_trending: boolean;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  images?: ProductImage[];
  variants?: ProductVariant[];
  size_charts?: SizeChartRow[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string;
  color_name: string | null;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string | null;
  color_name: string;
  color_hex: string;
  size_name: string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SizeChartRow {
  id: string;
  product_id: string;
  size_name: string;
  size_order: number;
  weight_min_kg: number;
  weight_max_kg: number;
  height_min_cm: number;
  height_max_cm: number;
  waist_cm: string;
  hip_cm: string;
  inseam_cm: string;
  length_cm: string;
  thigh_cm: string;
  created_at: string;
}

export interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string | null;
  variant_id?: string | null;
  product_name: string;
  product_slug: string | null;
  product_image: string | null;
  color_name: string;
  color_hex: string | null;
  size_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  id: string;
  order_reference: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  governorate: string;
  city: string;
  delivery_address: string;
  order_notes: string;
  payment_method: 'COD';
  subtotal: number;
  email_discount_amount: number;
  promo_discount_amount: number;
  discount_total: number;
  applied_promo_code: string | null;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface DiscountRule {
  id: string;
  code: string | null;
  name: string;
  description: string;
  rule_type: 'email_auto' | 'promo_code';
  discount_percent: number;
  min_order_amount: number;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NavLinkItem {
  label: string;
  path: string;
}

export interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  x?: string;
}

export interface SiteSettings {
  id: string;
  hero_bg_text: string;
  hero_script_text: string;
  hero_tagline: string;
  hero_collection_label: string;
  hero_cta_label: string;
  products_heading: string;
  products_subheading: string;
  newsletter_text: string;
  footer_tagline: string;
  copyright_text: string;
  nav_links: NavLinkItem[];
  footer_links: NavLinkItem[];
  social_links: SocialLinks;
  updated_at?: string;
}

export interface CartItem {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image: string | null;
  color_name: string;
  color_hex: string;
  size_name: string;
  unit_price: number;
  original_price: number | null;
  quantity: number;
  max_stock: number;
}

export interface QuoteResponse {
  valid: boolean;
  stock_errors: string[];
  items: Array<{
    variant_id: string;
    product_id: string;
    product_name: string;
    product_slug: string;
    product_image: string | null;
    color_name: string;
    color_hex: string;
    size_name: string;
    unit_price: number;
    quantity: number;
    available_stock: number;
    line_total: number;
  }>;
  subtotal: number;
  email_discount_applied: boolean;
  email_discount_percent: number;
  email_discount_amount: number;
  promo_code_applied: string | null;
  promo_discount_percent: number;
  promo_discount_amount: number;
  promo_error: string | null;
  discount_total: number;
  final_total: number;
}

export interface OrderConfirmationData {
  order_id: string;
  order_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  governorate: string;
  city: string;
  delivery_address: string;
  order_notes: string;
  payment_method: 'COD';
  subtotal: number;
  email_discount_amount: number;
  promo_discount_amount: number;
  discount_total: number;
  applied_promo_code: string | null;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  items: OrderItem[];
}
