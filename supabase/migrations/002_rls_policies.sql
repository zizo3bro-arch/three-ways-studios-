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
