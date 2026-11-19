-- =========================================================
-- THREE WAYS STUDIOS — 012_loyalty_delivery_unlock.sql
--
-- TWO changes, both additive. No existing table is dropped, no customer, order,
-- product, inventory or loyalty row is rewritten, and 010/011 stay in place.
--
-- 1. REWARD TIMING — a reward is UNLOCKED by a DELIVERED order and spent on the
--    NEXT order. Before this migration the ladder advanced on order *placement*
--    (delivered + in-flight + 1), so a customer who had placed but not received
--    three orders was already discounted on order 3. The merchant's rule is:
--
--      1 delivered order  → 1/5, one check, nothing unlocked
--      2 delivered orders → 2/5, 10% unlocked for the NEXT order
--      3 delivered orders → 3/5, 20% unlocked for the NEXT order
--      4 delivered orders → 4/5, exactly one pair of pants free on the NEXT order
--      5th order redeemed → card completes, new cycle starts at order 1
--
--    Only `delivered` orders advance the card. Pending, confirmed, processing,
--    ready and shipped never do. Cancelled orders never do.
--
-- 2. PROGRAMME SETTINGS — the third and fourth milestone percentages may be
--    configured for FUTURE orders, with a mandatory reason and an audit trail.
--    The fifth milestone is locked to `free_pants` by a CHECK constraint: it can
--    never be silently turned into a percentage discount. Changing a setting
--    never rewrites an earned or redeemed reward, because every reward row
--    stores the amount it was granted at.
--
-- Apply AFTER 011. Safe to re-run: every object is CREATE IF NOT EXISTS or
-- CREATE OR REPLACE, and the settings row is inserted with ON CONFLICT DO NOTHING
-- so a merchant's configured values are never reset.
-- =========================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.loyalty_rewards') IS NULL
     OR to_regprocedure('public.loyalty_checkout_benefits(uuid,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Apply 011_loyalty_rewards_v2.sql before installing 012_loyalty_delivery_unlock.sql.';
  END IF;
END;
$$;

-- ——— 1. Loyalty programme versions (append-only, current rules by default) ———
-- Each configured change is a new ROW with its own effective date. Nothing is
-- ever updated or deleted, so the full history of the programme is the table
-- itself, and a scheduled change simply becomes active when its date arrives.
CREATE TABLE IF NOT EXISTS public.loyalty_program_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_3_percent NUMERIC(5, 2) NOT NULL DEFAULT 10
    CHECK (milestone_3_percent > 0 AND milestone_3_percent <= 90),
  milestone_4_percent NUMERIC(5, 2) NOT NULL DEFAULT 20
    CHECK (milestone_4_percent > 0 AND milestone_4_percent <= 90),
  -- Locked to the free pair. Turning the fifth milestone into a percentage can
  -- only ever be a deliberate schema change, never a console toggle.
  milestone_5_reward_type TEXT NOT NULL DEFAULT 'free_pants'
    CHECK (milestone_5_reward_type = 'free_pants'),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_loyalty_program_versions_effective
  ON public.loyalty_program_versions (effective_from DESC);

-- Baseline: the merchant's current rules, effective immediately. Only inserted
-- when the table is empty, so a configured programme is never reset.
INSERT INTO public.loyalty_program_versions
  (milestone_3_percent, milestone_4_percent, milestone_5_reward_type, effective_from, reason)
SELECT 10, 20, 'free_pants', NOW(), 'Baseline: 10% on order 3, 20% on order 4, one free pair on order 5'
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_program_versions);

ALTER TABLE public.loyalty_program_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read loyalty versions" ON public.loyalty_program_versions;
CREATE POLICY "Admins read loyalty versions"
  ON public.loyalty_program_versions FOR SELECT
  USING (public.is_admin());

REVOKE ALL ON TABLE public.loyalty_program_versions FROM anon, authenticated;
GRANT SELECT ON TABLE public.loyalty_program_versions TO authenticated;
GRANT ALL ON TABLE public.loyalty_program_versions TO service_role;

