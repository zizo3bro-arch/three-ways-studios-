-- =========================================================
-- THREE WAYS STUDIOS — 013_console_operations.sql
--
-- Everything the Studio Console needs to manage the shop without a developer.
-- Strictly additive: new nullable/defaulted columns, new tables, new functions.
-- No existing row is deleted, no column is renamed, no data is reset.
--
--   · Website content   extra site_settings fields (hero button destination,
--                       newsletter copy, contact details, social channels,
--                       curated text blocks, homepage collection mode).
--   · Products          an explicit Draft / Active / Archived status, kept in
--                       sync with is_published so the storefront query is
--                       unchanged, plus editorial tags.
--   · Inventory         an append-only stock movement ledger written by a
--                       trigger, and a validated admin adjustment RPC.
--   · Orders            status history (who changed what, when) and internal
--                       staff notes.
--   · Customers         one read-only RPC that returns a customer's profile,
--                       spend and loyalty card for the console. It cannot
--                       change progress.
--
-- Rollback: 013_console_operations.down.sql
-- =========================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.site_settings') IS NULL
     OR to_regclass('public.product_variants') IS NULL
     OR to_regclass('public.orders') IS NULL THEN
    RAISE EXCEPTION 'Apply the base schema before 013_console_operations.sql.';
  END IF;
END;
$$;

