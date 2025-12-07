-- db/schema/catalogs/current_device_catalog_prices_public.view.sql
-- Purpose: Public view exposing catalog-level device prices.
-- This is a thin wrapper over current_device_model_prices_public.
-- Source of truth: Supabase view definition.
-- NOTE: No RLS policies are defined on views; underlying tables enforce access.

CREATE VIEW public.current_device_catalog_prices_public AS
SELECT
  id,
  org_id,
  brand,
  model,
  item_type,
  battery_type,
  details,
  notes,
  valid_from,
  list_price,
  purchase_price
FROM
  public.current_device_model_prices_public;
