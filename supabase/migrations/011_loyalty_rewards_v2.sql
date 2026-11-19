-- =========================================================
-- THREE WAYS STUDIOS — 011_loyalty_rewards_v2.sql
--
-- Corrects and completes the loyalty programme introduced by
-- 010_account_loyalty_discounts.sql. 010 is LEFT UNTOUCHED because it is
-- already applied in the live project; this migration replaces its checkout,
-- account and admin-status functions with corrected definitions.
--
-- REWARD MODEL — Option 1: the reward applies to the SAME order that reaches
-- the milestone. It is never deferred to a later order.
--
--   eligible order 1 ................ regular price
--   eligible order 2 ................ regular price
--   eligible order 3 ................ 10% OFF, applied to order 3
--   eligible order 4 ................ 20% OFF, applied to order 4
--   eligible order 5 ................ exactly ONE eligible pair of pants free
--                                     (100% off that unit only, same order)
--   ...the ladder repeats every five eligible orders.
--
-- The sequence number of an order is fixed when the order is created:
--   order_seq = delivered_eligible + in_flight_eligible + 1
-- so the third checkout of a customer with two completed orders is order 3 and
-- automatically receives 10% off. Cancelling an order releases its slot, so the
-- next checkout reuses the freed milestone.
--
-- Reward lifecycle (public.loyalty_rewards):
--   reserved  — attached to an order at checkout, order not yet delivered
--   redeemed  — the attached order was delivered; the discount is final
--   available — granted but not attached (only when the 5th-order bag has no
--               eligible pants, so the pair could not be discounted yet)
--   released  — the attached order was cancelled; the milestone is reopened
--
-- Security model:
--   * Every loyalty read/write is keyed by auth.uid(); there is no email
--     fallback anywhere in the loyalty path.
--   * Rewards are written only by SECURITY DEFINER RPCs. Customers hold
--     SELECT-only RLS access to their own rows.
--   * Partial unique indexes make duplicate reservations impossible:
--       (auth_user_id, milestone_seq) WHERE status <> 'released'
--       (order_id)                   WHERE order_id IS NOT NULL AND status <> 'released'
--   * Checkout quotes and order creation both derive the benefit server-side
--     from the authenticated user; the client never sends a reward choice.
--   * The free-pants reward discounts exactly one unit of one eligible pants
--     product from the submitted bag. It can never discount a non-pants item,
--     more than one pair, or the whole basket.
--
-- Safe & additive: existing orders keep their historical totals, 010 objects
-- remain in place, and the migration is idempotent.
-- =========================================================

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.get_customer_account_overview()') IS NULL
     OR to_regprocedure('public.create_cod_order_core(text,text,text,text,text,text,text,jsonb,text,boolean)') IS NULL
     OR to_regclass('public.loyalty_reward_redemptions') IS NULL THEN
    RAISE EXCEPTION 'Apply 010_account_loyalty_discounts.sql before installing 011_loyalty_rewards_v2.sql.';
  END IF;
END;
$$;

-- ——— 1. Order columns describing the reward applied to that order ———
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_seq INTEGER,
  ADD COLUMN IF NOT EXISTS loyalty_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_free_reward_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loyalty_free_reward_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loyalty_free_reward_product_name TEXT,
  -- TRUE when this order was placed at milestone 5 without an eligible pair of
  -- pants. It is a normal purchase but does NOT consume the milestone: the
  -- customer stays at milestone 5 until a qualifying order redeems the pair.
  ADD COLUMN IF NOT EXISTS loyalty_skipped BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_loyalty_discount_percent_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_loyalty_discount_percent_check
      CHECK (loyalty_discount_percent >= 0 AND loyalty_discount_percent <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_loyalty_seq_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_loyalty_seq_check CHECK (loyalty_seq IS NULL OR loyalty_seq >= 1);
  END IF;
END;
$$;

-- ——— 2. Same-order reward ledger, owned by the authenticated user id ———
-- The table is new in this migration. If an earlier, never-applied draft of
-- 011 created the superseded shape, recreate it cleanly.
DO $$
BEGIN
  IF to_regclass('public.loyalty_rewards') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'loyalty_rewards'
         AND column_name = 'milestone_seq'
     ) THEN
    DROP TABLE public.loyalty_rewards;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_seq INTEGER NOT NULL CHECK (milestone_seq >= 1),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('percent_10', 'percent_20', 'free_pants')),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'redeemed', 'released')),
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  free_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  free_product_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_owner
  ON public.loyalty_rewards (auth_user_id, status);

-- One live reward per milestone slot and per order; a released slot can be won
-- again by a later qualifying order.
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_rewards_active_seq
  ON public.loyalty_rewards (auth_user_id, milestone_seq)
  WHERE status <> 'released';

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_rewards_active_order
  ON public.loyalty_rewards (order_id)
  WHERE order_id IS NOT NULL AND status <> 'released';

DROP TRIGGER IF EXISTS trg_loyalty_rewards_updated_at ON public.loyalty_rewards;
CREATE TRIGGER trg_loyalty_rewards_updated_at
  BEFORE UPDATE ON public.loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Customers read own loyalty rewards"
  ON public.loyalty_rewards FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage loyalty rewards" ON public.loyalty_rewards;
CREATE POLICY "Admins manage loyalty rewards"
  ON public.loyalty_rewards FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Customers may read their own rows, but only the SECURITY DEFINER RPCs write.
