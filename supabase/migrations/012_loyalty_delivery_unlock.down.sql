-- =========================================================
-- THREE WAYS STUDIOS — 012_loyalty_delivery_unlock.down.sql
--
-- Rollback for 012_loyalty_delivery_unlock.sql.
--
-- It removes the 012-only objects and then restores the 011 function bodies by
-- re-applying 011_loyalty_rewards_v2.sql (that file is idempotent and only
-- contains CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS statements). Existing
-- orders, loyalty_rewards rows and customer progress are never touched: only
-- function definitions and the two new tables are affected.
--
-- Order of operations:
--   1. run this file
--   2. re-apply 011_loyalty_rewards_v2.sql
-- =========================================================

BEGIN;

DROP FUNCTION IF EXISTS public.admin_update_loyalty_program(NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.admin_loyalty_program_history(INTEGER);
DROP FUNCTION IF EXISTS public.loyalty_program_preview();
DROP FUNCTION IF EXISTS public.loyalty_slot_taken(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.loyalty_percent_for_seq(INTEGER);

DROP FUNCTION IF EXISTS public.audit_loyalty_version();
DROP TRIGGER IF EXISTS trg_audit_loyalty_version ON public.loyalty_program_versions;

DROP TABLE IF EXISTS public.admin_audit_log;
DROP TABLE IF EXISTS public.loyalty_program_versions;

NOTIFY pgrst, 'reload schema';
COMMIT;
