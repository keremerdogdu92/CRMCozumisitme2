-- db/schema/catalogs/current_device_model_prices_public.view.sql
-- Purpose: Public view exposing the *latest* device model prices per model.
-- Uses a LATERAL join to pick the most recent price from device_catalog_prices.
-- Source of truth: Supabase view definition.
-- NOTE: No RLS policies are defined on the view itself.

CREATE VIEW public.current_device_model_prices_public AS
SELECT
  m.id,
  m.org_id,
  m.brand,
  m.model,
  m.item_type,
  m.battery_type,
  m.details,
  m.notes,
  p.valid_from,
  p.list_price,
  p.purchase_price
FROM
  public.device_catalog_models AS m
  JOIN LATERAL (
    SELECT
      p_1.valid_from,
      p_1.list_price,
      p_1.purchase_price
    FROM
      public.device_catalog_prices AS p_1
    WHERE
      p_1.model_id = m.id
    ORDER BY
      p_1.valid_from DESC
    LIMIT 1
  ) AS p ON TRUE
WHERE
  m.is_active = TRUE;
