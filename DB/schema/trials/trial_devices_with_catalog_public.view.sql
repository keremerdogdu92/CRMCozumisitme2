-- db/schema/trials/trial_devices_with_catalog_public.view.sql
-- Purpose: Public view exposing trial_devices rows enriched with
-- the latest catalog model data (list_price, purchase_price, details, etc.).
-- Joins trial_devices with current_device_model_prices_public by org_id + brand + model.
-- Security:
--   - security_invoker = on → RLS from underlying tables is enforced.

CREATE VIEW public.trial_devices_with_catalog_public
WITH (security_invoker = on) AS
SELECT
  td.id,
  td.org_id,
  td.trial_id,
  td.side,
  td.brand,
  td.model,
  td.quote_price,
  cmp.list_price,
  cmp.purchase_price,
  cmp.item_type,
  cmp.battery_type,
  cmp.details,
  cmp.notes
FROM public.trial_devices AS td
LEFT JOIN public.current_device_model_prices_public AS cmp
  ON cmp.org_id = td.org_id
 AND cmp.brand  = td.brand
 AND cmp.model  = td.model;
