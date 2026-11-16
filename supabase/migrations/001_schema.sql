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
