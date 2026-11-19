-- =========================================================
-- THREE WAYS STUDIOS — 010_account_loyalty_discounts.down.sql
--
-- Reversible rollback for 010_account_loyalty_discounts.sql.
-- Re-applies 007_cod_checkout.sql and 009_checkout_idempotency.sql after
-- dropping 010-only overloads, functions, table, and columns.
-- =========================================================

BEGIN;

DROP FUNCTION IF EXISTS public.create_cod_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,UUID,BOOLEAN);
DROP FUNCTION IF EXISTS public.create_cod_order_core(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,BOOLEAN);
DROP FUNCTION IF EXISTS public.quote_cod_order(JSONB,TEXT,TEXT,BOOLEAN);
DROP FUNCTION IF EXISTS public.get_customer_account_overview();
DROP FUNCTION IF EXISTS public.track_order(TEXT,TEXT);
DROP FUNCTION IF EXISTS public.order_tracking_stage(TEXT);

DROP TABLE IF EXISTS public.loyalty_reward_redemptions;

UPDATE public.orders SET status = 'confirmed' WHERE status = 'ready';
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'));

DROP INDEX IF EXISTS public.idx_orders_auth_user;
DROP INDEX IF EXISTS public.idx_orders_email_lower;

ALTER TABLE public.orders
  DROP COLUMN IF EXISTS loyalty_milestone_redeemed,
  DROP COLUMN IF EXISTS loyalty_free_reward_amount,
  DROP COLUMN IF EXISTS loyalty_discount_amount,
  DROP COLUMN IF EXISTS auth_user_id;

NOTIFY pgrst, 'reload schema';
COMMIT;
