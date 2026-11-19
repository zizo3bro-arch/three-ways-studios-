-- =========================================================
-- THREE WAYS STUDIOS — 010_account_loyalty_discounts.sql
--
-- Adds full server-side support for:
--   1. Customer personal account overview & purchase history (completed vs in-progress/cancelled)
--   2. Real-time 4-stage order tracking (Accepted, Preparing, Ready / Not Shipped, Out for Delivery + Delivered/Cancelled)
--   3. Loyalty card system (1 FREE product unlocked every 5 completed purchases, duplicate-proof via UNIQUE constraint)
--   4. Two-option 10% discount system:
--      - Option 1: 10% Purchase Loyalty Discount after completing 3 purchases
--      - Option 2: One-time 10% Email Discount after submitting email address
--      Non-stacking (strictly capped at max 10% when both conditions are met)
--      and protected against replay/refresh/concurrent double-redemption.
--
-- Safe, additive & idempotent on existing installations.
-- Reversible via 010_account_loyalty_discounts.down.sql.
-- =========================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.studio_shipping_cost(numeric)') IS NULL
     OR to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Base schema and 007_cod_checkout.sql must be present before applying 010_account_loyalty_discounts.sql.';
  END IF;
END;
$$;

-- ——— 1. Schema extensions on public.orders ———
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loyalty_discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (loyalty_discount_amount >= 0),
  ADD COLUMN IF NOT EXISTS loyalty_free_reward_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (loyalty_free_reward_amount >= 0),
  ADD COLUMN IF NOT EXISTS loyalty_milestone_redeemed INTEGER CHECK (loyalty_milestone_redeemed IS NULL OR loyalty_milestone_redeemed >= 1);

-- Expand status check to include 'ready' ("Ready / Not Shipped") while keeping all existing statuses valid
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_orders_auth_user
  ON public.orders (auth_user_id, created_at DESC)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_email_lower
  ON public.orders (LOWER(customer_email), created_at DESC);

-- Link pre-existing orders to registered non-admin customer accounts where email matches
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'auth_user_id'
  ) THEN
    UPDATE public.orders o
    SET auth_user_id = c.auth_user_id
    FROM public.customers c
    WHERE o.auth_user_id IS NULL
      AND c.auth_user_id IS NOT NULL
      AND LOWER(BTRIM(o.customer_email)) = LOWER(BTRIM(c.email))
      AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = c.auth_user_id);
  END IF;
END;
$$;

-- ——— 2. Duplicate-proof Loyalty Reward Redemptions ledger ———
CREATE TABLE IF NOT EXISTS public.loyalty_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_key TEXT NOT NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  milestone_number INTEGER NOT NULL CHECK (milestone_number >= 1),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  reward_amount NUMERIC(10, 2) NOT NULL CHECK (reward_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_loyalty_customer_milestone UNIQUE (customer_key, milestone_number)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_customer
  ON public.loyalty_reward_redemptions (customer_key);

ALTER TABLE public.loyalty_reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage loyalty redemptions" ON public.loyalty_reward_redemptions;
CREATE POLICY "Admins manage loyalty redemptions"
  ON public.loyalty_reward_redemptions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ——— 3. Ensure default 10% Email Discount rule is configured and active ———
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
  'Email Submission Discount (10% OFF)',
  'One-time 10% discount unlocked when a customer submits their email address.',
  'email_auto',
  10.00,
  0.00,
  TRUE
)
ON CONFLICT (code) DO UPDATE SET
  discount_percent = 10.00,
  is_active = TRUE,
  updated_at = NOW();

