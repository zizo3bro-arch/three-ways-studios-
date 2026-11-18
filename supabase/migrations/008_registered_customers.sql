-- =========================================================
-- THREE WAYS STUDIOS — 008_registered_customers.sql
--
-- Syncs newly and previously registered storefront accounts (auth.users)
-- with public.customers and provides a strict admin-only RPC
-- (public.admin_list_customers) so the Studio Console Customers tab
-- displays every registered customer's real name, email, registration
-- date, and ID alongside COD order buyers — without ever exposing
-- passwords, tokens, or sensitive authentication fields.
--
-- Safe & idempotent on live databases: preserves all existing rows,
-- orders, foreign keys, admin permissions, and Row Level Security.
-- =========================================================

BEGIN;

-- 1. Link public.customers optionally to auth.users without breaking COD guest buyers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.customers
  ALTER COLUMN full_name SET DEFAULT '',
  ALTER COLUMN phone SET DEFAULT '',
  ALTER COLUMN governorate SET DEFAULT '',
  ALTER COLUMN city SET DEFAULT '',
  ALTER COLUMN address SET DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id
  ON public.customers (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Preserve strict admin-only RLS on public.customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage customers" ON public.customers;
CREATE POLICY "Admins manage customers"
  ON public.customers FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2. Extract a clean display name from Supabase Auth user_metadata (empty string if absent)
CREATE OR REPLACE FUNCTION public.extract_auth_full_name(p_meta JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(BTRIM(p_meta->>'full_name'), ''),
    NULLIF(BTRIM(p_meta->>'name'), ''),
    NULLIF(
      BTRIM(
        CONCAT_WS(
          ' ',
          NULLIF(BTRIM(p_meta->>'first_name'), ''),
          NULLIF(BTRIM(p_meta->>'last_name'), '')
        )
      ),
      ''
    ),
    ''
  );
$$;

REVOKE ALL ON FUNCTION public.extract_auth_full_name(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extract_auth_full_name(JSONB) TO authenticated, service_role;

-- 3. Automatic trigger syncing storefront auth.users registrations into public.customers
CREATE OR REPLACE FUNCTION public.sync_auth_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
  v_created TIMESTAMPTZ;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Never record studio staff accounts as storefront customers
  IF EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_email := LOWER(BTRIM(COALESCE(NEW.email, '')));
  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  v_name := public.extract_auth_full_name(COALESCE(NEW.raw_user_meta_data, '{}'::jsonb));
  v_created := COALESCE(NEW.created_at, NOW());

  IF EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_user_id = NEW.id) THEN
    UPDATE public.customers c
    SET
      email = CASE
        WHEN NOT EXISTS (
          SELECT 1 FROM public.customers other
          WHERE LOWER(other.email) = v_email AND other.id <> c.id
        ) THEN v_email
        ELSE c.email
      END,
      full_name = CASE WHEN v_name <> '' THEN v_name ELSE c.full_name END,
      updated_at = NOW()
    WHERE c.auth_user_id = NEW.id;
  ELSE
    INSERT INTO public.customers (
      auth_user_id, full_name, email, phone, governorate, city, address, created_at, updated_at
    )
    VALUES (
      NEW.id, v_name, v_email, '', '', '', '', v_created, NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
      auth_user_id = COALESCE(public.customers.auth_user_id, EXCLUDED.auth_user_id),
      full_name = CASE
        WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
        ELSE public.customers.full_name
      END,
      updated_at = NOW();
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a customer signup on an unexpected profile sync edge case
  RAISE WARNING 'sync_auth_customer skipped for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_auth_customer() FROM PUBLIC;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_customer_sync ON auth.users;
  CREATE TRIGGER on_auth_user_customer_sync
    AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_auth_customer();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped auth.users customer trigger creation (privileges): %', SQLERRM;
END $$;

-- Remove order-less customer shadow row if an account is later promoted to admin_users
CREATE OR REPLACE FUNCTION public.cleanup_promoted_admin_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.customers c
  WHERE c.auth_user_id = NEW.id
    AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = c.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_promoted_admin_customer() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_admin_users_cleanup_customer ON public.admin_users;
CREATE TRIGGER trg_admin_users_cleanup_customer
  AFTER INSERT ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_promoted_admin_customer();

-- Backfill existing non-admin Supabase Auth accounts into public.customers
DO $$
BEGIN
  INSERT INTO public.customers (
    auth_user_id, full_name, email, phone, governorate, city, address, created_at, updated_at
  )
  SELECT
    u.id,
    public.extract_auth_full_name(COALESCE(u.raw_user_meta_data, '{}'::jsonb)),
    LOWER(BTRIM(u.email)),
    '',
    '',
    '',
    '',
    COALESCE(u.created_at, NOW()),
    NOW()
  FROM auth.users u
  WHERE u.deleted_at IS NULL
    AND u.email IS NOT NULL
    AND BTRIM(u.email) <> ''
    AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_user_id = u.id)
  ORDER BY u.created_at ASC NULLS LAST
  ON CONFLICT (email) DO UPDATE SET
    auth_user_id = COALESCE(public.customers.auth_user_id, EXCLUDED.auth_user_id),
    full_name = CASE
      WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
      ELSE public.customers.full_name
    END,
    updated_at = NOW();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipped auth.users customer backfill (privileges): %', SQLERRM;
END $$;

-- 4. Self-sync RPC for signed-in storefront customers (fallback when auth trigger privileges are restricted)
CREATE OR REPLACE FUNCTION public.register_customer_account(
  p_full_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_user RECORD;
  v_email TEXT;
  v_name TEXT;
  v_row public.customers%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Staff accounts are managed in admin_users, never registered as storefront customers
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
    RAISE EXCEPTION 'A valid account email is required.';
  END IF;

  v_name := COALESCE(
    NULLIF(LEFT(BTRIM(COALESCE(p_full_name, '')), 160), ''),
    NULLIF(public.extract_auth_full_name(COALESCE(v_user.raw_user_meta_data, '{}'::jsonb)), ''),
    ''
  );

  SELECT * INTO v_row FROM public.customers WHERE auth_user_id = v_uid LIMIT 1;

  IF FOUND THEN
    UPDATE public.customers
    SET
      full_name = CASE WHEN v_name <> '' THEN v_name ELSE full_name END,
      updated_at = NOW()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.customers (
      auth_user_id, full_name, email, phone, governorate, city, address, created_at, updated_at
    )
    VALUES (
      v_uid, v_name, v_email, '', '', '', '', COALESCE(v_user.created_at, NOW()), NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
      auth_user_id = COALESCE(public.customers.auth_user_id, EXCLUDED.auth_user_id),
      full_name = CASE
        WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
        ELSE public.customers.full_name
      END,
      updated_at = NOW()
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'auth_user_id', v_row.auth_user_id,
    'full_name', v_row.full_name,
    'email', v_row.email,
    'created_at', COALESCE(v_user.created_at, v_row.created_at)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_customer_account(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_customer_account(TEXT) TO authenticated, service_role;

-- 5. Strict Admin-Only Customer Directory RPC
--    Returns all registered storefront accounts (auth.users, excluding admin_users)
--    merged with public.customers records. Exposes ONLY safe profile & delivery fields;
--    never exposes password hashes, auth tokens, or session data.
CREATE OR REPLACE FUNCTION public.admin_list_customers()
RETURNS TABLE (
  id UUID,
  auth_user_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  governorate TEXT,
  city TEXT,
  address TEXT,
  is_registered BOOLEAN,
  registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required.';
  END IF;

  RETURN QUERY
  WITH registered_users AS (
    SELECT
      u.id AS uid,
      LOWER(BTRIM(u.email)) AS u_email,
      public.extract_auth_full_name(COALESCE(u.raw_user_meta_data, '{}'::jsonb)) AS u_name,
      u.created_at AS u_created_at
    FROM auth.users u
    WHERE u.deleted_at IS NULL
      AND u.email IS NOT NULL
      AND BTRIM(u.email) <> ''
      AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = u.id)
  ),
  customer_rows AS (
    SELECT c.*
    FROM public.customers c
    WHERE c.auth_user_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = c.auth_user_id)
  ),
  matched AS (
    SELECT
      c.id AS id,
      COALESCE(c.auth_user_id, r.uid) AS auth_user_id,
      COALESCE(
        NULLIF(r.u_name, ''),
        NULLIF(BTRIM(c.full_name), ''),
        ''
      ) AS full_name,
      COALESCE(r.u_email, LOWER(BTRIM(c.email))) AS email,
      COALESCE(c.phone, '') AS phone,
      COALESCE(c.governorate, '') AS governorate,
      COALESCE(c.city, '') AS city,
      COALESCE(c.address, '') AS address,
      (r.uid IS NOT NULL OR c.auth_user_id IS NOT NULL) AS is_registered,
      COALESCE(r.u_created_at, c.created_at) AS registered_at,
      c.created_at AS created_at,
      c.updated_at AS updated_at,
      r.uid AS matched_uid
    FROM customer_rows c
    LEFT JOIN LATERAL (
      SELECT ru.*
      FROM registered_users ru
      WHERE ru.uid = c.auth_user_id
         OR (c.auth_user_id IS NULL AND ru.u_email = LOWER(BTRIM(c.email)))
      ORDER BY (ru.uid = c.auth_user_id) DESC, ru.u_created_at DESC
      LIMIT 1
    ) r ON TRUE
  ),
  combined AS (
    SELECT
      m.id,
      m.auth_user_id,
      m.full_name,
      m.email,
      m.phone,
      m.governorate,
      m.city,
      m.address,
      m.is_registered,
      m.registered_at,
      m.created_at,
      m.updated_at
    FROM matched m
    UNION ALL
    SELECT
      r.uid AS id,
      r.uid AS auth_user_id,
      COALESCE(r.u_name, '') AS full_name,
      r.u_email AS email,
      ''::TEXT AS phone,
      ''::TEXT AS governorate,
      ''::TEXT AS city,
      ''::TEXT AS address,
      TRUE AS is_registered,
      r.u_created_at AS registered_at,
      r.u_created_at AS created_at,
      r.u_created_at AS updated_at
    FROM registered_users r
    WHERE NOT EXISTS (
      SELECT 1 FROM matched m
      WHERE m.matched_uid = r.uid OR m.email = r.u_email
    )
  )
  SELECT
    combined.id,
    combined.auth_user_id,
    combined.full_name,
    combined.email,
    combined.phone,
    combined.governorate,
    combined.city,
    combined.address,
    combined.is_registered,
    combined.registered_at,
    combined.created_at,
    combined.updated_at
  FROM combined
  ORDER BY combined.registered_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_customers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_customers() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
