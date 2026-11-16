-- THREE WAYS STUDIOS — 004_initial_config.sql
-- Essential configuration rows ONLY (NO fake products or fake inventory)

-- Default backend-enforced 10% email checkout discount rule
INSERT INTO public.discount_rules (
  code,
  name,
  description,
  rule_type,
  discount_percent,
  min_order_amount,
  is_active
)
VALUES (
  'EMAIL10',
  'Email Checkout Privilege (10% OFF)',
  'Automatically grants 10% off at checkout once the customer provides a valid email address.',
  'email_auto',
  10.00,
  0.00,
  TRUE
)
ON CONFLICT (code) DO NOTHING;

-- Default storefront editorial content (editable from Admin Dashboard)
INSERT INTO public.site_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;
