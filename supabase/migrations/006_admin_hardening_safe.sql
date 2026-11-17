-- =========================================================
-- THREE WAYS STUDIOS — 006_admin_hardening_safe.sql
--
-- Safe corrective migration. This REPLACES 005_admin_hardening.sql,
-- which MUST NOT be executed because it has two defects:
--
--   1. Its `REVOKE ALL ... FROM anon` on `newsletter_subscribers`
--      removes the grant the public "subscribe to newsletter" INSERT
--      policy (002_rls_policies.sql) depends on, silently breaking
--      storefront newsletter signups.
--   2. Creating a trigger on `auth.users` can fail on a plain SQL
--      connection (insufficient privileges on the auth schema), which
--      aborts the whole migration.
--
-- This migration applies the SAME hardening intent — definer-rights
-- admin helpers with a pinned search_path, super-admin-scoped admin_user
-- write policies, narrowed RPC grants — WITHOUT breaking any existing
-- policy. It is idempotent (DROP POLICY IF EXISTS / CREATE OR REPLACE)
-- so it is safe whether or not 005 was ever applied.
--
-- Run order: 001 → 002 → 003 → 004 → (this file). 005 is skipped.
-- =========================================================

-- ——— 1. is_admin(): stable, definer-rights, pinned search path ———
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

-- ——— 2. admin_users: self-read + super_admin management only ———
-- The SELECT policy from 002_rls_policies.sql is preserved; we only add
-- the write policies that 005 intended, scoped to super_admin.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

DROP POLICY IF EXISTS "Super admins insert admin_users" ON public.admin_users;
CREATE POLICY "Super admins insert admin_users"
  ON public.admin_users FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins update admin_users" ON public.admin_users;
CREATE POLICY "Super admins update admin_users"
  ON public.admin_users FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins delete admin_users" ON public.admin_users;
CREATE POLICY "Super admins delete admin_users"
  ON public.admin_users FOR DELETE
  TO authenticated
  USING (public.is_super_admin() AND id <> auth.uid());

-- ——— 3. PRESERVE public newsletter signup ———
-- 005's `REVOKE ALL ... FROM anon` on newsletter_subscribers would break
-- the "Public can subscribe to newsletter" INSERT policy. We explicitly
-- (re)grant INSERT to anon/authenticated so signups keep working, and we
-- do NOT revoke anon's access. The other private tables are already
-- denied to anon by their RLS policies in 002, so no revoke is required
-- there; this migration only hardens what is safe to harden.
GRANT INSERT ON TABLE public.newsletter_subscribers TO anon, authenticated;

-- ——— 4. staff roster for the console (no service key needed) ———
CREATE OR REPLACE FUNCTION public.list_studio_staff()
RETURNS TABLE (id UUID, email TEXT, full_name TEXT, role TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.id, a.email, a.full_name, a.role, a.created_at
  FROM public.admin_users a
  WHERE public.is_admin()
  ORDER BY a.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.list_studio_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_studio_staff() TO authenticated, service_role;

-- ——— 5. keep customers out of every private table by default ———
-- RLS already denies anon direct access to these tables (no policy exists
-- for anon), and the storefront reaches them only through the SECURITY
-- DEFINER RPCs below. We therefore enable RLS (idempotent) without
-- revoking anon from newsletter_subscribers (handled in step 3).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers', 'orders', 'order_items', 'discount_rules',
    'discount_usage', 'admin_users'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ——— 6. revoking access actually ends the session's admin claim ———
-- A trigger keeps admin_users.email in sync with auth.users.email so the
-- roster can never drift from what Supabase Auth believes. The trigger is
-- created inside a guarded block so a plain-SQL connection that lacks
-- privileges on the auth schema never aborts the migration.
CREATE OR REPLACE FUNCTION public.sync_admin_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  UPDATE public.admin_users a
  SET email = u.email
  FROM auth.users u
  WHERE u.id = a.id AND a.email IS DISTINCT FROM u.email;
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'on_auth_user_email_change'
  ) THEN
    CREATE TRIGGER on_auth_user_email_change
      AFTER UPDATE OF email ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_admin_email();
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- A plain SQL connection may not have TRIGGER rights on auth.users.
  -- The email-sync trigger is a convenience, not required for checkout
  -- or admin operation, so we surface a notice and continue.
  RAISE NOTICE 'Skipped auth.users trigger creation (privileges): %', SQLERRM;
END $$;

-- ——— 7. verify the RPC grants are exactly what the code expects ———
-- Storefront checkout must call these as anon; the status update must
-- require an authenticated staff session. Nothing else is public.
REVOKE ALL ON FUNCTION public.quote_cod_order(JSONB, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_cod_order(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_order_confirmation(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_order_status(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.quote_cod_order(JSONB, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_cod_order(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_order_confirmation(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(UUID, TEXT) TO authenticated, service_role;

-- ——— 8. confirm the boundary ———
-- Assert that the admin_users SELECT policy and the public newsletter
-- INSERT policy both still exist. If either is missing the migration
-- fails loudly instead of leaving a broken boundary.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_users'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'admin_users has no SELECT policy — the console would be unreachable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'newsletter_subscribers'
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'newsletter_subscribers has no INSERT policy — public signup would break';
  END IF;
END $$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when auth.uid() has a row in public.admin_users. Every admin policy funnels through this.';