-- ——— 2. Audit trail for sensitive console operations ———
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins read audit log"
  ON public.admin_audit_log FOR SELECT
  USING (public.is_admin());

-- No UPDATE or DELETE policy: audit rows are append-only for every role.
REVOKE ALL ON TABLE public.admin_audit_log FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;
GRANT ALL ON TABLE public.admin_audit_log TO service_role;

-- Records every programme version with the acting staff account and the reason.
CREATE OR REPLACE FUNCTION public.audit_loyalty_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, actor_email, action, entity, entity_id, detail)
  VALUES (
    COALESCE(NEW.created_by, auth.uid()),
    (SELECT LOWER(u.email) FROM auth.users u WHERE u.id = COALESCE(NEW.created_by, auth.uid())),
    'loyalty_program.version_added',
    'loyalty_program_versions',
    NEW.id::TEXT,
    jsonb_build_object(
      'milestone_3_percent', NEW.milestone_3_percent,
      'milestone_4_percent', NEW.milestone_4_percent,
      'milestone_5_reward_type', NEW.milestone_5_reward_type,
      'effective_from', NEW.effective_from,
      'reason', COALESCE(NEW.reason, NULLIF(current_setting('tws.audit_reason', true), ''))
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_loyalty_version ON public.loyalty_program_versions;
CREATE TRIGGER trg_audit_loyalty_version
  AFTER INSERT ON public.loyalty_program_versions
  FOR EACH ROW EXECUTE FUNCTION public.audit_loyalty_version();

-- ——— 3. Percentage lookup: the newest version already in force ———
CREATE OR REPLACE FUNCTION public.loyalty_percent_for_seq(p_seq INTEGER)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_seq IS NULL OR p_seq < 1 THEN 0
    WHEN p_seq % 5 = 3 THEN COALESCE((
      SELECT v.milestone_3_percent FROM public.loyalty_program_versions v
      WHERE v.effective_from <= NOW()
      ORDER BY v.effective_from DESC LIMIT 1
    ), 10)
    WHEN p_seq % 5 = 4 THEN COALESCE((
      SELECT v.milestone_4_percent FROM public.loyalty_program_versions v
      WHERE v.effective_from <= NOW()
      ORDER BY v.effective_from DESC LIMIT 1
    ), 20)
    ELSE 0
  END;
$$;

-- Reserved/redeemed reward already sitting on a milestone slot. This is what
-- stops two concurrent checkouts from both claiming the same 10%.
CREATE OR REPLACE FUNCTION public.loyalty_slot_taken(p_uid UUID, p_seq INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_uid IS NULL OR p_seq IS NULL THEN FALSE
    ELSE EXISTS (
      SELECT 1 FROM public.loyalty_rewards r
      WHERE r.auth_user_id = p_uid
        AND r.milestone_seq = p_seq
        AND r.status <> 'released'
    )
  END;
$$;

-- ——— 4. In-flight orders no longer advance the ladder ———
-- Kept (signature + grant unchanged) so every existing caller keeps working,
-- but an order that has been placed and not delivered now contributes nothing.
-- Progress and the reward slot are derived from DELIVERED orders only.
CREATE OR REPLACE FUNCTION public.loyalty_in_flight_count(p_uid UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT 0;
$$;

REVOKE ALL ON FUNCTION public.loyalty_in_flight_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loyalty_percent_for_seq(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.loyalty_slot_taken(UUID, INTEGER) FROM PUBLIC;

-- ——— 5. Checkout benefits: delivered-only ladder, slot-safe ———
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
  v_slot_seq INTEGER := NULL;
  v_taken BOOLEAN := FALSE;
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
      'free_rewards_available', 0,
      'slot_taken', FALSE
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

  -- Only delivered orders count, so the card cannot be spent before the
  -- milestone order has actually been received.
  v_qualifying := public.loyalty_qualifying_count(p_uid);
  v_in_flight := 0;
  v_slot_seq := v_qualifying + 1;
  v_milestone_type := public.loyalty_reward_type_for_seq(v_slot_seq);

  -- Two checkouts must never claim the same milestone reward. The unique index
  -- on (auth_user_id, milestone_seq) is the hard guarantee; this check turns the
  -- collision into an ordinary regular-priced order instead of an error.
  v_taken := public.loyalty_slot_taken(p_uid, v_slot_seq);

  IF v_taken THEN
    v_seq := NULL;
    v_milestone_type := NULL;
  ELSE
    v_seq := v_slot_seq;
  END IF;

  IF v_matched AND v_seq IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER
    INTO v_free_count
    FROM public.loyalty_rewards r
    WHERE r.auth_user_id = p_uid
      AND r.reward_type = 'free_pants'
      AND r.status = 'reserved';

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

    IF NOT v_free_available AND v_milestone_type IN ('percent_10', 'percent_20') THEN
      v_percent := public.loyalty_percent_for_seq(v_seq);
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
    'free_rewards_available', v_free_count,
    'slot_taken', v_taken
  );
END;
$$;

REVOKE ALL ON FUNCTION public.loyalty_checkout_benefits(UUID, TEXT, JSONB) FROM PUBLIC;

-- ——— 6. Account overview (same contract, delivered-only ladder) ———
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
  v_next_taken BOOLEAN := FALSE;
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
  -- 012: the ladder advances on DELIVERED orders only. An order that has been
  -- placed but not delivered no longer moves the card forward.
  v_next_seq := v_qualifying_purchases + 1;
  v_next_type := public.loyalty_reward_type_for_seq(v_next_seq);
  v_next_remaining := GREATEST(0, v_next_seq - v_qualifying_purchases);
  -- TRUE when a reward for this position already sits on an undelivered order,
  -- so the next checkout would be a regular purchase.
  v_next_taken := public.loyalty_slot_taken(v_uid, v_next_seq);

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
      -- A free pair is claimable when the NEXT order is the fifth position and
      -- the slot is free, or when a pair is already reserved on an order.
      'free_product_unlocked', COALESCE((
        (v_next_type = 'free_pants' AND NOT v_next_taken) OR v_available_free_pants > 0
      ), FALSE),
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
        'orders_remaining', v_next_remaining,
        -- 012: unlocked by delivery and still unused by an undelivered order.
        'available', NOT v_next_taken,
        'percent', public.loyalty_percent_for_seq(v_next_seq)
      ),
      'milestones', v_milestones,
      'rewards', v_rewards,
      'redemption_history', v_history
    ),
    'discounts', jsonb_build_object(
      'loyalty_target_purchases', 3,
      'loyalty_discount_percent', public.loyalty_percent_for_seq(v_next_seq),
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
        public.loyalty_percent_for_seq(v_next_seq),
        CASE WHEN v_email_discount_eligible THEN 10 ELSE 0 END
      )
    ),
    'orders', v_orders
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_customer_account_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_account_overview() TO authenticated, service_role;

-- ——— 7. Programme preview (any signed-in reader; no customer data) ———
CREATE OR REPLACE FUNCTION public.loyalty_program_preview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_active public.loyalty_program_versions%ROWTYPE;
  v_next public.loyalty_program_versions%ROWTYPE;
  v_has_active BOOLEAN := FALSE;
  v_has_next BOOLEAN := FALSE;
  v_rows JSONB := '[]'::jsonb;
  v_slot INTEGER;
  v_type TEXT;
BEGIN
  SELECT * INTO v_active FROM public.loyalty_program_versions
  WHERE effective_from <= NOW()
  ORDER BY effective_from DESC LIMIT 1;
  v_has_active := FOUND;
  IF NOT v_has_active THEN
    v_active.milestone_3_percent := 10;
    v_active.milestone_4_percent := 20;
    v_active.milestone_5_reward_type := 'free_pants';
    v_active.effective_from := NULL;
  END IF;

  SELECT * INTO v_next FROM public.loyalty_program_versions
  WHERE effective_from > NOW()
  ORDER BY effective_from ASC LIMIT 1;
  v_has_next := FOUND;

  FOR v_slot IN 1..5 LOOP
    v_type := public.loyalty_reward_type_for_seq(v_slot);
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'slot', v_slot,
      'reward_type', v_type,
      'label', COALESCE(public.loyalty_reward_label(v_type), 'Regular price'),
      'percent', public.loyalty_percent_for_seq(v_slot)
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'cycle_length', 5,
    'milestones', v_rows,
    'milestone_3_percent', v_active.milestone_3_percent,
    'milestone_4_percent', v_active.milestone_4_percent,
    'milestone_5_reward_type', v_active.milestone_5_reward_type,
    'effective_from', v_active.effective_from,
    'pending_change', CASE WHEN v_has_next THEN jsonb_build_object(
      'milestone_3_percent', v_next.milestone_3_percent,
      'milestone_4_percent', v_next.milestone_4_percent,
      'effective_from', v_next.effective_from
    ) ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.loyalty_program_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.loyalty_program_preview() TO authenticated, service_role;

-- ——— 8. Configure the ladder (staff only, reason required, audited) ———
-- Adds a new version row. Orders already placed, rewards already earned and
-- rewards already redeemed are never rewritten: each stores its own amount.
CREATE OR REPLACE FUNCTION public.admin_update_loyalty_program(
  p_milestone_3_percent NUMERIC,
  p_milestone_4_percent NUMERIC,
  p_effective_from TIMESTAMPTZ,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_effective TIMESTAMPTZ;
  v_reason TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  IF p_milestone_3_percent IS NULL OR p_milestone_4_percent IS NULL
     OR p_milestone_3_percent <= 0 OR p_milestone_3_percent > 90
     OR p_milestone_4_percent <= 0 OR p_milestone_4_percent > 90 THEN
    RAISE EXCEPTION 'Percentages must be greater than 0 and at most 90.';
  END IF;

  v_reason := NULLIF(BTRIM(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required for every loyalty programme change.';
  END IF;

  IF LENGTH(v_reason) > 300 THEN
    RAISE EXCEPTION 'The reason must be 300 characters or fewer.';
  END IF;

  -- A change may never apply retroactively to orders already placed, and it may
  -- never be held back by a client clock running slightly ahead of the server.
  -- "Immediately" (or any date already past) is pinned to the server's NOW();
  -- a genuinely future date is honoured exactly.
  v_effective := CASE
    WHEN p_effective_from IS NULL OR p_effective_from <= NOW() + INTERVAL '1 minute' THEN NOW()
    ELSE p_effective_from
  END;

  PERFORM set_config('tws.audit_reason', v_reason, true);

  INSERT INTO public.loyalty_program_versions (
    milestone_3_percent,
    milestone_4_percent,
    milestone_5_reward_type,
    effective_from,
    reason,
    created_by
  ) VALUES (
    p_milestone_3_percent,
    p_milestone_4_percent,
    'free_pants',
    v_effective,
    v_reason,
    auth.uid()
  );

  RETURN public.loyalty_program_preview();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_loyalty_program(NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_loyalty_program(NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

-- ——— 9. Change history for the console ———
CREATE OR REPLACE FUNCTION public.admin_loyalty_program_history(p_limit INTEGER DEFAULT 20)
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
      SELECT
        jsonb_build_object(
          'id', a.id,
          'actor_email', a.actor_email,
          'action', a.action,
          'created_at', a.created_at,
          'detail', a.detail
        ) AS entry,
        a.created_at
      FROM public.admin_audit_log a
      WHERE a.entity = 'loyalty_program_versions'
      ORDER BY a.created_at DESC
      LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
    ) sub
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_loyalty_program_history(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_loyalty_program_history(INTEGER) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