-- ——— 4. Canonical Order Tracking Stage mapper ———
CREATE OR REPLACE FUNCTION public.order_tracking_stage(p_status TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_status
    WHEN 'pending' THEN jsonb_build_object(
      'step', 1,
      'code', 'accepted',
      'label', 'Accepted',
      'description', 'Order accepted.',
      'is_completed', FALSE,
      'is_cancelled', FALSE
    )
    WHEN 'confirmed' THEN jsonb_build_object(
      'step', 1,
      'code', 'accepted',
      'label', 'Accepted',
      'description', 'Order accepted.',
      'is_completed', FALSE,
      'is_cancelled', FALSE
    )
    WHEN 'processing' THEN jsonb_build_object(
      'step', 2,
      'code', 'preparing',
      'label', 'Preparing',
      'description', 'Order is being prepared.',
      'is_completed', FALSE,
      'is_cancelled', FALSE
    )
    WHEN 'ready' THEN jsonb_build_object(
      'step', 3,
      'code', 'ready',
      'label', 'Ready / Not Shipped',
      'description', 'Order has not left yet.',
      'is_completed', FALSE,
      'is_cancelled', FALSE
    )
    WHEN 'shipped' THEN jsonb_build_object(
      'step', 4,
      'code', 'out_for_delivery',
      'label', 'Out for Delivery',
      'description', 'Order is on its way.',
      'is_completed', FALSE,
      'is_cancelled', FALSE
    )
    WHEN 'delivered' THEN jsonb_build_object(
      'step', 5,
      'code', 'delivered',
      'label', 'Delivered',
      'description', 'Order delivered and completed.',
      'is_completed', TRUE,
      'is_cancelled', FALSE
    )
    WHEN 'cancelled' THEN jsonb_build_object(
      'step', 0,
      'code', 'cancelled',
      'label', 'Cancelled',
      'description', 'Order was cancelled.',
      'is_completed', FALSE,
      'is_cancelled', TRUE
    )
    ELSE jsonb_build_object(
      'step', 1,
      'code', 'accepted',
      'label', 'Accepted',
      'description', 'Order accepted.',
      'is_completed', FALSE,
      'is_cancelled', FALSE
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.order_tracking_stage(TEXT) TO anon, authenticated, service_role;

-- ——— 5. Privacy-preserving Order Tracking RPC ———
-- Requires BOTH exact order_reference and matching email; exposes zero street/phone PII.
CREATE OR REPLACE FUNCTION public.track_order(
  p_order_reference TEXT,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ref TEXT;
  v_email TEXT;
  v_order RECORD;
  v_items JSONB;
BEGIN
  v_ref := UPPER(BTRIM(COALESCE(p_order_reference, '')));
  v_email := LOWER(BTRIM(COALESCE(p_email, '')));

  IF v_ref = '' OR v_email = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE UPPER(BTRIM(order_reference)) = v_ref
    AND LOWER(BTRIM(customer_email)) = v_email
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
    'order_reference', v_order.order_reference,
    'status', v_order.status,
    'tracking', public.order_tracking_stage(v_order.status),
    'payment_method', v_order.payment_method,
    'subtotal', v_order.subtotal,
    'shipping_cost', v_order.shipping_cost,
    'email_discount_amount', v_order.email_discount_amount,
    'loyalty_discount_amount', v_order.loyalty_discount_amount,
    'loyalty_free_reward_amount', v_order.loyalty_free_reward_amount,
    'promo_discount_amount', v_order.promo_discount_amount,
    'discount_total', v_order.discount_total,
    'applied_promo_code', v_order.applied_promo_code,
    'total_amount', v_order.total_amount,
    'city', v_order.city,
    'governorate', v_order.governorate,
    'created_at', v_order.created_at,
    'updated_at', v_order.updated_at,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.track_order(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order(TEXT, TEXT) TO anon, authenticated, service_role;

-- ——— 6. Authenticated Customer Account Overview (Profile + History + Loyalty + Discounts) ———
CREATE OR REPLACE FUNCTION public.get_customer_account_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_user RECORD;
  v_email TEXT;
  v_name TEXT;
  v_customer public.customers%ROWTYPE;
  v_has_customer BOOLEAN := FALSE;
  v_completed_purchases INTEGER := 0;
  v_qualifying_purchases INTEGER := 0;
  v_earned_rewards INTEGER := 0;
  v_redeemed_rewards INTEGER := 0;
  v_available_rewards INTEGER := 0;
  v_progress_in_cycle INTEGER := 0;
  v_purchases_remaining INTEGER := 5;
  v_email_submitted BOOLEAN := FALSE;
  v_email_discount_used BOOLEAN := FALSE;
  v_email_rule_active BOOLEAN := FALSE;
  v_email_discount_eligible BOOLEAN := FALSE;
  v_loyalty_discount_eligible BOOLEAN := FALSE;
  v_orders JSONB := '[]'::jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF public.is_admin() THEN
    RETURN NULL;
  END IF;

  SELECT u.id, u.email, u.raw_user_meta_data, u.created_at
  INTO v_user
  FROM auth.users u
  WHERE u.id = v_uid AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  v_email := LOWER(BTRIM(COALESCE(v_user.email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Valid account email required.';
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.auth_user_id = v_uid
     OR (c.auth_user_id IS NULL AND LOWER(BTRIM(c.email)) = v_email)
  ORDER BY (c.auth_user_id = v_uid) DESC, c.updated_at DESC
  LIMIT 1;

  v_has_customer := FOUND;

  v_name := COALESCE(
    NULLIF(BTRIM(COALESCE(v_customer.full_name, '')), ''),
    NULLIF(BTRIM(COALESCE(v_user.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(BTRIM(COALESCE(v_user.raw_user_meta_data->>'name', '')), ''),
    ''
  );

  -- Count ONLY successfully completed ('delivered') orders; cancelled/in-progress orders never count.
  SELECT
    COUNT(*) FILTER (WHERE o.status = 'delivered')::INTEGER,
    COUNT(*) FILTER (
      WHERE o.status = 'delivered'
        AND o.subtotal > COALESCE(o.loyalty_free_reward_amount, 0)
    )::INTEGER
  INTO v_completed_purchases, v_qualifying_purchases
  FROM public.orders o
  WHERE o.auth_user_id = v_uid
     OR (o.auth_user_id IS NULL AND LOWER(BTRIM(o.customer_email)) = v_email);

  v_earned_rewards := FLOOR(v_qualifying_purchases / 5.0)::INTEGER;

  SELECT COUNT(*)::INTEGER
  INTO v_redeemed_rewards
  FROM public.loyalty_reward_redemptions lr
  JOIN public.orders o ON o.id = lr.order_id
  WHERE lr.customer_key = v_email
    AND o.status <> 'cancelled';

  v_available_rewards := GREATEST(0, v_earned_rewards - v_redeemed_rewards);

  IF v_available_rewards > 0 THEN
    v_progress_in_cycle := 5;
    v_purchases_remaining := 0;
  ELSE
    v_progress_in_cycle := MOD(v_qualifying_purchases, 5);
    v_purchases_remaining := 5 - v_progress_in_cycle;
  END IF;

  -- Discount eligibility checks
  v_loyalty_discount_eligible := (v_completed_purchases >= 3);

  v_email_submitted := EXISTS (
    SELECT 1 FROM public.newsletter_subscribers ns
    WHERE LOWER(BTRIM(ns.email)) = v_email
  );

  v_email_discount_used := EXISTS (
    SELECT 1 FROM public.orders o
    WHERE (o.auth_user_id = v_uid OR LOWER(BTRIM(o.customer_email)) = v_email)
      AND o.status <> 'cancelled'
      AND o.email_discount_amount > 0
  );

  v_email_rule_active := EXISTS (
    SELECT 1 FROM public.discount_rules dr
    WHERE dr.rule_type = 'email_auto'
      AND dr.is_active = TRUE
      AND (dr.starts_at IS NULL OR dr.starts_at <= NOW())
      AND (dr.ends_at IS NULL OR dr.ends_at >= NOW())
      AND (dr.max_uses IS NULL OR dr.uses_count < dr.max_uses)
  );

  v_email_discount_eligible := (v_email_submitted AND NOT v_email_discount_used AND v_email_rule_active);

  -- Previous orders belonging exclusively to this customer
  SELECT COALESCE(jsonb_agg(order_row ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_orders
  FROM (
    SELECT
      o.created_at,
      jsonb_build_object(
        'order_id', o.id,
        'order_reference', o.order_reference,
        'status', o.status,
        'is_completed', (o.status = 'delivered'),
        'is_cancelled', (o.status = 'cancelled'),
        'tracking', public.order_tracking_stage(o.status),
        'payment_method', o.payment_method,
        'subtotal', o.subtotal,
        'shipping_cost', o.shipping_cost,
        'email_discount_amount', o.email_discount_amount,
        'loyalty_discount_amount', o.loyalty_discount_amount,
        'loyalty_free_reward_amount', o.loyalty_free_reward_amount,
        'promo_discount_amount', o.promo_discount_amount,
        'discount_total', o.discount_total,
        'applied_promo_code', o.applied_promo_code,
        'total_amount', o.total_amount,
        'city', o.city,
        'governorate', o.governorate,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'items', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'product_name', oi.product_name,
            'product_slug', oi.product_slug,
            'product_image', oi.product_image,
            'color_name', oi.color_name,
            'color_hex', oi.color_hex,
            'size_name', oi.size_name,
            'unit_price', oi.unit_price,
            'quantity', oi.quantity,
            'line_total', oi.line_total
          ))
          FROM public.order_items oi
          WHERE oi.order_id = o.id
        ), '[]'::jsonb)
      ) AS order_row
    FROM public.orders o
    WHERE o.auth_user_id = v_uid
       OR (o.auth_user_id IS NULL AND LOWER(BTRIM(o.customer_email)) = v_email)
  ) sub;

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_uid,
      'email', v_email,
      'full_name', v_name,
      'phone', CASE WHEN v_has_customer THEN COALESCE(v_customer.phone, '') ELSE '' END,
      'governorate', CASE WHEN v_has_customer THEN COALESCE(v_customer.governorate, '') ELSE '' END,
      'city', CASE WHEN v_has_customer THEN COALESCE(v_customer.city, '') ELSE '' END,
      'created_at', v_user.created_at
    ),
    'purchase_summary', jsonb_build_object(
      'completed_purchases', v_completed_purchases,
      'total_orders', jsonb_array_length(v_orders)
    ),
    'loyalty', jsonb_build_object(
      'target_purchases', 5,
      'completed_purchases', v_completed_purchases,
      'qualifying_purchases', v_qualifying_purchases,
      'progress_in_cycle', v_progress_in_cycle,
      'purchases_remaining', v_purchases_remaining,
      'earned_rewards', v_earned_rewards,
      'redeemed_rewards', v_redeemed_rewards,
      'available_rewards', v_available_rewards,
      'free_product_unlocked', (v_available_rewards > 0)
    ),
    'discounts', jsonb_build_object(
      'loyalty_target_purchases', 3,
      'loyalty_discount_percent', 10,
      'loyalty_discount_eligible', v_loyalty_discount_eligible,
      'purchases_until_loyalty_discount', GREATEST(0, 3 - v_completed_purchases),
      'email_discount_percent', 10,
      'email_submitted', v_email_submitted,
      'email_discount_used', v_email_discount_used,
      'email_discount_eligible', v_email_discount_eligible,
      'both_eligible_non_stacking', (v_loyalty_discount_eligible AND v_email_discount_eligible),
      'effective_discount_percent', CASE WHEN v_loyalty_discount_eligible OR v_email_discount_eligible THEN 10 ELSE 0 END
    ),
    'orders', v_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_account_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_account_overview() TO authenticated, service_role;

-- ——— 7. Authoritative Server-Side Quote RPC (4-arg + backwards-compatible 3-arg) ———
CREATE OR REPLACE FUNCTION public.quote_cod_order(
  p_items JSONB,
  p_email TEXT,
  p_promo_code TEXT,
  p_redeem_free_reward BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_variant RECORD;
  v_qty INTEGER;
  v_subtotal NUMERIC(10, 2) := 0;
  v_min_unit_price NUMERIC(10, 2) := NULL;
  v_line_total NUMERIC(10, 2);
  v_items_out JSONB := '[]'::jsonb;
  v_stock_errors JSONB := '[]'::jsonb;
  v_valid BOOLEAN := TRUE;
  v_uid UUID;
  v_auth_email TEXT := NULL;
  v_clean_email TEXT;
  v_email_valid BOOLEAN := FALSE;
  v_completed_purchases INTEGER := 0;
  v_qualifying_purchases INTEGER := 0;
  v_earned_rewards INTEGER := 0;
  v_redeemed_rewards INTEGER := 0;
  v_available_rewards INTEGER := 0;
  v_free_reward_applied BOOLEAN := FALSE;
  v_free_reward_amount NUMERIC(10, 2) := 0;
  v_loyalty_eligible BOOLEAN := FALSE;
  v_loyalty_discount_percent NUMERIC(5, 2) := 0;
  v_loyalty_discount_amount NUMERIC(10, 2) := 0;
  v_email_submitted BOOLEAN := FALSE;
  v_email_already_used BOOLEAN := FALSE;
  v_email_eligible BOOLEAN := FALSE;
  v_email_rule public.discount_rules%ROWTYPE;
  v_email_discount_percent NUMERIC(5, 2) := 0;
  v_email_discount_amount NUMERIC(10, 2) := 0;
  v_both_eligible BOOLEAN := FALSE;
  v_discountable_subtotal NUMERIC(10, 2) := 0;
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
      'shipping_cost', 0,
      'email_discount_applied', FALSE,
      'email_discount_percent', 0,
      'email_discount_amount', 0,
      'email_discount_eligible', FALSE,
      'email_discount_already_used', FALSE,
      'loyalty_discount_eligible', FALSE,
      'loyalty_discount_applied', FALSE,
      'loyalty_discount_percent', 0,
      'loyalty_discount_amount', 0,
      'both_discounts_eligible', FALSE,
      'free_reward_available', FALSE,
      'free_reward_applied', FALSE,
      'free_reward_amount', 0,
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
    IF v_min_unit_price IS NULL OR v_variant.price < v_min_unit_price THEN
      v_min_unit_price := v_variant.price;
    END IF;

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

  v_clean_email := LOWER(BTRIM(COALESCE(p_email, '')));

  -- Authenticated customer loyalty & free-product evaluation (never leaks to unauthenticated callers)
  v_uid := auth.uid();
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    SELECT LOWER(BTRIM(u.email))
    INTO v_auth_email
    FROM auth.users u
    WHERE u.id = v_uid AND u.deleted_at IS NULL;

    IF v_auth_email IS NOT NULL AND (v_clean_email = '' OR v_clean_email = v_auth_email) THEN
      SELECT
        COUNT(*) FILTER (WHERE o.status = 'delivered')::INTEGER,
        COUNT(*) FILTER (
          WHERE o.status = 'delivered'
            AND o.subtotal > COALESCE(o.loyalty_free_reward_amount, 0)
        )::INTEGER
      INTO v_completed_purchases, v_qualifying_purchases
      FROM public.orders o
      WHERE o.auth_user_id = v_uid
         OR (o.auth_user_id IS NULL AND LOWER(BTRIM(o.customer_email)) = v_auth_email);

      v_earned_rewards := FLOOR(v_qualifying_purchases / 5.0)::INTEGER;

      SELECT COUNT(*)::INTEGER
      INTO v_redeemed_rewards
      FROM public.loyalty_reward_redemptions lr
      JOIN public.orders o ON o.id = lr.order_id
      WHERE lr.customer_key = v_auth_email
        AND o.status <> 'cancelled';

      v_available_rewards := GREATEST(0, v_earned_rewards - v_redeemed_rewards);
      v_loyalty_eligible := (v_completed_purchases >= 3);

      IF COALESCE(p_redeem_free_reward, FALSE) AND v_available_rewards >= 1 AND v_min_unit_price IS NOT NULL AND v_subtotal > 0 THEN
        v_free_reward_applied := TRUE;
        v_free_reward_amount := LEAST(v_subtotal, ROUND(v_min_unit_price, 2));
      END IF;
    END IF;
  END IF;

  -- Option 2: One-time 10% Email Discount when customer submitted their email address
  v_email_valid := v_clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
  IF v_email_valid AND v_subtotal > 0 THEN
    v_email_submitted := EXISTS (
      SELECT 1 FROM public.newsletter_subscribers ns
      WHERE LOWER(BTRIM(ns.email)) = v_clean_email
    );
    v_email_already_used := EXISTS (
      SELECT 1 FROM public.orders o
      WHERE LOWER(BTRIM(o.customer_email)) = v_clean_email
        AND o.status <> 'cancelled'
        AND o.email_discount_amount > 0
    );

    IF v_email_submitted AND NOT v_email_already_used THEN
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
        v_email_eligible := TRUE;
      END IF;
    END IF;
  END IF;

  -- Non-stacking rule: apply a maximum of 10% when Option 1 and/or Option 2 are met
  v_discountable_subtotal := GREATEST(0, v_subtotal - v_free_reward_amount);
  v_both_eligible := (v_loyalty_eligible AND v_email_eligible);

  IF v_loyalty_eligible AND v_discountable_subtotal > 0 THEN
    v_loyalty_discount_percent := 10.00;
    v_loyalty_discount_amount := ROUND(v_discountable_subtotal * 0.10, 2);
  ELSIF v_email_eligible AND v_discountable_subtotal > 0 THEN
    v_email_discount_percent := LEAST(10.00, v_email_rule.discount_percent);
    v_email_discount_amount := ROUND(v_discountable_subtotal * (v_email_discount_percent / 100.0), 2);
  END IF;

  -- Optional Promo Code validation
  v_clean_promo := UPPER(BTRIM(COALESCE(p_promo_code, '')));
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
      v_promo_discount_amount := ROUND(
        GREATEST(v_discountable_subtotal - v_loyalty_discount_amount - v_email_discount_amount, 0)
        * (v_promo_discount_percent / 100.0),
        2
      );
    END IF;
  END IF;

  v_discount_total := LEAST(
    v_subtotal,
    ROUND(v_free_reward_amount + v_loyalty_discount_amount + v_email_discount_amount + v_promo_discount_amount, 2)
  );
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
    'email_discount_eligible', v_email_eligible,
    'email_discount_already_used', (v_email_submitted AND v_email_already_used),
    'loyalty_discount_eligible', v_loyalty_eligible,
    'loyalty_discount_applied', v_loyalty_discount_amount > 0,
    'loyalty_discount_percent', v_loyalty_discount_percent,
    'loyalty_discount_amount', v_loyalty_discount_amount,
    'both_discounts_eligible', v_both_eligible,
    'free_reward_available', (v_available_rewards > 0),
    'free_reward_applied', v_free_reward_applied,
    'free_reward_amount', v_free_reward_amount,
    'promo_code_applied', CASE WHEN v_promo_discount_amount > 0 THEN v_promo_rule.code ELSE NULL END,
    'promo_discount_percent', v_promo_discount_percent,
    'promo_discount_amount', v_promo_discount_amount,
    'promo_error', v_promo_error,
    'discount_total', v_discount_total,
    'final_total', v_final_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.quote_cod_order(
  p_items JSONB,
  p_email TEXT DEFAULT NULL,
  p_promo_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT public.quote_cod_order(p_items, p_email, p_promo_code, FALSE);
$$;

REVOKE ALL ON FUNCTION public.quote_cod_order(JSONB, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quote_cod_order(JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_cod_order(JSONB, TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.quote_cod_order(JSONB, TEXT, TEXT) TO anon, authenticated, service_role;

-- ——— 8. Authoritative Create COD Order RPC (core + backwards-compatible overloads + 12-arg) ———
CREATE OR REPLACE FUNCTION public.create_cod_order_core(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_governorate TEXT,
  p_city TEXT,
  p_address TEXT,
  p_notes TEXT,
  p_items JSONB,
  p_promo_code TEXT,
  p_redeem_free_reward BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
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
  v_uid UUID;
  v_auth_email TEXT := NULL;
  v_order_auth_uid UUID := NULL;
  v_item JSONB;
  v_variant RECORD;
  v_qty INTEGER;
  v_subtotal NUMERIC(10, 2) := 0;
  v_min_unit_price NUMERIC(10, 2) := NULL;
  v_line_total NUMERIC(10, 2);
  v_completed_purchases INTEGER := 0;
  v_qualifying_purchases INTEGER := 0;
  v_earned_rewards INTEGER := 0;
  v_redeemed_rewards INTEGER := 0;
  v_available_rewards INTEGER := 0;
  v_milestone_to_redeem INTEGER := NULL;
  v_free_reward_amount NUMERIC(10, 2) := 0;
  v_loyalty_eligible BOOLEAN := FALSE;
  v_loyalty_discount_amount NUMERIC(10, 2) := 0;
  v_email_submitted BOOLEAN := FALSE;
  v_email_already_used BOOLEAN := FALSE;
  v_email_rule public.discount_rules%ROWTYPE;
  v_email_discount_amount NUMERIC(10, 2) := 0;
  v_discountable_subtotal NUMERIC(10, 2) := 0;
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
  v_clean_name := BTRIM(COALESCE(p_full_name, ''));
  v_clean_email := LOWER(BTRIM(COALESCE(p_email, '')));
  v_clean_phone := BTRIM(COALESCE(p_phone, ''));
  v_clean_gov := BTRIM(COALESCE(p_governorate, ''));
  v_clean_city := BTRIM(COALESCE(p_city, ''));
  v_clean_address := BTRIM(COALESCE(p_address, ''));
  v_clean_notes := BTRIM(COALESCE(p_notes, ''));
  v_clean_promo := UPPER(BTRIM(COALESCE(p_promo_code, '')));

  IF v_clean_name = '' OR v_clean_phone = '' OR v_clean_gov = '' OR v_clean_city = '' OR v_clean_address = '' THEN
    RAISE EXCEPTION 'Please complete all required delivery details.';
  END IF;

  IF NOT (v_clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
    RAISE EXCEPTION 'A valid email address is required before placing your order.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your shopping bag is empty.';
  END IF;

  -- Serialize discount & reward checks per customer email to eliminate concurrent double-use
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tws-cust:' || v_clean_email, 0));

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
    IF v_min_unit_price IS NULL OR v_variant.price < v_min_unit_price THEN
      v_min_unit_price := v_variant.price;
    END IF;
  END LOOP;

  -- Check authenticated customer session for loyalty & free-product eligibility
  v_uid := auth.uid();
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    SELECT LOWER(BTRIM(u.email))
    INTO v_auth_email
    FROM auth.users u
    WHERE u.id = v_uid AND u.deleted_at IS NULL;

    IF v_auth_email IS NOT NULL AND v_auth_email = v_clean_email THEN
      v_order_auth_uid := v_uid;

      SELECT
        COUNT(*) FILTER (WHERE o.status = 'delivered')::INTEGER,
        COUNT(*) FILTER (
          WHERE o.status = 'delivered'
            AND o.subtotal > COALESCE(o.loyalty_free_reward_amount, 0)
        )::INTEGER
      INTO v_completed_purchases, v_qualifying_purchases
      FROM public.orders o
      WHERE o.auth_user_id = v_uid
         OR (o.auth_user_id IS NULL AND LOWER(BTRIM(o.customer_email)) = v_auth_email);

      v_earned_rewards := FLOOR(v_qualifying_purchases / 5.0)::INTEGER;

      SELECT COUNT(*)::INTEGER
      INTO v_redeemed_rewards
      FROM public.loyalty_reward_redemptions lr
      JOIN public.orders o ON o.id = lr.order_id
      WHERE lr.customer_key = v_auth_email
        AND o.status <> 'cancelled';

      v_available_rewards := GREATEST(0, v_earned_rewards - v_redeemed_rewards);
      v_loyalty_eligible := (v_completed_purchases >= 3);

      IF COALESCE(p_redeem_free_reward, FALSE) THEN
        IF v_available_rewards < 1 THEN
          RAISE EXCEPTION 'Your free product reward is not available or has already been redeemed.';
        END IF;
        SELECT MIN(gs)::INTEGER INTO v_milestone_to_redeem
        FROM generate_series(1, v_earned_rewards) gs
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.loyalty_reward_redemptions lr
          JOIN public.orders o ON o.id = lr.order_id
          WHERE lr.customer_key = v_auth_email
            AND lr.milestone_number = gs
            AND o.status <> 'cancelled'
        );
        IF v_milestone_to_redeem IS NULL THEN
          RAISE EXCEPTION 'Your free product reward has already been redeemed.';
        END IF;
        -- Clean up any stale cancelled redemption row on this milestone if present
        DELETE FROM public.loyalty_reward_redemptions lr
        USING public.orders o
        WHERE lr.order_id = o.id
          AND lr.customer_key = v_auth_email
          AND lr.milestone_number = v_milestone_to_redeem
          AND o.status = 'cancelled';

        v_free_reward_amount := LEAST(v_subtotal, ROUND(v_min_unit_price, 2));
      END IF;
    ELSIF COALESCE(p_redeem_free_reward, FALSE) THEN
      RAISE EXCEPTION 'Sign in with the matching account email to redeem your free product reward.';
    END IF;
  ELSIF COALESCE(p_redeem_free_reward, FALSE) THEN
    RAISE EXCEPTION 'Sign in to your account to redeem your free product reward.';
  END IF;

  -- Option 2: One-time 10% Email Discount lookup (only when submitted & unused)
  v_email_submitted := EXISTS (
    SELECT 1 FROM public.newsletter_subscribers ns
    WHERE LOWER(BTRIM(ns.email)) = v_clean_email
  );
  v_email_already_used := EXISTS (
    SELECT 1 FROM public.orders o
    WHERE LOWER(BTRIM(o.customer_email)) = v_clean_email
      AND o.status <> 'cancelled'
      AND o.email_discount_amount > 0
  );

  v_discountable_subtotal := GREATEST(0, v_subtotal - v_free_reward_amount);

  IF v_loyalty_eligible AND v_discountable_subtotal > 0 THEN
    -- Option 1 applies 10%; never stacks with Option 2
    v_loyalty_discount_amount := ROUND(v_discountable_subtotal * 0.10, 2);
  ELSIF v_email_submitted AND NOT v_email_already_used AND v_discountable_subtotal > 0 THEN
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
      v_email_discount_amount := ROUND(v_discountable_subtotal * (LEAST(10.00, v_email_rule.discount_percent) / 100.0), 2);
    END IF;
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

    v_promo_discount_amount := ROUND(
      GREATEST(v_discountable_subtotal - v_loyalty_discount_amount - v_email_discount_amount, 0)
      * (v_promo_rule.discount_percent / 100.0),
      2
    );
  END IF;

  v_discount_total := LEAST(
    v_subtotal,
    ROUND(v_free_reward_amount + v_loyalty_discount_amount + v_email_discount_amount + v_promo_discount_amount, 2)
  );
  v_shipping := public.studio_shipping_cost(v_subtotal);
  v_final_total := GREATEST(0, ROUND(v_subtotal - v_discount_total + v_shipping, 2));

  -- Upsert customer by email (preserving auth_user_id link if present)
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

  IF v_order_auth_uid IS NOT NULL THEN
    UPDATE public.customers
    SET auth_user_id = COALESCE(auth_user_id, v_order_auth_uid)
    WHERE id = v_customer_id
      AND NOT EXISTS (
        SELECT 1 FROM public.customers other
        WHERE other.auth_user_id = v_order_auth_uid AND other.id <> v_customer_id
      );
  END IF;

  v_order_ref := 'TWS-' || TO_CHAR(NOW(), 'YYYY') || '-' || UPPER(LEFT(REPLACE(gen_random_uuid()::TEXT, '-', ''), 12));

  INSERT INTO public.orders (
    order_reference,
    customer_id,
    auth_user_id,
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
    loyalty_discount_amount,
    loyalty_free_reward_amount,
    loyalty_milestone_redeemed,
    promo_discount_amount,
    discount_total,
    applied_promo_code,
    total_amount,
    status
  )
  VALUES (
    v_order_ref,
    v_customer_id,
    v_order_auth_uid,
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
    v_loyalty_discount_amount,
    v_free_reward_amount,
    v_milestone_to_redeem,
    v_promo_discount_amount,
    v_discount_total,
    CASE WHEN v_promo_discount_amount > 0 THEN v_promo_rule.code ELSE NULL END,
    v_final_total,
    'pending'
  )
  RETURNING id INTO v_order_id;

  -- Record duplicate-proof loyalty milestone redemption
  IF v_milestone_to_redeem IS NOT NULL THEN
    INSERT INTO public.loyalty_reward_redemptions (
      customer_key,
      auth_user_id,
      milestone_number,
      order_id,
      reward_amount
    )
    VALUES (
      v_auth_email,
      v_order_auth_uid,
      v_milestone_to_redeem,
      v_order_id,
      v_free_reward_amount
    );
  END IF;

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
    'loyalty_discount_amount', v_loyalty_discount_amount,
    'loyalty_free_reward_amount', v_free_reward_amount,
    'promo_discount_amount', v_promo_discount_amount,
    'discount_total', v_discount_total,
    'applied_promo_code', CASE WHEN v_promo_discount_amount > 0 THEN v_promo_rule.code ELSE NULL END,
    'total_amount', v_final_total,
    'status', 'pending',
    'tracking', public.order_tracking_stage('pending'),
    'created_at', NOW(),
    'items', v_order_items_out
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_cod_order_core(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,BOOLEAN) FROM PUBLIC;

-- 9-arg overload
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
BEGIN
  RETURN public.create_cod_order_core(
    p_full_name, p_email, p_phone, p_governorate, p_city,
    p_address, p_notes, p_items, p_promo_code, FALSE
  );
END;
$$;

-- 10-arg overload
CREATE OR REPLACE FUNCTION public.create_cod_order(
  p_full_name TEXT, p_email TEXT, p_phone TEXT, p_governorate TEXT, p_city TEXT,
  p_address TEXT, p_notes TEXT, p_items JSONB, p_promo_code TEXT, p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_payment_method IS DISTINCT FROM 'COD' THEN
    RAISE EXCEPTION 'Cash on delivery is the only supported payment method.';
  END IF;
  RETURN public.create_cod_order(
    p_full_name, p_email, p_phone, p_governorate, p_city,
    p_address, p_notes, p_items, p_promo_code
  );
END;
$$;

-- 12-arg idempotent overload (with loyalty free-product redemption support)
CREATE OR REPLACE FUNCTION public.create_cod_order(
  p_full_name TEXT, p_email TEXT, p_phone TEXT, p_governorate TEXT, p_city TEXT,
  p_address TEXT, p_notes TEXT, p_items JSONB, p_promo_code TEXT, p_payment_method TEXT,
  p_checkout_request_id UUID, p_redeem_free_reward BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reference TEXT;
  v_email TEXT;
  v_receipt JSONB;
BEGIN
  IF p_payment_method IS DISTINCT FROM 'COD' THEN
    RAISE EXCEPTION 'Cash on delivery is the only supported payment method.';
  END IF;
  IF p_checkout_request_id IS NULL THEN
    RAISE EXCEPTION 'A checkout request ID is required.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_checkout_request_id::TEXT, 0));
  SELECT order_reference, customer_email INTO v_reference, v_email
  FROM public.orders WHERE checkout_request_id = p_checkout_request_id;

  IF FOUND THEN
    IF v_email IS DISTINCT FROM LOWER(BTRIM(p_email)) THEN
      RAISE EXCEPTION 'This checkout request cannot be reused with that email.';
    END IF;
    RETURN public.get_order_confirmation(v_reference, v_email);
  END IF;

  v_receipt := public.create_cod_order_core(
    p_full_name, p_email, p_phone, p_governorate,
    p_city, p_address, p_notes, p_items, p_promo_code, COALESCE(p_redeem_free_reward, FALSE)
  );
  UPDATE public.orders SET checkout_request_id = p_checkout_request_id
  WHERE id = (v_receipt->>'order_id')::UUID;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not save the checkout request ID.';
  END IF;
  RETURN v_receipt;
END;
$$;

-- 11-arg idempotent overload delegates cleanly to 12-arg
CREATE OR REPLACE FUNCTION public.create_cod_order(
  p_full_name TEXT, p_email TEXT, p_phone TEXT, p_governorate TEXT, p_city TEXT,
  p_address TEXT, p_notes TEXT, p_items JSONB, p_promo_code TEXT, p_payment_method TEXT,
  p_checkout_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.create_cod_order(
    p_full_name, p_email, p_phone, p_governorate,
    p_city, p_address, p_notes, p_items, p_promo_code, p_payment_method,
    p_checkout_request_id, FALSE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,UUID,BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,UUID,BOOLEAN) TO anon, authenticated, service_role;

-- ——— 9. Order Confirmation RPC (includes live tracking stage & loyalty breakdown) ———
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
  WHERE UPPER(BTRIM(order_reference)) = UPPER(BTRIM(COALESCE(p_order_reference, '')))
    AND LOWER(BTRIM(customer_email)) = LOWER(BTRIM(COALESCE(p_email, '')))
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
    'loyalty_discount_amount', v_order.loyalty_discount_amount,
    'loyalty_free_reward_amount', v_order.loyalty_free_reward_amount,
    'promo_discount_amount', v_order.promo_discount_amount,
    'discount_total', v_order.discount_total,
    'applied_promo_code', v_order.applied_promo_code,
    'total_amount', v_order.total_amount,
    'status', v_order.status,
    'tracking', public.order_tracking_stage(v_order.status),
    'created_at', v_order.created_at,
    'updated_at', v_order.updated_at,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_confirmation(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_confirmation(TEXT, TEXT) TO anon, authenticated, service_role;

-- ——— 10. Admin Order Status Update (supports 'ready' + restores loyalty redemption on cancel) ———
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  IF p_new_status NOT IN ('pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid order status.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- Restore stock and release any loyalty reward reservation when cancelling an active order
  IF v_order.status <> 'cancelled' AND p_new_status = 'cancelled' THEN
    FOR v_item IN SELECT variant_id, quantity FROM public.order_items WHERE order_id = p_order_id AND variant_id IS NOT NULL
    LOOP
      UPDATE public.product_variants
      SET stock_quantity = stock_quantity + v_item.quantity
      WHERE id = v_item.variant_id;
    END LOOP;

    DELETE FROM public.loyalty_reward_redemptions
    WHERE order_id = p_order_id;

  -- Deduct stock and re-lock loyalty milestone if un-cancelling an order
  ELSIF v_order.status = 'cancelled' AND p_new_status <> 'cancelled' THEN
    FOR v_item IN SELECT variant_id, quantity FROM public.order_items WHERE order_id = p_order_id AND variant_id IS NOT NULL
    LOOP
      UPDATE public.product_variants
      SET stock_quantity = stock_quantity - v_item.quantity
      WHERE id = v_item.variant_id AND stock_quantity >= v_item.quantity;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient stock to reactivate order.';
      END IF;
    END LOOP;

    IF v_order.loyalty_milestone_redeemed IS NOT NULL THEN
      INSERT INTO public.loyalty_reward_redemptions (
        customer_key,
        auth_user_id,
        milestone_number,
        order_id,
        reward_amount
      )
      VALUES (
        LOWER(BTRIM(v_order.customer_email)),
        v_order.auth_user_id,
        v_order.loyalty_milestone_redeemed,
        v_order.id,
        v_order.loyalty_free_reward_amount
      );
    END IF;
  END IF;

  UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
