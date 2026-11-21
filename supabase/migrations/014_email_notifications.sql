-- THREE WAYS STUDIOS — 014_email_notifications.sql
-- Production hardening for the Resend order-notification email system.
--
-- Scope:
--   * public.email_notifications — one row per (order_id, notification_type)
--     tracking whether a Resend send has actually happened, with a claim
--     token so a stale/expired claim can never overwrite a newer outcome.
--   * public.rate_limit_buckets + public.rate_limit_check() — a genuinely
--     atomic per-key fixed-window rate limiter backed by PostgreSQL
--     (replaces SELECT-then-INSERT logic). Includes a bounded cleanup of
--     expired rows so the table cannot grow unbounded.
--
-- Security model:
--   * Both tables are RLS-enabled with NO policies for anon/authenticated:
--     only the service role (the Vercel API function) can read/write them.
--   * claim_email_notification / record_email_outcome / rate_limit_check /
--     cleanup_rate_limit_buckets are SECURITY DEFINER, pinned to the public
--     schema, and EXECUTE is granted to service_role ONLY. No public access.
--   * Idempotency keys are deterministic strings of the form
--     "<notification-type>/<order_id>" (e.g. "order-confirmation/<uuid>"),
--     capped at 256 characters, stored in the row and used verbatim as the
--     Resend Idempotency-Key header. Resend retains idempotency keys for
--     24 hours, which covers any single order-notification flow.

-- ——— 1. email_notifications —————————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.email_notifications (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('order-confirmation', 'admin-new-order')),
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'sent', 'failed')),
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  claim_expires_at timestamptz NOT NULL,
  resend_id text,
  last_error text,
  outcome_recorded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_status_claim
  ON public.email_notifications (status, claim_expires_at);

-- ——— 2. rate_limit_buckets ———————————————————————————————————————————————————
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_window_start
  ON public.rate_limit_buckets (window_start);

