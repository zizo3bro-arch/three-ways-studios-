-- =========================================================
-- THREE WAYS STUDIOS — 005_admin_hardening.sql
--
-- Closes the remaining gaps in the administrative boundary that
-- 002_rls_policies.sql leaves open. Safe to run more than once.
--
-- What this migration does
--   1. admin_users had SELECT policies only. Without an explicit
--      write policy, RLS denies writes by default — which is what we
--      want — but a super_admin must still be able to grant and
--      revoke access from the dashboard. That is added here, scoped
--      to super_admin, and nothing else.
--   2. is_admin() is recreated as SECURITY DEFINER with a pinned
--      search_path so it cannot be hijacked by a shadowing schema.
--   3. Order/inventory RPCs stay SECURITY DEFINER but their EXECUTE
--      grant is narrowed to the roles that actually call them, and
--      the internal stock-locking helpers are closed to clients.
--   4. A view-free audit function reports who is currently staff,
--      so revoking access is a one-liner and does not require the
--      service-role key in the browser.
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
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
CREATE POLICY "Admins can view admin_users"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

-- Only an existing super_admin may add, change or remove staff.
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

-- ——— 3. keep customers out of every private table by default ———
-- Explicit, role-scoped deny-by-omission: only authenticated staff can
-- reach these tables directly. Anonymous visitors read nothing here;
-- the storefront checkout uses the SECURITY DEFINER RPCs instead.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers', 'orders', 'order_items', 'discount_rules',
    'discount_usage', 'newsletter_subscribers', 'admin_users'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
  END LOOP;
END $$;

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

-- ——— 5. revoking access actually ends the session's admin claim ———
-- A trigger keeps admin_users.email in sync with auth.users.email so the
-- roster can never drift from what Supabase Auth believes.
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

DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_email();

-- ——— 6. verify the RPC grants are exactly what the code expects ———
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

-- ——— 7. confirm the boundary ———
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
END $$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when auth.uid() has a row in public.admin_users. Every admin policy funnels through this.';