REVOKE ALL ON TABLE public.loyalty_rewards FROM anon, authenticated;
GRANT SELECT ON TABLE public.loyalty_rewards TO authenticated;
GRANT ALL ON TABLE public.loyalty_rewards TO service_role;

-- ——— 3. Customer-scoped read policies for the account data ———
-- Additive SELECT-only policies; admin policies from 002/008 are untouched.
DROP POLICY IF EXISTS "Customers read own orders" ON public.orders;
CREATE POLICY "Customers read own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers read own order items" ON public.order_items;
CREATE POLICY "Customers read own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.auth_user_id = auth.uid()
    )
  );

GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;

-- ——— 4. Reward catalogue helpers (pure, no side effects) ———
CREATE OR REPLACE FUNCTION public.loyalty_reward_type_for_seq(p_seq INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_seq IS NULL OR p_seq < 1 THEN NULL
    WHEN p_seq % 5 = 0 THEN 'free_pants'
    WHEN p_seq % 5 = 3 THEN 'percent_10'
    WHEN p_seq % 5 = 4 THEN 'percent_20'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_reward_label(p_type TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_type
    WHEN 'percent_10' THEN '10% off this order'
    WHEN 'percent_20' THEN '20% off this order'
    WHEN 'free_pants' THEN 'One free pair of pants'
    ELSE NULL
  END;
$$;

-- A "pants" product is identified by its merchandising category, slug or name.
-- Everything else (tees, hoodies, accessories) is never eligible to be free.
CREATE OR REPLACE FUNCTION public.loyalty_is_pants(
  p_category TEXT,
  p_name TEXT,
  p_slug TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(p_category, '') ~* '(pant|trouser|denim)'
      OR COALESCE(p_slug, '') ~* '(pant|trouser|denim)'
      OR COALESCE(p_name, '') ~* '(pants|trouser|jeans|denim)';
$$;

-- Completed eligible orders: delivered only. Pending/confirmed/processing/
-- ready/shipped/cancelled never count, and an order whose goods were entirely
-- free (a redeemed free-pants reward) does not feed the ladder again.
CREATE OR REPLACE FUNCTION public.loyalty_qualifying_count(p_uid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT CASE
    WHEN p_uid IS NULL THEN 0
    ELSE (
      SELECT COUNT(*)::INTEGER
      FROM public.orders o
      WHERE o.auth_user_id = p_uid
        AND o.status = 'delivered'
        AND COALESCE(o.loyalty_skipped, FALSE) = FALSE
        AND (
          o.loyalty_seq IS NOT NULL
          OR o.subtotal > COALESCE(o.loyalty_free_reward_amount, 0)
        )
    )
  END;
$$;

-- In-flight eligible orders already occupy their milestone slot, so two
-- concurrent checkouts can never claim the same reward.
CREATE OR REPLACE FUNCTION public.loyalty_in_flight_count(p_uid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT CASE
    WHEN p_uid IS NULL THEN 0
    ELSE (
      SELECT COUNT(*)::INTEGER
      FROM public.orders o
      WHERE o.auth_user_id = p_uid
        AND o.status IN ('pending', 'confirmed', 'processing', 'ready', 'shipped')
        AND COALESCE(o.loyalty_skipped, FALSE) = FALSE
        AND (
          o.loyalty_seq IS NOT NULL
          OR o.subtotal > COALESCE(o.loyalty_free_reward_amount, 0)
        )
    )
  END;
$$;

-- The sequence number the customer's next order will take.
CREATE OR REPLACE FUNCTION public.loyalty_next_order_seq(p_uid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT CASE
    WHEN p_uid IS NULL THEN NULL
    ELSE public.loyalty_qualifying_count(p_uid) + public.loyalty_in_flight_count(p_uid) + 1
  END;
$$;

-- ——— 5. Read-only checkout benefit evaluation (used by quote + order) ———
-- Works out, for the authenticated customer, which reward belongs to the order
-- they are about to place, and which single pants unit that reward would free.
CREATE OR REPLACE FUNCTION public.loyalty_checkout_benefits(
  p_uid UUID,
  p_email TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_account_email TEXT;
  v_matched BOOLEAN := FALSE;
  v_qualifying INTEGER := 0;
  v_in_flight INTEGER := 0;
  v_seq INTEGER := NULL;
  v_milestone_type TEXT := NULL;
  v_free RECORD;
  v_free_available BOOLEAN := FALSE;
  v_free_seq INTEGER := NULL;
  v_free_reward_id UUID := NULL;
  v_free_source TEXT := NULL;
  v_free_item JSONB := NULL;
  v_free_amount NUMERIC(10, 2) := 0;
  v_percent NUMERIC(5, 2) := 0;
  v_free_count INTEGER := 0;
BEGIN
  IF p_uid IS NULL THEN
    RETURN jsonb_build_object(
      'account_matched', FALSE,
      'account_email', NULL,
      'qualifying_purchases', 0,
      'in_flight_purchases', 0,
      'order_seq', NULL,
      'milestone_reward_type', NULL,
      'percent', 0,
      'free_reward_available', FALSE,
      'free_reward_seq', NULL,
      'free_reward_id', NULL,
      'free_reward_source', NULL,
      'free_reward_item', NULL,
      'free_reward_amount', 0,
      'free_rewards_available', 0
    );
  END IF;

  SELECT LOWER(BTRIM(u.email))
  INTO v_account_email
  FROM auth.users u
  WHERE u.id = p_uid AND u.deleted_at IS NULL;

  v_matched := (
    NULLIF(BTRIM(COALESCE(v_account_email, '')), '') IS NOT NULL
    AND v_account_email = LOWER(BTRIM(COALESCE(p_email, '')))
  );

  v_qualifying := public.loyalty_qualifying_count(p_uid);
  v_in_flight := public.loyalty_in_flight_count(p_uid);
  v_seq := v_qualifying + v_in_flight + 1;
  v_milestone_type := public.loyalty_reward_type_for_seq(v_seq);

  IF v_matched THEN
    SELECT COUNT(*)::INTEGER
    INTO v_free_count
    FROM public.loyalty_rewards r
    WHERE r.auth_user_id = p_uid
      AND r.reward_type = 'free_pants'
      AND r.status = 'reserved';

    -- Strict same-order model: the pair is only ever offered on the milestone
    -- order itself. Nothing is ever applied to a later order.
    IF v_milestone_type = 'free_pants' THEN
      -- Exactly one unit of one eligible pants product, highest value first.
      SELECT
        pv.id AS variant_id,
        pv.product_id,
        p.name AS product_name,
        p.slug AS product_slug,
        p.price AS unit_price
      INTO v_free
      FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS it
      JOIN public.product_variants pv ON pv.id = NULLIF(it->>'variant_id', '')::UUID
      JOIN public.products p ON p.id = pv.product_id
      WHERE COALESCE((it->>'quantity')::INTEGER, 0) >= 1
        AND p.is_published = TRUE
        AND pv.is_active = TRUE
        AND public.loyalty_is_pants(p.category, p.name, p.slug)
      ORDER BY p.price DESC, pv.id
      LIMIT 1;

      IF FOUND THEN
        v_free_available := TRUE;
        v_free_amount := ROUND(v_free.unit_price, 2);
        v_free_item := jsonb_build_object(
          'variant_id', v_free.variant_id,
          'product_id', v_free.product_id,
          'product_name', v_free.product_name,
          'product_slug', v_free.product_slug,
          'unit_price', ROUND(v_free.unit_price, 2),
          'quantity', 1
        );
        v_free_seq := v_seq;
        v_free_source := 'milestone';
      END IF;
    END IF;

    -- Percentage rewards always belong to the milestone order itself.
    IF NOT v_free_available AND v_milestone_type IN ('percent_10', 'percent_20') THEN
      v_percent := CASE v_milestone_type WHEN 'percent_20' THEN 20 ELSE 10 END;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'account_matched', v_matched,
    'account_email', v_account_email,
    'qualifying_purchases', v_qualifying,
    'in_flight_purchases', v_in_flight,
    'order_seq', v_seq,
    'milestone_reward_type', v_milestone_type,
    'percent', v_percent,
    'free_reward_available', v_free_available,
    'free_reward_seq', v_free_seq,
    'free_reward_id', v_free_reward_id,
    'free_reward_source', v_free_source,
    'free_reward_item', v_free_item,
    'free_reward_amount', v_free_amount,
    'free_rewards_available', v_free_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.loyalty_qualifying_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loyalty_in_flight_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loyalty_next_order_seq(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loyalty_checkout_benefits(UUID, TEXT, JSONB) FROM PUBLIC;

-- ——— 6. Convert the 010 free-product ledger into audit rows ———
-- Historical milestones are NOT reissued: under the same-order model those
-- orders have already been placed and delivered at their historic price.
DO $$
BEGIN
  INSERT INTO public.loyalty_rewards (
    auth_user_id, milestone_seq, reward_type, order_id, status, discount_amount, created_at
  )
  SELECT
    lr.auth_user_id,
    lr.milestone_number * 5,
    'free_pants',
    lr.order_id,
    'redeemed',
    lr.reward_amount,
    lr.created_at
  FROM public.loyalty_reward_redemptions lr
  JOIN public.orders o ON o.id = lr.order_id
  WHERE lr.auth_user_id IS NOT NULL
    AND o.status <> 'cancelled'
  ON CONFLICT DO NOTHING;
END;
$$;

-- ——— 7. Authoritative server-side quote ———
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
  v_line_total NUMERIC(10, 2);
  v_items_out JSONB := '[]'::jsonb;
  v_stock_errors JSONB := '[]'::jsonb;
  v_valid BOOLEAN := TRUE;
  v_uid UUID;
  v_account_matched BOOLEAN := FALSE;
  v_clean_email TEXT;
  v_email_valid BOOLEAN := FALSE;
  v_loyalty JSONB;
  v_order_seq INTEGER := NULL;
  v_milestone_type TEXT := NULL;
  v_percent NUMERIC(5, 2) := 0;
  v_percent_amount NUMERIC(10, 2) := 0;
  v_free_reward_available BOOLEAN := FALSE;
  v_free_reward_applied BOOLEAN := FALSE;
  v_free_reward_amount NUMERIC(10, 2) := 0;
  v_free_reward_product_name TEXT := NULL;
  v_free_reward_variant_id UUID := NULL;
  v_free_reward_seq INTEGER := NULL;
  v_free_reward_source TEXT := NULL;
  v_free_rewards_available INTEGER := 0;
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
      'loyalty_reward_type', NULL,
      'loyalty_order_seq', NULL,
      'loyalty_rewards_available', 0,
      'both_discounts_eligible', FALSE,
      'free_reward_available', FALSE,
      'free_reward_applied', FALSE,
      'free_reward_amount', 0,
      'free_reward_product_name', NULL,
      'free_reward_variant_id', NULL,
      'free_reward_seq', NULL,
      'free_reward_source', NULL,
      'free_rewards_available', v_free_rewards_available,
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

  v_clean_email := LOWER(BTRIM(COALESCE(p_email, '')));

  -- Loyalty benefits: authenticated Supabase user id only, never an email lookup.
  v_uid := auth.uid();
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    v_loyalty := public.loyalty_checkout_benefits(v_uid, v_clean_email, p_items);
    v_account_matched := COALESCE((v_loyalty->>'account_matched')::BOOLEAN, FALSE);
    v_order_seq := NULLIF(v_loyalty->>'order_seq', '')::INTEGER;
    v_milestone_type := v_loyalty->>'milestone_reward_type';
    v_percent := COALESCE((v_loyalty->>'percent')::NUMERIC, 0);
    v_free_reward_available := COALESCE((v_loyalty->>'free_reward_available')::BOOLEAN, FALSE);
    v_free_rewards_available := COALESCE((v_loyalty->>'free_rewards_available')::INTEGER, 0);

    IF v_free_reward_available THEN
      v_free_reward_product_name := v_loyalty->'free_reward_item'->>'product_name';
      v_free_reward_variant_id := NULLIF(v_loyalty->'free_reward_item'->>'variant_id', '')::UUID;
      v_free_reward_amount := COALESCE((v_loyalty->>'free_reward_amount')::NUMERIC, 0);
      v_free_reward_seq := NULLIF(v_loyalty->>'free_reward_seq', '')::INTEGER;
      v_free_reward_source := v_loyalty->>'free_reward_source';

      -- Same-order model: the reward belongs to the order that reaches the
      -- milestone, so it is always applied to this order. p_redeem_free_reward
      -- stays in the signature for wire compatibility only.
      v_free_reward_applied := TRUE;
    END IF;
  END IF;

  v_discountable_subtotal := GREATEST(0, v_subtotal - v_free_reward_amount);

  IF v_free_reward_applied = FALSE AND v_percent > 0 AND v_discountable_subtotal > 0 THEN
    v_percent_amount := ROUND(v_discountable_subtotal * (v_percent / 100.0), 2);
  ELSE
    v_percent := 0;
  END IF;

  -- One-time 10% email discount. Its eligibility is evaluated even when a
  -- loyalty reward wins, so the customer sees an accurate "both available"
  -- message; it is only applied when no loyalty reward is on this order.
  v_email_valid := v_clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
  IF v_email_valid AND v_subtotal > 0
     AND (v_uid IS NULL OR v_account_matched) THEN
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

  -- Non-stacking: a loyalty reward on this order wins outright, so the email
  -- discount is reported as available but never also applied.
  IF v_email_eligible
     AND v_percent_amount = 0
     AND NOT v_free_reward_applied
     AND v_discountable_subtotal > 0 THEN
    v_email_discount_percent := LEAST(10.00, v_email_rule.discount_percent);
    v_email_discount_amount := ROUND(v_discountable_subtotal * (v_email_discount_percent / 100.0), 2);
  END IF;

  v_both_eligible := (
    (v_percent_amount > 0 OR v_free_reward_applied)
    AND v_email_eligible
  );

  -- Optional promo code (existing behaviour: applies after loyalty discounts).
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
        GREATEST(v_discountable_subtotal - v_percent_amount - v_email_discount_amount, 0)
        * (v_promo_discount_percent / 100.0),
        2
      );
    END IF;
  END IF;

  v_discount_total := LEAST(
    v_subtotal,
    ROUND(
      CASE WHEN v_free_reward_applied THEN v_free_reward_amount ELSE 0 END
      + v_percent_amount + v_email_discount_amount + v_promo_discount_amount,
      2
    )
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
    'loyalty_discount_eligible', (v_percent > 0 OR v_free_reward_applied),
    'loyalty_discount_applied', v_percent_amount > 0,
    'loyalty_discount_percent', v_percent,
    'loyalty_discount_amount', v_percent_amount,
    'loyalty_reward_type', v_milestone_type,
    'loyalty_order_seq', v_order_seq,
    'loyalty_rewards_available', CASE WHEN v_percent > 0 OR v_free_reward_applied THEN 1 ELSE 0 END,
    'both_discounts_eligible', v_both_eligible,
    'free_reward_available', v_free_reward_available,
    'free_reward_applied', v_free_reward_applied,
    'free_reward_amount', CASE WHEN v_free_reward_applied THEN v_free_reward_amount ELSE 0 END,
    'free_reward_product_name', CASE WHEN v_free_reward_applied THEN v_free_reward_product_name ELSE NULL END,
    'free_reward_variant_id', CASE WHEN v_free_reward_applied THEN v_free_reward_variant_id ELSE NULL END,
    'free_reward_seq', v_free_reward_seq,
    'free_reward_source', v_free_reward_source,
    'free_rewards_available', v_free_rewards_available,
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

-- ——— 8. Authoritative order creation with same-order reward reservation ———
-- p_redeem_free_reward is accepted for wire compatibility but no longer needed:
-- the reward for a milestone order is applied automatically server-side.
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
  v_order_auth_uid UUID := NULL;
  v_account_email TEXT := NULL;
  v_item JSONB;
  v_variant RECORD;
  v_qty INTEGER;
  v_subtotal NUMERIC(10, 2) := 0;
  v_line_total NUMERIC(10, 2);
  v_order_items_out JSONB := '[]'::jsonb;

  v_loyalty JSONB := NULL;
  v_account_matched BOOLEAN := FALSE;
  v_order_seq INTEGER := NULL;
  v_milestone_type TEXT := NULL;

  v_percent NUMERIC(5, 2) := 0;
  v_percent_amount NUMERIC(10, 2) := 0;

  v_free_reward_available BOOLEAN := FALSE;
  v_free_reward_amount NUMERIC(10, 2) := 0;
  v_free_reward_product_id UUID := NULL;
  v_free_reward_variant_id UUID := NULL;
  v_free_reward_product_name TEXT := NULL;
  v_free_reward_seq INTEGER := NULL;
  v_free_reward_id UUID := NULL;
  v_free_reward_source TEXT := NULL;

  v_email_submitted BOOLEAN := FALSE;
  v_email_already_used BOOLEAN := FALSE;
  v_email_allowed BOOLEAN := TRUE;
  v_email_rule public.discount_rules%ROWTYPE;
  v_email_discount_amount NUMERIC(10, 2) := 0;
  v_email_discount_percent NUMERIC(5, 2) := 0;
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

  v_uid := auth.uid();
  IF v_uid IS NOT NULL AND NOT public.is_admin() THEN
    v_order_auth_uid := v_uid;
    SELECT LOWER(BTRIM(u.email)) INTO v_account_email
    FROM auth.users u WHERE u.id = v_uid AND u.deleted_at IS NULL;
  END IF;

  -- Serialize milestone assignment per authenticated customer, and discount use
  -- per contact email (legacy guarantee).
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tws-loyalty:' || COALESCE(v_order_auth_uid::TEXT, 'guest'), 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tws-cust:' || v_clean_email, 0)
  );

  -- Lock variants in deterministic order to avoid concurrent overselling.
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

  -- Loyalty benefits are re-derived here; the client's quote is never trusted.
  IF v_order_auth_uid IS NOT NULL THEN
    v_loyalty := public.loyalty_checkout_benefits(v_order_auth_uid, v_clean_email, p_items);
    v_account_matched := COALESCE((v_loyalty->>'account_matched')::BOOLEAN, FALSE);
    v_order_seq := NULLIF(v_loyalty->>'order_seq', '')::INTEGER;
    v_milestone_type := v_loyalty->>'milestone_reward_type';
    v_percent := COALESCE((v_loyalty->>'percent')::NUMERIC, 0);
    v_free_reward_available := COALESCE((v_loyalty->>'free_reward_available')::BOOLEAN, FALSE);
    v_free_reward_seq := NULLIF(v_loyalty->>'free_reward_seq', '')::INTEGER;
    v_free_reward_id := NULLIF(v_loyalty->>'free_reward_id', '')::UUID;
    v_free_reward_source := v_loyalty->>'free_reward_source';
    v_email_allowed := v_account_matched;

    IF v_free_reward_available THEN
      v_free_reward_amount := COALESCE((v_loyalty->>'free_reward_amount')::NUMERIC, 0);
      v_free_reward_product_id := NULLIF(v_loyalty->'free_reward_item'->>'product_id', '')::UUID;
      v_free_reward_variant_id := NULLIF(v_loyalty->'free_reward_item'->>'variant_id', '')::UUID;
      v_free_reward_product_name := v_loyalty->'free_reward_item'->>'product_name';
    END IF;

    IF v_free_reward_amount <= 0 OR v_free_reward_product_id IS NULL OR v_free_reward_seq IS NULL THEN
      v_free_reward_amount := 0;
      v_free_reward_product_id := NULL;
      v_free_reward_variant_id := NULL;
      v_free_reward_product_name := NULL;
    END IF;
  END IF;

  v_discountable_subtotal := GREATEST(0, v_subtotal - v_free_reward_amount);

  -- One loyalty reward per order: free pants excludes a percentage reward.
  IF v_order_auth_uid IS NULL OR v_free_reward_amount > 0 THEN
    v_percent := 0;
  END IF;

  IF v_percent > 0 AND v_discountable_subtotal > 0 THEN
    v_percent_amount := ROUND(v_discountable_subtotal * (v_percent / 100.0), 2);
  ELSE
    v_percent := 0;
  END IF;

  -- One-time 10% email discount (never stacks with a loyalty reward).
  IF v_email_allowed AND v_percent_amount = 0 AND v_free_reward_amount = 0 AND v_subtotal > 0 THEN
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
      LIMIT 1
      FOR UPDATE;

      IF FOUND THEN
        v_email_discount_percent := LEAST(10.00, v_email_rule.discount_percent);
        v_email_discount_amount := ROUND(v_discountable_subtotal * (v_email_discount_percent / 100.0), 2);
      END IF;
    END IF;
  END IF;

  -- Optional promo code (existing behaviour: applies after loyalty discounts).
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
      GREATEST(v_discountable_subtotal - v_percent_amount - v_email_discount_amount, 0)
      * (v_promo_rule.discount_percent / 100.0),
      2
    );
  END IF;

  v_discount_total := LEAST(
    v_subtotal,
    ROUND(v_free_reward_amount + v_percent_amount + v_email_discount_amount + v_promo_discount_amount, 2)
  );

  v_shipping := public.studio_shipping_cost(v_subtotal);
  v_final_total := GREATEST(0, ROUND(v_subtotal - v_discount_total + v_shipping, 2));

  -- Upsert customer by email (preserving auth_user_id link if present).
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
    loyalty_discount_percent,
    loyalty_free_reward_amount,
    loyalty_free_reward_product_id,
    loyalty_free_reward_variant_id,
    loyalty_free_reward_product_name,
    loyalty_milestone_redeemed,
    loyalty_seq,
    loyalty_skipped,
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
    v_percent_amount,
    CASE WHEN v_percent_amount > 0 THEN v_percent ELSE 0 END,
    v_free_reward_amount,
    v_free_reward_product_id,
    v_free_reward_variant_id,
    v_free_reward_product_name,
    CASE WHEN v_free_reward_amount > 0 THEN v_free_reward_seq ELSE NULL END,
    CASE
      WHEN v_order_auth_uid IS NOT NULL
        AND NOT (v_milestone_type = 'free_pants' AND v_free_reward_amount = 0)
        THEN v_order_seq
      ELSE NULL
    END,
    -- COALESCE: a NULL milestone type must mean "not skipped", never NULL.
    COALESCE(
      v_order_auth_uid IS NOT NULL
        AND v_milestone_type = 'free_pants'
        AND COALESCE(v_free_reward_amount, 0) = 0,
      FALSE
    ),
    v_promo_discount_amount,
    v_discount_total,
    CASE WHEN v_promo_discount_amount > 0 THEN v_promo_rule.code ELSE NULL END,
    v_final_total,
    'pending'
  )
  RETURNING id INTO v_order_id;

  -- Reserve the reward for THIS order. Partial unique indexes on
  -- (auth_user_id, milestone_seq) and (order_id) reject duplicate reservations.
  IF v_order_auth_uid IS NOT NULL AND v_account_matched THEN
    IF v_free_reward_amount > 0 THEN
      INSERT INTO public.loyalty_rewards (
        auth_user_id, milestone_seq, reward_type, order_id, status,
        discount_amount, free_variant_id, free_product_name
      )
      VALUES (
        v_order_auth_uid, v_free_reward_seq, 'free_pants', v_order_id, 'reserved',
        v_free_reward_amount, v_free_reward_variant_id, v_free_reward_product_name
      );
    ELSIF v_percent_amount > 0 THEN
      INSERT INTO public.loyalty_rewards (
        auth_user_id, milestone_seq, reward_type, order_id, status, discount_amount
      )
      VALUES (
        v_order_auth_uid, v_order_seq, v_milestone_type, v_order_id, 'reserved', v_percent_amount
      );
    ELSIF v_milestone_type = 'free_pants' THEN
      -- No eligible pair in the bag: this is an ordinary order. The milestone is
      -- NOT consumed, so the customer stays at milestone 5 and the free pair
      -- remains available indefinitely until an order actually redeems it.
      NULL;
    END IF;
  END IF;

  -- Create order items & decrement inventory.
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

  -- Log discount usage & increment counters.
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
    'loyalty_discount_amount', v_percent_amount,
    'loyalty_discount_percent', CASE WHEN v_percent_amount > 0 THEN v_percent ELSE 0 END,
    'loyalty_reward_type', CASE
      WHEN v_free_reward_amount > 0 THEN 'free_pants'
      WHEN v_percent_amount > 0 THEN v_milestone_type
      ELSE NULL END,
    'loyalty_order_seq', v_order_seq,
    'loyalty_free_reward_amount', v_free_reward_amount,
    'loyalty_free_reward_product_name', v_free_reward_product_name,
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

-- ——— 9. Order confirmation includes the corrected reward breakdown ———
CREATE OR REPLACE FUNCTION public.get_order_confirmation(
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
  v_order public.orders%ROWTYPE;
  v_items JSONB;
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_order_reference, '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(p_email, '')), '') IS NULL THEN
    RETURN NULL;
  END IF;

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
    'loyalty_discount_amount', v_order.loyalty_discount_amount,
    'loyalty_discount_percent', v_order.loyalty_discount_percent,
    'loyalty_reward_type', public.loyalty_reward_type_for_seq(v_order.loyalty_seq),
    'loyalty_order_seq', v_order.loyalty_seq,
    'loyalty_free_reward_amount', v_order.loyalty_free_reward_amount,
    'loyalty_free_reward_product_name', v_order.loyalty_free_reward_product_name,
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

-- ——— 10. Account overview: progress, milestones and applied rewards ———
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
  v_in_flight INTEGER := 0;
  v_progress_in_cycle INTEGER := 0;
  v_purchases_remaining INTEGER := 5;
  v_cycle_base INTEGER := 0;

  v_rewards JSONB := '[]'::jsonb;
  v_history JSONB := '[]'::jsonb;
  v_milestones JSONB := '[]'::jsonb;
  v_earned_rewards INTEGER := 0;
  v_redeemed_rewards INTEGER := 0;
  v_available_free_pants INTEGER := 0;
  v_available_percent INTEGER := 0;

  v_next_seq INTEGER := NULL;
  v_next_type TEXT := NULL;
  v_next_remaining INTEGER := NULL;

  v_email_submitted BOOLEAN := FALSE;
  v_email_discount_used BOOLEAN := FALSE;
  v_email_discount_eligible BOOLEAN := FALSE;
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
  ORDER BY c.updated_at DESC
  LIMIT 1;

  v_has_customer := FOUND;

  v_name := COALESCE(
    NULLIF(BTRIM(COALESCE(v_customer.full_name, '')), ''),
    NULLIF(BTRIM(COALESCE(v_user.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(BTRIM(COALESCE(v_user.raw_user_meta_data->>'name', '')), ''),
    ''
  );

  -- Only delivered orders attached to this authenticated user id count.
  SELECT
    COUNT(*) FILTER (WHERE o.status = 'delivered')::INTEGER,
    COUNT(*) FILTER (
      WHERE o.status = 'delivered'
        AND COALESCE(o.loyalty_skipped, FALSE) = FALSE
        AND (
          o.loyalty_seq IS NOT NULL
          OR o.subtotal > COALESCE(o.loyalty_free_reward_amount, 0)
        )
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE o.status IN ('pending', 'confirmed', 'processing', 'ready', 'shipped')
        AND COALESCE(o.loyalty_skipped, FALSE) = FALSE
        AND (
          o.loyalty_seq IS NOT NULL
          OR o.subtotal > COALESCE(o.loyalty_free_reward_amount, 0)
        )
    )::INTEGER
  INTO v_completed_purchases, v_qualifying_purchases, v_in_flight
  FROM public.orders o
  WHERE o.auth_user_id = v_uid;

  v_progress_in_cycle := MOD(v_qualifying_purchases, 5);
  v_purchases_remaining := 5 - v_progress_in_cycle;
  v_cycle_base := v_qualifying_purchases - v_progress_in_cycle;

  SELECT
    COUNT(*) FILTER (WHERE r.status <> 'released')::INTEGER,
    COUNT(*) FILTER (WHERE r.status = 'redeemed')::INTEGER,
    -- An unredeemed pair waits at milestone 5 with no expiry whatsoever.
    COUNT(*) FILTER (
      WHERE r.reward_type = 'free_pants' AND r.status = 'reserved'
    )::INTEGER,
    COUNT(*) FILTER (
      WHERE r.status = 'reserved' AND r.reward_type IN ('percent_10', 'percent_20')
    )::INTEGER
  INTO v_earned_rewards, v_redeemed_rewards, v_available_free_pants, v_available_percent
  FROM public.loyalty_rewards r
  WHERE r.auth_user_id = v_uid;

  -- Every reward applied to (or waiting for) an order of this customer.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'reward_type', r.reward_type,
    'label', public.loyalty_reward_label(r.reward_type),
    'status', r.status,
    'milestone_seq', r.milestone_seq,
    'cycle_number', ((r.milestone_seq - 1) / 5) + 1,
    'milestone_order_in_cycle', CASE WHEN r.milestone_seq % 5 = 0 THEN 5 ELSE r.milestone_seq % 5 END,
    'order_reference', o.order_reference,
    'order_status', o.status,
    'discount_amount', r.discount_amount,
    'free_product_name', r.free_product_name,
    'applied_at', r.created_at
  ) ORDER BY r.milestone_seq DESC, r.created_at DESC), '[]'::jsonb)
  INTO v_rewards
  FROM public.loyalty_rewards r
  LEFT JOIN public.orders o ON o.id = r.order_id
  WHERE r.auth_user_id = v_uid AND r.status <> 'released';

  -- Redemptions finalised by delivery.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'reward_type', r.reward_type,
    'label', public.loyalty_reward_label(r.reward_type),
    'milestone_seq', r.milestone_seq,
    'order_reference', o.order_reference,
    'redeemed_at', r.updated_at,
    'discount_amount', r.discount_amount,
    'free_product_name', r.free_product_name
  ) ORDER BY r.milestone_seq, r.updated_at), '[]'::jsonb)
  INTO v_history
  FROM public.loyalty_rewards r
  LEFT JOIN public.orders o ON o.id = r.order_id
  WHERE r.auth_user_id = v_uid AND r.status = 'redeemed';

  -- The five milestones of the current cycle, with their real state.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'seq', s.slot_seq,
    'order_in_cycle', s.slot_seq - v_cycle_base,
    'reward_type', public.loyalty_reward_type_for_seq(s.slot_seq),
    'label', public.loyalty_reward_label(public.loyalty_reward_type_for_seq(s.slot_seq)),
    'state', CASE
      WHEN r.status = 'redeemed' THEN 'rewarded'
      WHEN r.status = 'reserved' THEN 'applied'
      WHEN s.slot_seq <= v_qualifying_purchases THEN 'completed'
      -- Milestone 5 stays claimable indefinitely: "next" until a pair is redeemed.
      WHEN s.slot_seq = v_qualifying_purchases + 1 THEN 'next'
      ELSE 'upcoming'
    END,
    'order_reference', o.order_reference,
    'discount_amount', COALESCE(r.discount_amount, 0),
    'free_product_name', r.free_product_name
  ) ORDER BY s.slot_seq), '[]'::jsonb)
  INTO v_milestones
  FROM (
    SELECT v_cycle_base + gs AS slot_seq
    FROM generate_series(1, 5) AS gs
  ) s
  LEFT JOIN public.loyalty_rewards r
    ON r.auth_user_id = v_uid
   AND r.milestone_seq = s.slot_seq
   AND r.status <> 'released'
  LEFT JOIN public.orders o ON o.id = r.order_id;

  -- The milestone the customer's next checkout will take.
  v_next_seq := v_qualifying_purchases + v_in_flight + 1;
  v_next_type := public.loyalty_reward_type_for_seq(v_next_seq);
  v_next_remaining := GREATEST(0, v_next_seq - v_qualifying_purchases);

  v_email_submitted := EXISTS (
    SELECT 1 FROM public.newsletter_subscribers ns
    WHERE LOWER(BTRIM(ns.email)) = v_email
  );

  v_email_discount_used := EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.auth_user_id = v_uid
      AND o.status <> 'cancelled'
      AND o.email_discount_amount > 0
  );

  v_email_discount_eligible := (
    v_email_submitted
    AND NOT v_email_discount_used
    AND EXISTS (
      SELECT 1 FROM public.discount_rules dr
      WHERE dr.rule_type = 'email_auto'
        AND dr.is_active = TRUE
        AND (dr.starts_at IS NULL OR dr.starts_at <= NOW())
        AND (dr.ends_at IS NULL OR dr.ends_at >= NOW())
        AND (dr.max_uses IS NULL OR dr.uses_count < dr.max_uses)
    )
  );

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
        'loyalty_discount_percent', o.loyalty_discount_percent,
        'loyalty_reward_type', public.loyalty_reward_type_for_seq(o.loyalty_seq),
        'loyalty_order_seq', o.loyalty_seq,
        'loyalty_free_reward_amount', o.loyalty_free_reward_amount,
        'loyalty_free_reward_product_name', o.loyalty_free_reward_product_name,
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
      'in_flight_purchases', v_in_flight,
      'progress_in_cycle', v_progress_in_cycle,
      'purchases_remaining', v_purchases_remaining,
      'earned_rewards', v_earned_rewards,
      'redeemed_rewards', v_redeemed_rewards,
      'available_rewards', v_available_free_pants,
      'available_free_pants', v_available_free_pants,
      'available_percent_rewards', v_available_percent,
      'free_product_unlocked', (v_available_free_pants > 0),
      -- No expiry is ever applied: this stays TRUE across any period of inactivity.
      'free_reward_expires_at', NULL,
      'next_order_seq', v_next_seq,
      'next_order_in_cycle', CASE WHEN v_next_seq IS NULL THEN NULL
        ELSE ((v_next_seq - 1) % 5) + 1 END,
      'next_reward', jsonb_build_object(
        'reward_type', v_next_type,
        'label', COALESCE(public.loyalty_reward_label(v_next_type), 'regular stamp'),
        -- Position inside the current rewards card (1-5), not the absolute sequence.
        'target_order', CASE WHEN MOD(v_next_seq, 5) = 0 THEN 5 ELSE MOD(v_next_seq, 5) END,
        'target_seq', v_next_seq,
        'orders_remaining', v_next_remaining
      ),
      'milestones', v_milestones,
      'rewards', v_rewards,
      'redemption_history', v_history
    ),
    'discounts', jsonb_build_object(
      'loyalty_target_purchases', 3,
      'loyalty_discount_percent', CASE v_next_type
        WHEN 'percent_20' THEN 20
        WHEN 'percent_10' THEN 10
        ELSE 0 END,
      'loyalty_discount_eligible', COALESCE(v_next_type IN ('percent_10', 'percent_20'), FALSE),
      'purchases_until_loyalty_discount', v_next_remaining,
      'email_discount_percent', 10,
      'email_submitted', v_email_submitted,
      'email_discount_used', v_email_discount_used,
      'email_discount_eligible', v_email_discount_eligible,
      'both_eligible_non_stacking', (
        COALESCE(v_next_type IN ('percent_10', 'percent_20'), FALSE)
        AND v_email_discount_eligible
      ),
      'effective_discount_percent', GREATEST(
        CASE v_next_type WHEN 'percent_20' THEN 20 WHEN 'percent_10' THEN 10 ELSE 0 END,
        CASE WHEN v_email_discount_eligible THEN 10 ELSE 0 END
      )
    ),
    'orders', v_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_account_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_account_overview() TO authenticated, service_role;