-- ——— 1. Website content fields ———
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hero_cta_href TEXT NOT NULL DEFAULT '/shop',
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS newsletter_description TEXT NOT NULL
    DEFAULT 'Submit your email address for early release notes and a one-time 10% discount at checkout.',
  ADD COLUMN IF NOT EXISTS newsletter_cta_label TEXT NOT NULL DEFAULT 'Subscribe',
  ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS announcement_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS announcement_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS social_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_blocks JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS home_collection_mode TEXT NOT NULL DEFAULT 'catalog',
  ADD COLUMN IF NOT EXISTS home_collection_limit INTEGER NOT NULL DEFAULT 24;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'site_settings_home_collection_mode_check'
      AND conrelid = 'public.site_settings'::regclass
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_home_collection_mode_check
      CHECK (home_collection_mode IN ('catalog', 'featured'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'site_settings_home_collection_limit_check'
      AND conrelid = 'public.site_settings'::regclass
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_home_collection_limit_check
      CHECK (home_collection_limit BETWEEN 1 AND 48);
  END IF;
END;
$$;

-- Seed the ordered social channel list from the existing flat URL map, once.
UPDATE public.site_settings
SET social_channels = jsonb_build_array(
  jsonb_build_object('key', 'instagram', 'label', 'Instagram', 'url', COALESCE(social_links->>'instagram', ''), 'enabled', TRUE),
  jsonb_build_object('key', 'tiktok', 'label', 'TikTok', 'url', COALESCE(social_links->>'tiktok', ''), 'enabled', TRUE),
  jsonb_build_object('key', 'youtube', 'label', 'YouTube', 'url', COALESCE(social_links->>'youtube', ''), 'enabled', TRUE),
  jsonb_build_object('key', 'x', 'label', 'X / Twitter', 'url', COALESCE(social_links->>'x', ''), 'enabled', TRUE),
  jsonb_build_object('key', 'facebook', 'label', 'Facebook', 'url', '', 'enabled', FALSE),
  jsonb_build_object('key', 'whatsapp', 'label', 'WhatsApp', 'url', '', 'enabled', FALSE)
)
WHERE id = 'default' AND (social_channels IS NULL OR social_channels = '[]'::jsonb);

-- ——— 2. Products: explicit status + editorial tags ———
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_status TEXT;
UPDATE public.products
SET product_status = CASE WHEN is_published THEN 'active' ELSE 'draft' END
WHERE product_status IS NULL;
ALTER TABLE public.products ALTER COLUMN product_status SET DEFAULT 'draft';
ALTER TABLE public.products ALTER COLUMN product_status SET NOT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_product_status_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_product_status_check
      CHECK (product_status IN ('draft', 'active', 'archived'));
  END IF;
END;
$$;

-- Status and is_published can never disagree, in either direction, so the
-- storefront's `is_published = true` query keeps working untouched.
CREATE OR REPLACE FUNCTION public.sync_product_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- The pre-existing insert contract wins: a product that says it is published
    -- is active. New console writes send both fields consistently.
    NEW.product_status := CASE WHEN COALESCE(NEW.is_published, FALSE) THEN 'active' ELSE 'draft' END;
    RETURN NEW;
  END IF;

  IF NEW.product_status IS DISTINCT FROM OLD.product_status THEN
    NEW.is_published := (NEW.product_status = 'active');
  ELSIF NEW.is_published IS DISTINCT FROM OLD.is_published THEN
    NEW.product_status := CASE WHEN NEW.is_published THEN 'active' ELSE 'draft' END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_status ON public.products;
CREATE TRIGGER trg_sync_product_status
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_status();

-- ——— 3. Order status history (append-only) ———
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID,
  changed_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order
  ON public.order_status_history (order_id, created_at);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read order status history" ON public.order_status_history;
CREATE POLICY "Admins read order status history"
  ON public.order_status_history FOR SELECT
  USING (public.is_admin());

REVOKE ALL ON TABLE public.order_status_history FROM anon, authenticated;
GRANT SELECT ON TABLE public.order_status_history TO authenticated;
GRANT ALL ON TABLE public.order_status_history TO service_role;

CREATE OR REPLACE FUNCTION public.record_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, changed_by_email)
  VALUES (
    NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
    NEW.status,
    auth.uid(),
    (SELECT LOWER(u.email) FROM auth.users u WHERE u.id = auth.uid())
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_order_status ON public.orders;
CREATE TRIGGER trg_record_order_status
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_status();

-- One opening row for orders that pre-date this migration, so every order has
-- a readable history instead of an empty timeline. Nothing is overwritten.
INSERT INTO public.order_status_history (order_id, from_status, to_status, created_at)
SELECT o.id, NULL, o.status, o.created_at
FROM public.orders o
WHERE NOT EXISTS (SELECT 1 FROM public.order_status_history h WHERE h.order_id = o.id);

-- ——— 4. Internal order notes ———
CREATE TABLE IF NOT EXISTS public.order_admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (LENGTH(BTRIM(body)) BETWEEN 1 AND 2000),
  author_id UUID,
  author_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_admin_notes_order
  ON public.order_admin_notes (order_id, created_at DESC);

ALTER TABLE public.order_admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read order notes" ON public.order_admin_notes;
CREATE POLICY "Admins read order notes"
  ON public.order_admin_notes FOR SELECT
  USING (public.is_admin());

REVOKE ALL ON TABLE public.order_admin_notes FROM anon, authenticated;
GRANT SELECT ON TABLE public.order_admin_notes TO authenticated;
GRANT ALL ON TABLE public.order_admin_notes TO service_role;

CREATE OR REPLACE FUNCTION public.admin_add_order_note(p_order_id UUID, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_body TEXT := BTRIM(COALESCE(p_body, ''));
  v_row public.order_admin_notes%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;
  IF v_body = '' THEN
    RAISE EXCEPTION 'A note cannot be empty.';
  END IF;
  IF LENGTH(v_body) > 2000 THEN
    RAISE EXCEPTION 'Notes are limited to 2000 characters.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id) THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  INSERT INTO public.order_admin_notes (order_id, body, author_id, author_email)
  VALUES (p_order_id, v_body, auth.uid(), (SELECT LOWER(u.email) FROM auth.users u WHERE u.id = auth.uid()))
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'body', v_row.body,
    'author_email', v_row.author_email,
    'created_at', v_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_order_note(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_order_note(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_order_activity(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN jsonb_build_object(
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', h.id,
        'from_status', h.from_status,
        'to_status', h.to_status,
        'changed_by_email', h.changed_by_email,
        'created_at', h.created_at
      ) ORDER BY h.created_at DESC)
      FROM public.order_status_history h
      WHERE h.order_id = p_order_id
    ), '[]'::jsonb),
    'notes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id,
        'body', n.body,
        'author_email', n.author_email,
        'created_at', n.created_at
      ) ORDER BY n.created_at DESC)
      FROM public.order_admin_notes n
      WHERE n.order_id = p_order_id
    ), '[]'::jsonb),
    'refunds', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'amount', r.amount,
        'reason', r.reason,
        'actor_email', r.actor_email,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC)
      FROM public.order_refunds r
      WHERE r.order_id = p_order_id
    ), '[]'::jsonb),
    'refunded_total', COALESCE((
      SELECT SUM(r.amount) FROM public.order_refunds r WHERE r.order_id = p_order_id
    ), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_order_activity(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_order_activity(UUID) TO authenticated, service_role;

-- ——— 4b. Cancellation & refund records (append-only) ———
-- Cash-on-delivery orders are cancelled by staff; when money has already
-- changed hands the amount, the reason and the person who recorded it are kept
-- forever. A refund can never exceed what the customer paid, and the running
-- total can never exceed the order either.
CREATE TABLE IF NOT EXISTS public.order_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 300),
  actor_id UUID,
  actor_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order ON public.order_refunds (order_id, created_at DESC);

ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read refund records" ON public.order_refunds;
CREATE POLICY "Admins read refund records" ON public.order_refunds
  FOR SELECT TO authenticated USING (public.is_admin());
-- No INSERT/UPDATE/DELETE policy: records are written only by the audited RPC
-- below and are immutable once written.
REVOKE ALL ON public.order_refunds FROM anon, authenticated;
GRANT SELECT ON public.order_refunds TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_refund(
  p_order_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_already NUMERIC;
  v_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Enter a refund amount greater than zero.';
  END IF;
  IF length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'A reason is required for every refund record.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  IF v_order.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Only a cancelled order can carry a refund record. Cancel the order first.';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_already
  FROM public.order_refunds WHERE order_id = p_order_id;

  IF v_already + p_amount > v_order.total_amount THEN
    RAISE EXCEPTION 'That refund exceeds the order total (already recorded %, order total %).',
      v_already, v_order.total_amount;
  END IF;

  INSERT INTO public.order_refunds (order_id, amount, reason, actor_id, actor_email)
  VALUES (
    p_order_id,
    p_amount,
    btrim(p_reason),
    auth.uid(),
    (SELECT email FROM public.admin_users WHERE id = auth.uid())
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'order_id', p_order_id,
    'amount', p_amount,
    'reason', btrim(p_reason),
    'refunded_total', v_already + p_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_refund(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_record_refund(UUID, NUMERIC, TEXT) TO authenticated, service_role;

-- ——— 5. Stock movement ledger (append-only) ———
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_id UUID,
  product_name TEXT NOT NULL DEFAULT '',
  color_name TEXT NOT NULL DEFAULT '',
  size_name TEXT NOT NULL DEFAULT '',
  quantity_before INTEGER,
  quantity_after INTEGER,
  delta INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'automatic'
    CHECK (source IN ('manual', 'order', 'cancellation', 'automatic', 'correction')),
  reason TEXT,
  note TEXT,
  actor_id UUID,
  actor_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_variant
  ON public.stock_movements (variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created
  ON public.stock_movements (created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read stock movements" ON public.stock_movements;
CREATE POLICY "Admins read stock movements"
  ON public.stock_movements FOR SELECT
  USING (public.is_admin());

REVOKE ALL ON TABLE public.stock_movements FROM anon, authenticated;
GRANT SELECT ON TABLE public.stock_movements TO authenticated;
GRANT ALL ON TABLE public.stock_movements TO service_role;

-- Every stock change is recorded, whoever made it: the console's manual
-- adjustment, an order being placed, an order being cancelled. Attribute values
-- arrive through transaction-local settings so nothing is inferred after the fact.
CREATE OR REPLACE FUNCTION public.record_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_source TEXT;
  v_reason TEXT;
  v_note TEXT;
BEGIN
  IF NEW.stock_quantity IS NOT DISTINCT FROM OLD.stock_quantity THEN
    RETURN NEW;
  END IF;

  v_source := COALESCE(NULLIF(current_setting('tws.stock_source', true), ''), 'automatic');
  v_reason := NULLIF(current_setting('tws.stock_reason', true), '');
  v_note := NULLIF(current_setting('tws.stock_note', true), '');
  IF v_source = 'cancellation' THEN v_reason := COALESCE(v_reason, 'Order cancelled — stock returned'); END IF;
  IF v_source = 'order' THEN v_reason := COALESCE(v_reason, 'Order placed — stock reserved'); END IF;
  IF v_source = 'automatic' THEN v_reason := COALESCE(v_reason, 'Stock updated'); END IF;

  INSERT INTO public.stock_movements (
    variant_id, product_id, product_name, color_name, size_name,
    quantity_before, quantity_after, delta, source, reason, note, actor_id, actor_email
  )
  SELECT
    NEW.id, p.id, p.name, NEW.color_name, NEW.size_name,
    OLD.stock_quantity, NEW.stock_quantity, NEW.stock_quantity - OLD.stock_quantity,
    v_source, v_reason, v_note,
    auth.uid(),
    (SELECT LOWER(u.email) FROM auth.users u WHERE u.id = auth.uid())
  FROM public.products p
  WHERE p.id = NEW.product_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_stock_movement ON public.product_variants;
CREATE TRIGGER trg_record_stock_movement
  AFTER UPDATE OF stock_quantity ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.record_stock_movement();

-- Validated manual adjustment. Negative stock is refused unless a correction is
-- explicitly requested, and every change carries a reason and an author.
CREATE OR REPLACE FUNCTION public.admin_adjust_stock(
  p_variant_id UUID,
  p_delta INTEGER,
  p_reason TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_variant public.product_variants%ROWTYPE;
  v_after INTEGER;
  v_reason TEXT := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;
  IF p_delta IS NULL OR p_delta = 0 THEN
    RAISE EXCEPTION 'Enter a stock change greater than zero.';
  END IF;
  IF ABS(p_delta) > 10000 THEN
    RAISE EXCEPTION 'A single adjustment is limited to 10,000 units.';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required for every stock adjustment.';
  END IF;

  SELECT * INTO v_variant FROM public.product_variants WHERE id = p_variant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found.';
  END IF;

  v_after := v_variant.stock_quantity + p_delta;
  -- Negative stock is refused here AND by product_variants_stock_quantity_check.
  -- There is deliberately no override: a miscount is corrected by a positive
  -- adjustment with its own reason, so the ledger always explains the shelf.
  IF v_after < 0 THEN
    RAISE EXCEPTION 'That adjustment would take stock below zero (currently %, change %).',
      v_variant.stock_quantity, p_delta;
  END IF;

  -- Attribution for the ledger trigger.
  PERFORM set_config('tws.stock_source', 'manual', true);
  PERFORM set_config('tws.stock_reason', v_reason, true);
  PERFORM set_config('tws.stock_note', COALESCE(BTRIM(p_note), ''), true);

  UPDATE public.product_variants
  SET stock_quantity = v_after
  WHERE id = p_variant_id;

  RETURN jsonb_build_object(
    'variant_id', p_variant_id,
    'quantity_before', v_variant.stock_quantity,
    'quantity_after', v_after,
    'delta', p_delta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_stock(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_stock(UUID, INTEGER, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_stock_movements(
  p_limit INTEGER DEFAULT 100,
  p_variant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(entry ORDER BY created_at DESC)
    FROM (
      SELECT jsonb_build_object(
        'id', m.id,
        'variant_id', m.variant_id,
        'product_name', m.product_name,
        'color_name', m.color_name,
        'size_name', m.size_name,
        'quantity_before', m.quantity_before,
        'quantity_after', m.quantity_after,
        'delta', m.delta,
        'source', m.source,
        'reason', m.reason,
        'note', m.note,
        'actor_email', m.actor_email,
        'created_at', m.created_at
      ) AS entry, m.created_at
      FROM public.stock_movements m
      WHERE p_variant_id IS NULL OR m.variant_id = p_variant_id
      ORDER BY m.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
    ) sub
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_stock_movements(INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_stock_movements(INTEGER, UUID) TO authenticated, service_role;

-- ——— 6. Customer profile for the console (read-only) ———
CREATE OR REPLACE FUNCTION public.admin_customer_profile(p_auth_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_customer public.customers%ROWTYPE;
  v_has_customer BOOLEAN := FALSE;
  v_orders JSONB := '[]'::jsonb;
  v_total_orders INTEGER := 0;
  v_delivered INTEGER := 0;
  v_spend NUMERIC := 0;
  v_qualifying INTEGER := 0;
  v_rewards JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  SELECT u.id, LOWER(u.email) AS email, u.raw_user_meta_data, u.created_at
  INTO v_user
  FROM auth.users u
  WHERE u.id = p_auth_user_id AND u.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_customer FROM public.customers c
  WHERE c.auth_user_id = p_auth_user_id
  ORDER BY c.updated_at DESC LIMIT 1;
  v_has_customer := FOUND;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE o.status = 'delivered')::INTEGER,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.status <> 'cancelled'), 0)
  INTO v_total_orders, v_delivered, v_spend
  FROM public.orders o
  WHERE o.auth_user_id = p_auth_user_id;

  v_qualifying := public.loyalty_qualifying_count(p_auth_user_id);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'order_id', o.id,
    'order_reference', o.order_reference,
    'status', o.status,
    'total_amount', o.total_amount,
    'loyalty_seq', o.loyalty_seq,
    'loyalty_discount_amount', o.loyalty_discount_amount,
    'loyalty_free_reward_amount', o.loyalty_free_reward_amount,
    'loyalty_free_reward_product_name', o.loyalty_free_reward_product_name,
    'created_at', o.created_at
  ) ORDER BY o.created_at DESC), '[]'::jsonb)
  INTO v_orders
  FROM public.orders o
  WHERE o.auth_user_id = p_auth_user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'reward_type', r.reward_type,
    'label', public.loyalty_reward_label(r.reward_type),
    'status', r.status,
    'milestone_seq', r.milestone_seq,
    'cycle_number', ((r.milestone_seq - 1) / 5) + 1,
    'order_in_cycle', CASE WHEN r.milestone_seq % 5 = 0 THEN 5 ELSE r.milestone_seq % 5 END,
    'order_reference', o.order_reference,
    'discount_amount', r.discount_amount,
    'free_product_name', r.free_product_name,
    'created_at', r.created_at
  ) ORDER BY r.milestone_seq DESC, r.created_at DESC), '[]'::jsonb)
  INTO v_rewards
  FROM public.loyalty_rewards r
  LEFT JOIN public.orders o ON o.id = r.order_id
  WHERE r.auth_user_id = p_auth_user_id AND r.status <> 'released';

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'auth_user_id', v_user.id,
      'email', v_user.email,
      'full_name', COALESCE(
        NULLIF(BTRIM(COALESCE(v_customer.full_name, '')), ''),
        NULLIF(BTRIM(COALESCE(v_user.raw_user_meta_data->>'full_name', '')), ''),
        ''
      ),
      'phone', CASE WHEN v_has_customer THEN COALESCE(v_customer.phone, '') ELSE '' END,
      'address', CASE WHEN v_has_customer THEN COALESCE(v_customer.address, '') ELSE '' END,
      'city', CASE WHEN v_has_customer THEN COALESCE(v_customer.city, '') ELSE '' END,
      'governorate', CASE WHEN v_has_customer THEN COALESCE(v_customer.governorate, '') ELSE '' END,
      'created_at', v_user.created_at
    ),
    'metrics', jsonb_build_object(
      'total_orders', v_total_orders,
      'delivered_orders', v_delivered,
      'total_spend', v_spend,
      'average_order_value', CASE WHEN v_total_orders > 0 THEN ROUND(v_spend / v_total_orders, 2) ELSE 0 END,
      'last_order_at', (SELECT MAX(o.created_at) FROM public.orders o WHERE o.auth_user_id = p_auth_user_id)
    ),
    'loyalty', jsonb_build_object(
      'cycle_length', 5,
      'qualifying_purchases', v_qualifying,
      'progress_in_cycle', MOD(v_qualifying, 5),
      'cycle_number', (v_qualifying / 5) + 1,
      'next_reward_type', public.loyalty_reward_type_for_seq(v_qualifying + 1),
      'next_reward_available', NOT public.loyalty_slot_taken(p_auth_user_id, v_qualifying + 1),
      'free_pants_unlocked', public.loyalty_reward_type_for_seq(v_qualifying + 1) = 'free_pants',
      'rewards', v_rewards
    ),
    'orders', v_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_customer_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_customer_profile(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
