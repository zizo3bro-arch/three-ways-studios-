-- =========================================================
-- THREE WAYS STUDIOS — 013_console_operations.down.sql
--
-- Removes only what 013 added. Existing orders, products, variants, customers
-- and site settings keep their data; the extra columns are dropped, and
-- product_status is dropped after re-deriving is_published so the storefront
-- keeps showing exactly the same catalog.
-- =========================================================

BEGIN;

DROP FUNCTION IF EXISTS public.admin_customer_profile(UUID);
DROP FUNCTION IF EXISTS public.admin_list_stock_movements(INTEGER, UUID);
DROP FUNCTION IF EXISTS public.admin_adjust_stock(UUID, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_record_refund(UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.admin_order_activity(UUID);
DROP FUNCTION IF EXISTS public.admin_add_order_note(UUID, TEXT);

DROP TRIGGER IF EXISTS trg_record_stock_movement ON public.product_variants;
DROP FUNCTION IF EXISTS public.record_stock_movement();
DROP TRIGGER IF EXISTS trg_record_order_status ON public.orders;
DROP FUNCTION IF EXISTS public.record_order_status();
DROP TRIGGER IF EXISTS trg_sync_product_status ON public.products;
DROP FUNCTION IF EXISTS public.sync_product_status();

DROP TABLE IF EXISTS public.stock_movements;
DROP TABLE IF EXISTS public.order_refunds;
DROP TABLE IF EXISTS public.order_admin_notes;
DROP TABLE IF EXISTS public.order_status_history;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_status_check,
  DROP COLUMN IF EXISTS product_status,
  DROP COLUMN IF EXISTS tags;

ALTER TABLE public.site_settings
  DROP CONSTRAINT IF EXISTS site_settings_home_collection_mode_check,
  DROP CONSTRAINT IF EXISTS site_settings_home_collection_limit_check,
  DROP COLUMN IF EXISTS hero_cta_href,
  DROP COLUMN IF EXISTS hero_image_url,
  DROP COLUMN IF EXISTS newsletter_description,
  DROP COLUMN IF EXISTS newsletter_cta_label,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS contact_phone,
  DROP COLUMN IF EXISTS whatsapp_url,
  DROP COLUMN IF EXISTS announcement_text,
  DROP COLUMN IF EXISTS announcement_enabled,
  DROP COLUMN IF EXISTS social_channels,
  DROP COLUMN IF EXISTS content_blocks,
  DROP COLUMN IF EXISTS home_collection_mode,
  DROP COLUMN IF EXISTS home_collection_limit;

NOTIFY pgrst, 'reload schema';
COMMIT;
