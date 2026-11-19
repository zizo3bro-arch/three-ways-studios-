-- =========================================================
-- THREE WAYS STUDIOS — 011_loyalty_rewards_v2.down.sql
--
-- Rollback for 011_loyalty_rewards_v2.sql. Restores the 010 function
-- definitions (011_up re-applied afterwards re-creates them), then removes the
-- 011-only objects. Existing order rows keep their recorded historical totals;
-- the 011-only order columns are removed.
--
-- Apply 010_account_loyalty_discounts.sql after this file to return the
-- database to its pre-011 state.
-- =========================================================

BEGIN;

DROP FUNCTION IF EXISTS public.loyalty_checkout_benefits(UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.loyalty_qualifying_count(UUID);
DROP FUNCTION IF EXISTS public.loyalty_is_pants(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.loyalty_reward_label(TEXT);
DROP FUNCTION IF EXISTS public.loyalty_reward_type_for_seq(INTEGER);

DROP POLICY IF EXISTS "Customers read own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers read own order items" ON public.order_items;
DROP POLICY IF EXISTS "Customers read own loyalty rewards" ON public.loyalty_rewards;

DROP TABLE IF EXISTS public.loyalty_rewards;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_loyalty_discount_percent_check,
  DROP COLUMN IF EXISTS loyalty_free_reward_product_name,
  DROP COLUMN IF EXISTS loyalty_free_reward_variant_id,
  DROP COLUMN IF EXISTS loyalty_free_reward_product_id,
  DROP COLUMN IF EXISTS loyalty_discount_percent;

NOTIFY pgrst, 'reload schema';
COMMIT;
