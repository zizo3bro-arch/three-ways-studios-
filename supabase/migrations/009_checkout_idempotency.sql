-- Apply after 007_cod_checkout.sql. Keep the existing COD transaction and RPCs.
BEGIN;

DO $$
BEGIN
  -- A storefront deployment does not install RPCs. Refuse to wrap the old
  -- definitions (including when legacy SQL was re-run after 007).
  IF to_regprocedure('public.studio_shipping_cost(numeric)') IS NULL
     OR to_regprocedure('public.create_cod_order(text,text,text,text,text,text,text,jsonb,text,text)') IS NULL
     OR EXISTS (
       SELECT 1 FROM pg_catalog.pg_proc
       WHERE oid IN (
         to_regprocedure('public.quote_cod_order(jsonb,text,text)'),
         to_regprocedure('public.create_cod_order(text,text,text,text,text,text,text,jsonb,text)')
       ) AND prosrc ~* 'v_promo_rule[[:space:]]+record[[:space:]]*;'
     ) THEN
    RAISE EXCEPTION 'Apply or re-apply 007_cod_checkout.sql before installing checkout idempotency.';
  END IF;
END;
$$;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_request_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_request_id_key
  ON public.orders (checkout_request_id) WHERE checkout_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_cod_order(
  p_full_name TEXT, p_email TEXT, p_phone TEXT, p_governorate TEXT, p_city TEXT,
  p_address TEXT, p_notes TEXT, p_items JSONB, p_promo_code TEXT, p_payment_method TEXT,
  p_checkout_request_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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

  -- Serialize retries of this request. The receipt and request ID commit or
  -- roll back together with the existing order, inventory and discount writes.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_checkout_request_id::TEXT, 0));
  SELECT order_reference, customer_email INTO v_reference, v_email
  FROM public.orders WHERE checkout_request_id = p_checkout_request_id;

  IF FOUND THEN
    IF v_email IS DISTINCT FROM LOWER(TRIM(p_email)) THEN
      RAISE EXCEPTION 'This checkout request cannot be reused with that email.';
    END IF;
    RETURN public.get_order_confirmation(v_reference, v_email);
  END IF;

  v_receipt := public.create_cod_order(p_full_name, p_email, p_phone, p_governorate,
    p_city, p_address, p_notes, p_items, p_promo_code, p_payment_method);
  UPDATE public.orders SET checkout_request_id = p_checkout_request_id
  WHERE id = (v_receipt->>'order_id')::UUID;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not save the checkout request ID.';
  END IF;
  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,UUID) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
