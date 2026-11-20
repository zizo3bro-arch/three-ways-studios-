-- THREE WAYS STUDIOS — 014_email_notifications.sql
-- Idempotent transactional email log for order notifications (Resend).
--
-- One row per (order, notification type). A row reaches `sent` only after
-- Resend has accepted the message, so retries of checkout, page refreshes,
-- order re-opens, status changes or function retries never duplicate a
-- delivered email. Failed deliveries stay retry-able through the same
-- server-side endpoint without marking the order itself as failed.
--
-- Apply after 007_cod_checkout.sql and 009_checkout_idempotency.sql.
-- Additive: existing orders, RPCs, RLS policies and deployments are untouched.
BEGIN;

-- Ensure migrations that define the order receipt exist before we reference it.
DO $$
BEGIN
  IF to_regprocedure('public.get_order_confirmation(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 007_cod_checkout.sql before installing email notifications.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_reference TEXT NOT NULL,
  notification_type TEXT NOT NULL CHECK (
    notification_type IN ('customer_confirmation', 'admin_new_order')
  ),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'failed')
  ),
  resend_id TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_order_type
  ON public.email_notifications (order_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_retry
  ON public.email_notifications (status, created_at) WHERE status <> 'sent';
CREATE INDEX IF NOT EXISTS idx_email_notifications_reference
  ON public.email_notifications (order_reference);

DROP TRIGGER IF EXISTS trg_email_notifications_updated_at ON public.email_notifications;
CREATE TRIGGER trg_email_notifications_updated_at
  BEFORE UPDATE ON public.email_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

-- The storefront server function authenticates with the service role, which
-- bypasses RLS. Public and authenticated roles never read or write this table.
DROP POLICY IF EXISTS "No public access to email notifications" ON public.email_notifications;
CREATE POLICY "No public access to email notifications"
  ON public.email_notifications FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

-- Administrators can inspect delivery history (read-only).
DROP POLICY IF EXISTS "Admins can read email notifications" ON public.email_notifications;
CREATE POLICY "Admins can read email notifications"
  ON public.email_notifications FOR SELECT
  USING (public.is_admin());

REVOKE ALL ON TABLE public.email_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.email_notifications TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
