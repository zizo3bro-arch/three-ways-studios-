-- For NEW installations only. Apply migrations/006_admin_hardening_safe.sql after this file.
-- Existing installations: use migrations/007_cod_checkout.sql, not this setup script.
-- THREE WAYS STUDIOS — 001_schema.sql
-- Complete relational PostgreSQL schema for women's streetwear pants e-commerce

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1. Admin Users (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT 'Studio Administrator',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Products (Women's Pants Only)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  fabric_info TEXT NOT NULL DEFAULT '',
  fit_info TEXT NOT NULL DEFAULT '',
  care_instructions TEXT NOT NULL DEFAULT '',
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  original_price NUMERIC(10, 2) CHECK (original_price IS NULL OR original_price >= 0),
  category TEXT NOT NULL DEFAULT 'Women''s Pants',
  collection_name TEXT NOT NULL DEFAULT '2026 Collection',
  is_new_arrival BOOLEAN NOT NULL DEFAULT FALSE,
  is_best_seller BOOLEAN NOT NULL DEFAULT FALSE,
  is_trending BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT TRUE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_published_sort ON public.products (is_published, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products (slug);

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Product Images
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  color_name TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images (product_id, display_order);

-- 4. Product Variants (Color + Size + Inventory)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE,
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#111111',
  size_name TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 3 CHECK (low_stock_threshold >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_color_size UNIQUE (product_id, color_name, size_name)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants (product_id, is_active);
CREATE INDEX IF NOT EXISTS idx_product_variants_low_stock ON public.product_variants (stock_quantity);

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Product-Specific Size Charts (drives Smart Size Finder & Manual Size Chart)
CREATE TABLE IF NOT EXISTS public.size_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size_name TEXT NOT NULL,
  size_order INTEGER NOT NULL DEFAULT 0,
  weight_min_kg NUMERIC(5, 1) NOT NULL CHECK (weight_min_kg > 0),
  weight_max_kg NUMERIC(5, 1) NOT NULL CHECK (weight_max_kg >= weight_min_kg),
  height_min_cm NUMERIC(5, 1) NOT NULL CHECK (height_min_cm > 0),
  height_max_cm NUMERIC(5, 1) NOT NULL CHECK (height_max_cm >= height_min_cm),
  waist_cm TEXT NOT NULL DEFAULT '',
  hip_cm TEXT NOT NULL DEFAULT '',
  inseam_cm TEXT NOT NULL DEFAULT '',
  length_cm TEXT NOT NULL DEFAULT '',
  thigh_cm TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_size_charts_product_size UNIQUE (product_id, size_name)
);

CREATE INDEX IF NOT EXISTS idx_size_charts_product ON public.size_charts (product_id, size_order);

-- 6. Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  governorate TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers (LOWER(email));

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Discount Rules
CREATE TABLE IF NOT EXISTS public.discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rule_type TEXT NOT NULL CHECK (rule_type IN ('email_auto', 'promo_code')),
  discount_percent NUMERIC(5, 2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_discount_rules_updated_at ON public.discount_rules;
CREATE TRIGGER trg_discount_rules_updated_at
  BEFORE UPDATE ON public.discount_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Orders (Cash on Delivery ONLY)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_reference TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  governorate TEXT NOT NULL,
  city TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  order_notes TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'COD' CHECK (payment_method = 'COD'),
  subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
  email_discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (email_discount_amount >= 0),
  promo_discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (promo_discount_amount >= 0),
  discount_total NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  applied_promo_code TEXT,
  total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_reference ON public.orders (order_reference);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders (customer_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_slug TEXT,
  product_image TEXT,
  color_name TEXT NOT NULL,
  color_hex TEXT,
  size_name TEXT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);

-- 10. Discount Usage Audit Log
CREATE TABLE IF NOT EXISTS public.discount_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_rule_id UUID NOT NULL REFERENCES public.discount_rules(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  discount_amount NUMERIC(10, 2) NOT NULL CHECK (discount_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_usage_rule ON public.discount_usage (discount_rule_id);
CREATE INDEX IF NOT EXISTS idx_discount_usage_order ON public.discount_usage (order_id);

-- 11. Newsletter Subscribers
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Site Settings (Admin-editable Storefront Copy & Navigation)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  hero_bg_text TEXT NOT NULL DEFAULT 'THREE WAYS',
  hero_script_text TEXT NOT NULL DEFAULT 'Three Ways Studios',
  hero_tagline TEXT NOT NULL DEFAULT 'FASHION BEYOND LIMITS.',
  hero_collection_label TEXT NOT NULL DEFAULT 'NEW COLLECTION / 2026',
  hero_cta_label TEXT NOT NULL DEFAULT 'SHOP NOW',
  products_heading TEXT NOT NULL DEFAULT 'Products',
  products_subheading TEXT NOT NULL DEFAULT 'EXPLORE OUR LATEST COLLECTION',
  newsletter_text TEXT NOT NULL DEFAULT 'Subscribe to our newsletter and get exclusive offers.',
  footer_tagline TEXT NOT NULL DEFAULT 'WEAR THE DIFFERENCE.',
  copyright_text TEXT NOT NULL DEFAULT '© 2026 Three Ways Studios. All rights reserved.',
  nav_links JSONB NOT NULL DEFAULT '[{"label":"SHOP","path":"/#products"},{"label":"COLLECTIONS","path":"/collections"},{"label":"ABOUT","path":"/about"},{"label":"JOURNAL","path":"/journal"}]'::jsonb,
  footer_links JSONB NOT NULL DEFAULT '[{"label":"Shop","path":"/#products"},{"label":"About","path":"/about"},{"label":"Contact","path":"/contact"},{"label":"Journal","path":"/journal"}]'::jsonb,
  social_links JSONB NOT NULL DEFAULT '{"instagram":"https://instagram.com","tiktok":"https://tiktok.com","youtube":"https://youtube.com","x":"https://x.com"}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- THREE WAYS STUDIOS — 002_rls_policies.sql
-- Strict Row Level Security (RLS) policies

-- Helper function: checks if current authenticated user is registered in admin_users
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE id = auth.uid()
  );
$$;

-- Enable RLS on every table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- ADMIN USERS
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
CREATE POLICY "Admins can view admin_users"
  ON public.admin_users FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- PRODUCTS (Public reads ONLY published products; Admins have full CRUD)
DROP POLICY IF EXISTS "Public reads published products" ON public.products;
CREATE POLICY "Public reads published products"
  ON public.products FOR SELECT
  USING (is_published = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products"
  ON public.products FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PRODUCT IMAGES
DROP POLICY IF EXISTS "Public reads published product images" ON public.product_images;
CREATE POLICY "Public reads published product images"
  ON public.product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id AND p.is_published = TRUE
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins manage product images" ON public.product_images;
CREATE POLICY "Admins manage product images"
  ON public.product_images FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PRODUCT VARIANTS
DROP POLICY IF EXISTS "Public reads published product variants" ON public.product_variants;
CREATE POLICY "Public reads published product variants"
  ON public.product_variants FOR SELECT
  USING (
    (is_active = TRUE AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id AND p.is_published = TRUE
    ))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins manage product variants" ON public.product_variants;
CREATE POLICY "Admins manage product variants"
  ON public.product_variants FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SIZE CHARTS
DROP POLICY IF EXISTS "Public reads published size charts" ON public.size_charts;
CREATE POLICY "Public reads published size charts"
  ON public.size_charts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = size_charts.product_id AND p.is_published = TRUE
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins manage size charts" ON public.size_charts;
CREATE POLICY "Admins manage size charts"
  ON public.size_charts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- SITE SETTINGS (Public readable; Admins editable)
DROP POLICY IF EXISTS "Public reads site settings" ON public.site_settings;
CREATE POLICY "Public reads site settings"
  ON public.site_settings FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "Admins manage site settings" ON public.site_settings;
CREATE POLICY "Admins manage site settings"
  ON public.site_settings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PRIVATE TABLES (Strictly Admin-only via direct queries; Checkout uses SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Admins manage customers" ON public.customers;
CREATE POLICY "Admins manage customers"
  ON public.customers FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage discount rules" ON public.discount_rules;
CREATE POLICY "Admins manage discount rules"
  ON public.discount_rules FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage orders" ON public.orders;
CREATE POLICY "Admins manage orders"
  ON public.orders FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage order items" ON public.order_items;
CREATE POLICY "Admins manage order items"
  ON public.order_items FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage discount usage" ON public.discount_usage;
CREATE POLICY "Admins manage discount usage"
  ON public.discount_usage FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- NEWSLETTER SUBSCRIBERS (Public can insert valid email; Admins can view/delete)
DROP POLICY IF EXISTS "Public can subscribe to newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Public can subscribe to newsletter"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (
    email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

DROP POLICY IF EXISTS "Admins manage newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins manage newsletter subscribers"
  ON public.newsletter_subscribers FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins delete newsletter subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins delete newsletter subscribers"
  ON public.newsletter_subscribers FOR DELETE
  USING (public.is_admin());
-- THREE WAYS STUDIOS — 003_functions_and_storage.sql
-- Authoritative backend RPCs (10% email discount validation, promo codes, atomic COD orders) & Storage

-- Historical receipts retain their original totals. This field records delivery on new orders.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0);

CREATE OR REPLACE FUNCTION public.studio_shipping_cost(p_subtotal NUMERIC)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN p_subtotal <= 0 OR p_subtotal >= 3500 THEN 0 ELSE 75 END::NUMERIC;
$$;

-- 1. Quote COD Order (authoritative server-side price, stock & discount preview)
CREATE OR REPLACE FUNCTION public.quote_cod_order(
  p_items JSONB,
  p_email TEXT DEFAULT NULL,
  p_promo_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_variant RECORD;
  v_qty INTEGER;
  v_subtotal NUMERIC(10, 2) := 0;
  v_line_total NUMERIC(10, 2);
  v_items_out JSONB := '[]'::jsonb;
  v_stock_errors JSONB := '[]'::jsonb;
  v_valid BOOLEAN := TRUE;
  v_clean_email TEXT;
  v_email_valid BOOLEAN := FALSE;
  v_email_rule public.discount_rules%ROWTYPE;
  v_email_discount_percent NUMERIC(5, 2) := 0;
  v_email_discount_amount NUMERIC(10, 2) := 0;
  v_promo_rule public.discount_rules%ROWTYPE;
  v_clean_promo TEXT;
  v_promo_discount_percent NUMERIC(5, 2) := 0;
  v_promo_discount_amount NUMERIC(10, 2) := 0;
  v_promo_error TEXT := NULL;
  v_discount_total NUMERIC(10, 2) := 0;
  v_shipping NUMERIC(10, 2) := 0;
  v_final_total NUMERIC(10, 2) := 0;
  v_primary_image TEXT;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'valid', FALSE,
      'stock_errors', jsonb_build_array('Your shopping bag is empty.'),
      'items', '[]'::jsonb,
      'subtotal', 0,
      'email_discount_applied', FALSE,
      'email_discount_percent', 0,
      'email_discount_amount', 0,
      'promo_code_applied', NULL,
      'promo_discount_percent', 0,
      'promo_discount_amount', 0,
      'promo_error', NULL,
      'discount_total', 0,
      'final_total', 0
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
    IF v_qty <= 0 THEN
      v_valid := FALSE;
      v_stock_errors := v_stock_errors || jsonb_build_array('Invalid item quantity.');
      CONTINUE;
    END IF;

    SELECT
      pv.id AS variant_id,
      pv.product_id,
      pv.color_name,
      pv.color_hex,
      pv.size_name,
      pv.stock_quantity,
      pv.is_active,
      p.name AS product_name,
      p.slug AS product_slug,
      p.price,
      p.original_price,
      p.is_published
    INTO v_variant
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = (v_item->>'variant_id')::UUID;

    IF NOT FOUND OR v_variant.is_published = FALSE OR v_variant.is_active = FALSE THEN
      v_valid := FALSE;
      v_stock_errors := v_stock_errors || jsonb_build_array('One or more selected items are no longer available.');
      CONTINUE;
    END IF;

    IF v_variant.stock_quantity < v_qty THEN
      v_valid := FALSE;
      IF v_variant.stock_quantity = 0 THEN
        v_stock_errors := v_stock_errors || jsonb_build_array(
          format('%s (%s / %s) is currently out of stock.', v_variant.product_name, v_variant.color_name, v_variant.size_name)
        );
      ELSE
        v_stock_errors := v_stock_errors || jsonb_build_array(
          format('Only %s left for %s (%s / %s).', v_variant.stock_quantity, v_variant.product_name, v_variant.color_name, v_variant.size_name)
        );
      END IF;
    END IF;

    SELECT url INTO v_primary_image
    FROM public.product_images
    WHERE product_id = v_variant.product_id
    ORDER BY (color_name IS NOT DISTINCT FROM v_variant.color_name) DESC, is_primary DESC, display_order ASC
    LIMIT 1;

    v_line_total := ROUND(v_variant.price * v_qty, 2);
    v_subtotal := v_subtotal + v_line_total;

    v_items_out := v_items_out || jsonb_build_object(
      'variant_id', v_variant.variant_id,
      'product_id', v_variant.product_id,
      'product_name', v_variant.product_name,
      'product_slug', v_variant.product_slug,
      'product_image', v_primary_image,
      'color_name', v_variant.color_name,
      'color_hex', v_variant.color_hex,
      'size_name', v_variant.size_name,
      'unit_price', v_variant.price,
      'quantity', v_qty,
      'available_stock', v_variant.stock_quantity,
      'line_total', v_line_total
    );
  END LOOP;

  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
  v_email_valid := v_clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

  -- Backend-validated 10% email discount rule
  IF v_email_valid AND v_subtotal > 0 THEN
    SELECT * INTO v_email_rule
    FROM public.discount_rules
    WHERE rule_type = 'email_auto'
      AND is_active = TRUE
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
      AND (max_uses IS NULL OR uses_count < max_uses)
      AND v_subtotal >= min_order_amount
    ORDER BY discount_percent DESC
    LIMIT 1;

    IF FOUND THEN
      v_email_discount_percent := v_email_rule.discount_percent;
      v_email_discount_amount := ROUND(v_subtotal * (v_email_discount_percent / 100.0), 2);
    END IF;
  END IF;

  -- Optional Promo Code validation
  v_clean_promo := UPPER(TRIM(COALESCE(p_promo_code, '')));
  IF v_clean_promo <> '' THEN
    SELECT * INTO v_promo_rule
    FROM public.discount_rules
    WHERE rule_type = 'promo_code'
      AND UPPER(code) = v_clean_promo
    LIMIT 1;

    IF NOT FOUND OR v_promo_rule.is_active = FALSE THEN
      v_promo_error := 'Invalid or inactive promo code.';
    ELSIF v_promo_rule.starts_at IS NOT NULL AND v_promo_rule.starts_at > NOW() THEN
      v_promo_error := 'This promo code is not active yet.';
    ELSIF v_promo_rule.ends_at IS NOT NULL AND v_promo_rule.ends_at < NOW() THEN
      v_promo_error := 'This promo code has expired.';
    ELSIF v_promo_rule.max_uses IS NOT NULL AND v_promo_rule.uses_count >= v_promo_rule.max_uses THEN
      v_promo_error := 'This promo code has reached its usage limit.';
    ELSIF v_subtotal < v_promo_rule.min_order_amount THEN
      v_promo_error := format('Minimum order of EGP %s required for this code.', v_promo_rule.min_order_amount);
    ELSE
      v_promo_discount_percent := v_promo_rule.discount_percent;
      v_promo_discount_amount := ROUND(GREATEST(v_subtotal - v_email_discount_amount, 0) * (v_promo_discount_percent / 100.0), 2);
    END IF;
  END IF;

  v_discount_total := LEAST(v_subtotal, ROUND(v_email_discount_amount + v_promo_discount_amount, 2));
  v_shipping := public.studio_shipping_cost(v_subtotal);
  v_final_total := GREATEST(0, ROUND(v_subtotal - v_discount_total + v_shipping, 2));

  RETURN jsonb_build_object(
    'valid', v_valid,
    'stock_errors', v_stock_errors,
    'items', v_items_out,
    'subtotal', v_subtotal,
    'shipping_cost', v_shipping,
    'email_discount_applied', v_email_discount_amount > 0,
    'email_discount_percent', v_email_discount_percent,
    'email_discount_amount', v_email_discount_amount,
    'promo_code_applied', CASE WHEN v_promo_discount_amount > 0 THEN v_promo_rule.code ELSE NULL END,
    'promo_discount_percent', v_promo_discount_percent,
    'promo_discount_amount', v_promo_discount_amount,
    'promo_error', v_promo_error,
    'discount_total', v_discount_total,
    'final_total', v_final_total
  );
END;
$$;

-- 2. Create COD Order (Atomic stock locking, backend discount validation, inventory decrement)
CREATE OR REPLACE FUNCTION public.create_cod_order(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_governorate TEXT,
  p_city TEXT,
  p_address TEXT,
  p_notes TEXT DEFAULT '',
  p_items JSONB DEFAULT '[]'::jsonb,
  p_promo_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_phone TEXT;
  v_clean_gov TEXT;
  v_clean_city TEXT;
  v_clean_address TEXT;
  v_clean_notes TEXT;
  v_clean_promo TEXT;
  v_item JSONB;
  v_variant RECORD;
  v_qty INTEGER;
  v_subtotal NUMERIC(10, 2) := 0;
  v_line_total NUMERIC(10, 2);
  v_email_rule public.discount_rules%ROWTYPE;
  v_email_discount_amount NUMERIC(10, 2) := 0;
  v_promo_rule public.discount_rules%ROWTYPE;
  v_promo_discount_amount NUMERIC(10, 2) := 0;
  v_discount_total NUMERIC(10, 2) := 0;
  v_shipping NUMERIC(10, 2) := 0;
  v_final_total NUMERIC(10, 2) := 0;
  v_customer_id UUID;
  v_order_id UUID;
  v_order_ref TEXT;
  v_primary_image TEXT;
  v_order_items_out JSONB := '[]'::jsonb;
BEGIN
  v_clean_name := TRIM(COALESCE(p_full_name, ''));
  v_clean_email := LOWER(TRIM(COALESCE(p_email, '')));
  v_clean_phone := TRIM(COALESCE(p_phone, ''));
  v_clean_gov := TRIM(COALESCE(p_governorate, ''));
  v_clean_city := TRIM(COALESCE(p_city, ''));
  v_clean_address := TRIM(COALESCE(p_address, ''));
  v_clean_notes := TRIM(COALESCE(p_notes, ''));
  v_clean_promo := UPPER(TRIM(COALESCE(p_promo_code, '')));

  IF v_clean_name = '' OR v_clean_phone = '' OR v_clean_gov = '' OR v_clean_city = '' OR v_clean_address = '' THEN
    RAISE EXCEPTION 'Please complete all required delivery details.';
  END IF;

  IF NOT (v_clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
    RAISE EXCEPTION 'A valid email address is required before placing your order.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your shopping bag is empty.';
  END IF;

  -- Lock variants in deterministic order to avoid concurrent overselling
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
    ORDER BY (value->>'variant_id')::UUID
  LOOP
    v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity specified.';
    END IF;

    SELECT
      pv.id AS variant_id,
      pv.product_id,
      pv.color_name,
      pv.color_hex,
      pv.size_name,
      pv.stock_quantity,
      pv.is_active,
      p.name AS product_name,
      p.slug AS product_slug,
      p.price,
      p.is_published
    INTO v_variant
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = (v_item->>'variant_id')::UUID
    FOR UPDATE OF pv;

    IF NOT FOUND OR v_variant.is_published = FALSE OR v_variant.is_active = FALSE THEN
      RAISE EXCEPTION 'One of the selected products is no longer available.';
    END IF;

    IF v_variant.stock_quantity < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for % (% / %). Available: %',
        v_variant.product_name, v_variant.color_name, v_variant.size_name, v_variant.stock_quantity;
    END IF;

    v_subtotal := v_subtotal + ROUND(v_variant.price * v_qty, 2);
  END LOOP;

  -- Authoritative backend 10% email discount lookup
  SELECT * INTO v_email_rule
  FROM public.discount_rules
  WHERE rule_type = 'email_auto'
    AND is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
    AND (max_uses IS NULL OR uses_count < max_uses)
    AND v_subtotal >= min_order_amount
  ORDER BY discount_percent DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_email_discount_amount := ROUND(v_subtotal * (v_email_rule.discount_percent / 100.0), 2);
  END IF;

  -- Optional Promo code validation
  IF v_clean_promo <> '' THEN
    SELECT * INTO v_promo_rule
    FROM public.discount_rules
    WHERE rule_type = 'promo_code'
      AND UPPER(code) = v_clean_promo
      AND is_active = TRUE
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
      AND (max_uses IS NULL OR uses_count < max_uses)
      AND v_subtotal >= min_order_amount
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The promo code "%" is invalid, expired, or does not meet order requirements.', v_clean_promo;
    END IF;

    v_promo_discount_amount := ROUND(GREATEST(v_subtotal - v_email_discount_amount, 0) * (v_promo_rule.discount_percent / 100.0), 2);
  END IF;

  v_discount_total := LEAST(v_subtotal, ROUND(v_email_discount_amount + v_promo_discount_amount, 2));
  v_shipping := public.studio_shipping_cost(v_subtotal);
  v_final_total := GREATEST(0, ROUND(v_subtotal - v_discount_total + v_shipping, 2));

  -- Upsert customer by email
  INSERT INTO public.customers (full_name, email, phone, governorate, city, address)
  VALUES (v_clean_name, v_clean_email, v_clean_phone, v_clean_gov, v_clean_city, v_clean_address)
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    governorate = EXCLUDED.governorate,
    city = EXCLUDED.city,
    address = EXCLUDED.address,
    updated_at = NOW()
  RETURNING id INTO v_customer_id;

  -- Generate unique order reference: TWS-2026-XXXXXX
  v_order_ref := 'TWS-' || TO_CHAR(NOW(), 'YYYY') || '-' || UPPER(LEFT(REPLACE(gen_random_uuid()::TEXT, '-', ''), 12));

  INSERT INTO public.orders (
    order_reference,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    governorate,
    city,
    delivery_address,
    order_notes,
    payment_method,
    subtotal,
    shipping_cost,
    email_discount_amount,
    promo_discount_amount,
    discount_total,
    applied_promo_code,
    total_amount,
    status
  )
  VALUES (
    v_order_ref,
    v_customer_id,
    v_clean_name,
    v_clean_email,
    v_clean_phone,
    v_clean_gov,
    v_clean_city,
    v_clean_address,
    v_clean_notes,
    'COD',
    v_subtotal,
    v_shipping,
    v_email_discount_amount,
    v_promo_discount_amount,
    v_discount_total,
    CASE WHEN v_promo_discount_amount > 0 THEN v_promo_rule.code ELSE NULL END,
    v_final_total,
    'pending'
  )
  RETURNING id INTO v_order_id;

  -- Create order items & decrement inventory
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::INTEGER;

    SELECT
      pv.id AS variant_id,
      pv.product_id,
      pv.color_name,
      pv.color_hex,
      pv.size_name,
      p.name AS product_name,
      p.slug AS product_slug,
      p.price
    INTO v_variant
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = (v_item->>'variant_id')::UUID;

    SELECT url INTO v_primary_image
    FROM public.product_images
    WHERE product_id = v_variant.product_id
    ORDER BY (color_name IS NOT DISTINCT FROM v_variant.color_name) DESC, is_primary DESC, display_order ASC
    LIMIT 1;

    v_line_total := ROUND(v_variant.price * v_qty, 2);

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      product_slug,
      product_image,
      color_name,
      color_hex,
      size_name,
      unit_price,
      quantity,
      line_total
    )
    VALUES (
      v_order_id,
      v_variant.product_id,
      v_variant.variant_id,
      v_variant.product_name,
      v_variant.product_slug,
      v_primary_image,
      v_variant.color_name,
      v_variant.color_hex,
      v_variant.size_name,
      v_variant.price,
      v_qty,
      v_line_total
    );

    UPDATE public.product_variants
    SET stock_quantity = stock_quantity - v_qty
    WHERE id = v_variant.variant_id;

    v_order_items_out := v_order_items_out || jsonb_build_object(
      'product_name', v_variant.product_name,
      'product_slug', v_variant.product_slug,
      'product_image', v_primary_image,
      'color_name', v_variant.color_name,
      'color_hex', v_variant.color_hex,
      'size_name', v_variant.size_name,
      'unit_price', v_variant.price,
      'quantity', v_qty,
      'line_total', v_line_total
    );
  END LOOP;

  -- Log discount usage & increment counters
  IF v_email_discount_amount > 0 AND v_email_rule.id IS NOT NULL THEN
    INSERT INTO public.discount_usage (discount_rule_id, order_id, customer_email, discount_amount)
    VALUES (v_email_rule.id, v_order_id, v_clean_email, v_email_discount_amount);

    UPDATE public.discount_rules SET uses_count = uses_count + 1 WHERE id = v_email_rule.id;
  END IF;

  IF v_promo_discount_amount > 0 AND v_promo_rule.id IS NOT NULL THEN
    INSERT INTO public.discount_usage (discount_rule_id, order_id, customer_email, discount_amount)
    VALUES (v_promo_rule.id, v_order_id, v_clean_email, v_promo_discount_amount);

    UPDATE public.discount_rules SET uses_count = uses_count + 1 WHERE id = v_promo_rule.id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_reference', v_order_ref,
    'customer_name', v_clean_name,
    'customer_email', v_clean_email,
    'customer_phone', v_clean_phone,
    'governorate', v_clean_gov,
    'city', v_clean_city,
    'delivery_address', v_clean_address,
    'order_notes', v_clean_notes,
    'payment_method', 'COD',
    'subtotal', v_subtotal,
    'shipping_cost', v_shipping,
    'email_discount_amount', v_email_discount_amount,
    'promo_discount_amount', v_promo_discount_amount,
    'discount_total', v_discount_total,
    'applied_promo_code', CASE WHEN v_promo_discount_amount > 0 THEN v_promo_rule.code ELSE NULL END,
    'total_amount', v_final_total,
    'status', 'pending',
    'created_at', NOW(),
    'items', v_order_items_out
  );
END;
$$;

-- 3. Order Confirmation Lookup (requires both order_reference and email for privacy)
CREATE OR REPLACE FUNCTION public.get_order_confirmation(
  p_order_reference TEXT,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_items JSONB;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE UPPER(order_reference) = UPPER(TRIM(p_order_reference))
    AND LOWER(customer_email) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_name', product_name,
    'product_slug', product_slug,
    'product_image', product_image,
    'color_name', color_name,
    'color_hex', color_hex,
    'size_name', size_name,
    'unit_price', unit_price,
    'quantity', quantity,
    'line_total', line_total
  )), '[]'::jsonb)
  INTO v_items
  FROM public.order_items
  WHERE order_id = v_order.id;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_reference', v_order.order_reference,
    'customer_name', v_order.customer_name,
    'customer_email', v_order.customer_email,
    'customer_phone', v_order.customer_phone,
    'governorate', v_order.governorate,
    'city', v_order.city,
    'delivery_address', v_order.delivery_address,
    'order_notes', v_order.order_notes,
    'payment_method', v_order.payment_method,
    'subtotal', v_order.subtotal,
    'shipping_cost', v_order.shipping_cost,
    'email_discount_amount', v_order.email_discount_amount,
    'promo_discount_amount', v_order.promo_discount_amount,
    'discount_total', v_order.discount_total,
    'applied_promo_code', v_order.applied_promo_code,
    'total_amount', v_order.total_amount,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'items', v_items
  );
END;
$$;

-- Explicit payment selection for new clients. The original 9-argument function
-- remains callable by older storefronts and still enforces COD in the table.
CREATE OR REPLACE FUNCTION public.create_cod_order(
  p_full_name TEXT, p_email TEXT, p_phone TEXT, p_governorate TEXT, p_city TEXT,
  p_address TEXT, p_notes TEXT, p_items JSONB, p_promo_code TEXT, p_payment_method TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_payment_method IS DISTINCT FROM 'COD' THEN
    RAISE EXCEPTION 'Cash on delivery is the only supported payment method.';
  END IF;
  RETURN public.create_cod_order(p_full_name, p_email, p_phone, p_governorate, p_city,
    p_address, p_notes, p_items, p_promo_code);
END;
$$;
REVOKE ALL ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) TO anon, authenticated, service_role;

-- 4. Admin Order Status Update with automatic stock restore on cancellation
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status TEXT;
  v_item RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  IF p_new_status NOT IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid order status.';
  END IF;

  SELECT status INTO v_old_status FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- Restore stock when cancelling an active order
  IF v_old_status <> 'cancelled' AND p_new_status = 'cancelled' THEN
    FOR v_item IN SELECT variant_id, quantity FROM public.order_items WHERE order_id = p_order_id AND variant_id IS NOT NULL
    LOOP
      UPDATE public.product_variants
      SET stock_quantity = stock_quantity + v_item.quantity
      WHERE id = v_item.variant_id;
    END LOOP;
  -- Deduct stock again if un-cancelling an order
  ELSIF v_old_status = 'cancelled' AND p_new_status <> 'cancelled' THEN
    FOR v_item IN SELECT variant_id, quantity FROM public.order_items WHERE order_id = p_order_id AND variant_id IS NOT NULL
    LOOP
      UPDATE public.product_variants
      SET stock_quantity = stock_quantity - v_item.quantity
      WHERE id = v_item.variant_id AND stock_quantity >= v_item.quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock to reactivate order.';
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
END;
$$;

-- Grant execute permissions cleanly
GRANT EXECUTE ON FUNCTION public.quote_cod_order(JSONB, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cod_order(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_confirmation(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT) TO authenticated;

-- 5. Supabase Storage Bucket for Product Images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins upload product images" ON storage.objects;
CREATE POLICY "Admins upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update product images" ON storage.objects;
CREATE POLICY "Admins update product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete product images" ON storage.objects;
CREATE POLICY "Admins delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND public.is_admin());
-- THREE WAYS STUDIOS — 004_initial_config.sql
-- Essential configuration rows ONLY (NO fake products or fake inventory)

-- Default backend-enforced 10% email checkout discount rule
INSERT INTO public.discount_rules (
  code,
  name,
  description,
  rule_type,
  discount_percent,
  min_order_amount,
  is_active
)
VALUES (
  'EMAIL10',
  'Email Checkout Privilege (10% OFF)',
  'Automatically grants 10% off at checkout once the customer provides a valid email address.',
  'email_auto',
  10.00,
  0.00,
  TRUE
)
ON CONFLICT (code) DO NOTHING;

-- Default storefront editorial content (editable from Admin Dashboard)
INSERT INTO public.site_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