-- ——— 11. Admin status changes finalise or release the reserved reward ———
CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item RECORD;
  v_conflict BOOLEAN := FALSE;
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

  IF v_order.status = p_new_status THEN
    RETURN;
  END IF;

  IF v_order.status <> 'cancelled' AND p_new_status = 'cancelled' THEN
    -- Restore stock, release the reward this order reserved. The cancelled order
    -- stops counting, so its milestone becomes available to a future checkout.
    FOR v_item IN SELECT variant_id, quantity FROM public.order_items WHERE order_id = p_order_id AND variant_id IS NOT NULL
    LOOP
      UPDATE public.product_variants
      SET stock_quantity = stock_quantity + v_item.quantity
      WHERE id = v_item.variant_id;
    END LOOP;

    -- Strict same-order model: no reward survives a cancelled order. The slot
    -- becomes 'released' so the only way to win it again is to complete another
    -- qualifying order — it is never re-applied to a different order.
    UPDATE public.loyalty_rewards
    SET status = 'released'
    WHERE order_id = p_order_id
      AND status IN ('reserved', 'redeemed');

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

    -- Re-reserve the reward that was released by the cancellation.
    IF EXISTS (
      SELECT 1 FROM public.loyalty_rewards
      WHERE order_id = p_order_id AND status = 'released'
    ) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.loyalty_rewards rel
        JOIN public.loyalty_rewards live
          ON live.auth_user_id = rel.auth_user_id
         AND live.milestone_seq = rel.milestone_seq
         AND live.status <> 'released'
        WHERE rel.order_id = p_order_id
          AND rel.status = 'released'
      ) INTO v_conflict;

      IF v_conflict THEN
        RAISE EXCEPTION 'The loyalty reward used by this order has since been used elsewhere; it cannot be reactivated with the reward.';
      END IF;

      UPDATE public.loyalty_rewards
      SET status = CASE WHEN p_new_status = 'delivered' THEN 'redeemed' ELSE 'reserved' END
      WHERE order_id = p_order_id
        AND status = 'released';
    END IF;

  END IF;

  UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;

  -- Delivery finalises the reward attached to this same order.
  IF p_new_status = 'delivered' THEN
    UPDATE public.loyalty_rewards
    SET status = 'redeemed'
    WHERE order_id = p_order_id
      AND status = 'reserved';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
