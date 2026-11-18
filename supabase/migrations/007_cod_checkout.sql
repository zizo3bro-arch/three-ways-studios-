-- Upgrade existing installations without changing identities, inventory, policies or old orders.
-- Same RPC signatures + an explicit COD overload; retain all existing execute grants.
BEGIN;
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

NOTIFY pgrst, 'reload schema';
COMMIT;