-- ——— 3. atomic rate limiter ——————————————————————————————————————————————————
-- One transaction: INSERT or ON CONFLICT increment (a single row lock) so
-- concurrent calls can never both win an over-limit bucket. The bounded
-- cleanup (a DELETE limited to p_cleanup_max_rows expired rows) runs only
-- when a bucket starts for a brand-new window, and is best-effort: its
-- failure must never fail the rate-limit decision.
CREATE OR REPLACE FUNCTION public.rate_limit_check(
  p_key text,
  p_limit integer,
  p_window_seconds integer,
  p_cleanup boolean DEFAULT true,
  p_retention_seconds integer DEFAULT 172800,
  p_cleanup_max_rows integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
  v_retry_after integer;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 OR length(p_key) > 200 THEN
    RAISE EXCEPTION 'rate limit key must be 1-200 characters';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'rate limit must be at least 1';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'rate limit window must be at least 1 second';
  END IF;

  v_window_start := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.rate_limit_buckets (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limit_buckets.count + 1,
                last_seen_at = v_now
  RETURNING count INTO v_count;

  IF v_count = 1 AND p_cleanup THEN
    BEGIN
      WITH doomed AS (
        SELECT ctid FROM public.rate_limit_buckets
        WHERE window_start < v_now - make_interval(secs => p_retention_seconds)
        ORDER BY window_start
        LIMIT p_cleanup_max_rows
      )
      DELETE FROM public.rate_limit_buckets AS t USING doomed AS d
      WHERE t.ctid = d.ctid;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'bounded rate-limit cleanup failed (best-effort): %', SQLERRM;
    END;
  END IF;

  v_retry_after := greatest(0, p_window_seconds - floor(extract(epoch from (v_now - v_window_start)))::integer);

  RETURN jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'limit', p_limit,
    'window_start', v_window_start,
    'retry_after_seconds', v_retry_after
  );
END;
$$;

-- ——— 4. bounded standalone cleanup (callable from any scheduled context) ———————
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_buckets(
  p_retention_seconds integer DEFAULT 172800,
  p_max_rows integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_retention_seconds IS NULL OR p_retention_seconds < 1 THEN
    RAISE EXCEPTION 'retention must be at least 1 second';
  END IF;
  IF p_max_rows IS NULL OR p_max_rows < 1 THEN
    RAISE EXCEPTION 'max rows must be at least 1';
  END IF;
  WITH doomed AS (
    SELECT ctid FROM public.rate_limit_buckets
    WHERE window_start < now() - make_interval(secs => p_retention_seconds)
    ORDER BY window_start
    LIMIT p_max_rows
  )
  DELETE FROM public.rate_limit_buckets AS t USING doomed AS d
  WHERE t.ctid = d.ctid;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ——— 5. claim-ownership tokens for notification sends ———————————————————————
-- One row per (order_id, notification_type). The caller gets a claim_token;
-- only a caller presenting that token may record an outcome, so a stale or
-- late request can never overwrite a newer request's database outcome.
-- A stale claim is only reclaimable once its lease has expired — never while
-- a legitimate request may still be active.
CREATE OR REPLACE FUNCTION public.claim_email_notification(
  p_order_id uuid,
  p_notification_type text,
  p_lease_seconds integer DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_key text;
  v_row public.email_notifications%ROWTYPE;
  v_token uuid;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id is required';
  END IF;
  IF p_notification_type IS NULL OR p_notification_type NOT IN ('order-confirmation', 'admin-new-order') THEN
    RAISE EXCEPTION 'unknown notification_type: %', p_notification_type;
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 THEN
    RAISE EXCEPTION 'lease must be at least 30 seconds';
  END IF;

  v_key := p_notification_type || '/' || p_order_id::text;

  -- Fast path: create a brand-new claim. Any concurrent insert conflict is
  -- resolved by the on-conflict path below, never by reclaiming a live lease.
  INSERT INTO public.email_notifications (
    order_id, notification_type, idempotency_key, status, claim_token, claim_expires_at
  )
  VALUES (
    p_order_id, p_notification_type, v_key, 'claimed', gen_random_uuid(),
    v_now + make_interval(secs => p_lease_seconds)
  )
  ON CONFLICT (order_id, notification_type) DO NOTHING
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'outcome', 'new',
      'claim_token', v_row.claim_token,
      'status', v_row.status,
      'claim_expires_at', v_row.claim_expires_at,
      'idempotency_key', v_row.idempotency_key
    );
  END IF;

  -- Existing row: never blindly reclaim.
  SELECT * INTO v_row FROM public.email_notifications
  WHERE order_id = p_order_id AND notification_type = p_notification_type;

  IF NOT FOUND THEN
    -- Conflicting row vanished between the INSERT-conflict and the SELECT
    -- (impossible in normal operation); behave as in-flight rather than reclaim.
    RETURN jsonb_build_object(
      'outcome', 'lost',
      'claim_token', NULL,
      'status', NULL,
      'claim_expires_at', NULL,
      'idempotency_key', v_key
    );
  END IF;

  IF v_row.status = 'sent' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_sent',
      'claim_token', NULL,
      'status', v_row.status,
      'claim_expires_at', v_row.claim_expires_at,
      'idempotency_key', v_row.idempotency_key
    );
  END IF;

  IF v_row.status = 'failed' THEN
    RETURN jsonb_build_object(
      'outcome', 'failed',
      'claim_token', NULL,
      'status', v_row.status,
      'claim_expires_at', v_row.claim_expires_at,
      'idempotency_key', v_row.idempotency_key,
      'last_error', v_row.last_error
    );
  END IF;

  IF v_row.claim_expires_at > v_now THEN
    -- A legitimate request may still be active: do not reclaim.
    RETURN jsonb_build_object(
      'outcome', 'in_flight',
      'claim_token', NULL,
      'status', v_row.status,
      'claim_expires_at', v_row.claim_expires_at,
      'idempotency_key', v_row.idempotency_key
    );
  END IF;

  -- Stale claim (lease expired): take over with a fresh token, atomically.
  v_token := gen_random_uuid();
  UPDATE public.email_notifications
  SET claim_token = v_token,
      claim_expires_at = v_now + make_interval(secs => p_lease_seconds),
      status = 'claimed',
      updated_at = v_now
  WHERE order_id = p_order_id
    AND notification_type = p_notification_type
    AND status = 'claimed'
    AND claim_expires_at <= v_now
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    -- Lost the race to a concurrent re-claimer. Re-read and classify what is
    -- now in effect instead of claiming anything.
    SELECT * INTO v_row FROM public.email_notifications
    WHERE order_id = p_order_id AND notification_type = p_notification_type;
    IF v_row.status = 'sent' THEN
      RETURN jsonb_build_object('outcome', 'already_sent', 'claim_token', NULL,
        'status', v_row.status, 'claim_expires_at', v_row.claim_expires_at,
        'idempotency_key', v_row.idempotency_key);
    END IF;
    IF v_row.status = 'failed' THEN
      RETURN jsonb_build_object('outcome', 'failed', 'claim_token', NULL,
        'status', v_row.status, 'claim_expires_at', v_row.claim_expires_at,
        'idempotency_key', v_row.idempotency_key, 'last_error', v_row.last_error);
    END IF;
    RETURN jsonb_build_object('outcome', 'in_flight', 'claim_token', NULL,
      'status', v_row.status, 'claim_expires_at', v_row.claim_expires_at,
      'idempotency_key', v_row.idempotency_key);
  END IF;

  RETURN jsonb_build_object(
    'outcome', 'reclaimed',
    'claim_token', v_row.claim_token,
    'status', v_row.status,
    'claim_expires_at', v_row.claim_expires_at,
    'idempotency_key', v_row.idempotency_key
  );
END;
$$;

-- ——— 6. conditional outcome recording ———————————————————————————————————————
-- The outcome may only be written while p_claim_token is still the current
-- claim token and the row is still 'claimed'. Stale requests complete as a
-- no-op (the function returns FALSE) so a late response never overwrites a
-- newer request's outcome. Only 'claimed' is a status it can keep; 'sent'
-- and 'failed' are terminal.
CREATE OR REPLACE FUNCTION public.record_email_outcome(
  p_order_id uuid,
  p_notification_type text,
  p_claim_token uuid,
  p_status text,
  p_resend_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_status NOT IN ('claimed', 'sent', 'failed') THEN
    RAISE EXCEPTION 'invalid outcome status: %', p_status;
  END IF;

  UPDATE public.email_notifications
  SET status = p_status,
      resend_id = CASE WHEN p_status = 'sent' THEN p_resend_id ELSE resend_id END,
      last_error = CASE WHEN p_status = 'sent' THEN NULL ELSE p_error END,
      outcome_recorded_at = CASE WHEN p_status IN ('sent', 'failed') THEN now() ELSE outcome_recorded_at END,
      updated_at = now()
  WHERE order_id = p_order_id
    AND notification_type = p_notification_type
    AND claim_token = p_claim_token
    AND status = 'claimed';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

-- ——— 7. permissions, RLS and audit ——————————————————————————————————————————
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- No policies on purpose: anon/authenticated cannot read or write either
-- table. service_role (which bypasses RLS) is the only application role that
-- may touch them, enforced here via function EXECUTE grants.
REVOKE ALL ON public.email_notifications FROM anon, authenticated;
REVOKE ALL ON public.rate_limit_buckets FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.rate_limit_check(text, integer, integer, boolean, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_rate_limit_buckets(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_email_notification(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_email_outcome(uuid, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rate_limit_check(text, integer, integer, boolean, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_buckets(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_email_notification(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_email_outcome(uuid, text, uuid, text, text, text) TO service_role;
GRANT SELECT ON public.email_notifications TO service_role;
GRANT SELECT ON public.rate_limit_buckets TO service_role;

COMMENT ON FUNCTION public.rate_limit_check(text, integer, integer, boolean, integer, integer) IS
  'Atomic per-key fixed-window rate limiter. The FIRST request in a fresh window also performs a bounded cleanup of expired buckets (best-effort, max p_cleanup_max_rows rows). Fails closed: any error is returned and never silently allowed.';
COMMENT ON FUNCTION public.claim_email_notification(uuid, text, integer) IS
  'Claims the given (order_id, notification_type) for sending. Returns outcome new|reclaimed|in_flight|already_sent|failed|lost with a claim_token only while the caller owns the claim. Lease must expire before a claim can be re-taken.';
COMMENT ON FUNCTION public.record_email_outcome(uuid, text, uuid, text, text, text) IS
  'Records an outcome for a claim-owned send. Returns TRUE only when the outcome was actually applied to the current claim (stale writes are no-ops).';
COMMENT ON FUNCTION public.cleanup_rate_limit_buckets(integer, integer) IS
  'Deletes at most p_max_rows expired rate-limit buckets (older than p_retention_seconds). Safe to call from a scheduled context.';
