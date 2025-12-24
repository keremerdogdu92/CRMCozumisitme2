-- ============================================================
-- Batch A Apply: Core context + catalog + current price views
-- Scope:
--   - public.profiles (helpers already present; ensure RLS on)
--   - public.org_settings (ensure RLS/policies use helper)
--   - public.device_catalog_models (RLS + org-scoped CRUD for authenticated)
--   - public.device_catalog_prices (RLS + org-scoped CRUD for authenticated via model org)
--   - Views: current_device_model_prices_public, current_device_catalog_prices_public
--
-- Key standard:
--   - Never trust JWT org claims in RLS.
--   - Resolve org_id via public.current_user_org_id() (SECURITY DEFINER).
--   - service_role allowed explicitly via auth.role()='service_role' fallback policies
-- ============================================================

BEGIN;

-- -----------------------------
-- PROFILES: ensure RLS enabled (helpers already in file)
-- -----------------------------
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- -----------------------------
-- ORG_SETTINGS: keep deterministic policies (already helper-based)
-- -----------------------------
ALTER TABLE IF EXISTS public.org_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_settings_select_by_profile ON public.org_settings;
DROP POLICY IF EXISTS org_settings_insert_by_profile ON public.org_settings;
DROP POLICY IF EXISTS org_settings_update_by_profile ON public.org_settings;

CREATE POLICY org_settings_select_by_profile
  ON public.org_settings
  FOR SELECT
  TO authenticated
  USING (org_id = public.current_user_org_id());

CREATE POLICY org_settings_insert_by_profile
  ON public.org_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY org_settings_update_by_profile
  ON public.org_settings
  FOR UPDATE
  TO authenticated
  USING (org_id = public.current_user_org_id())
  WITH CHECK (org_id = public.current_user_org_id());

-- -----------------------------
-- DEVICE_CATALOG_MODELS
-- -----------------------------
ALTER TABLE IF EXISTS public.device_catalog_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_catalog_models_select_own_org ON public.device_catalog_models;
DROP POLICY IF EXISTS device_catalog_models_insert_own_org ON public.device_catalog_models;
DROP POLICY IF EXISTS device_catalog_models_update_own_org ON public.device_catalog_models;
DROP POLICY IF EXISTS device_catalog_models_delete_own_org ON public.device_catalog_models;

DROP POLICY IF EXISTS device_catalog_models_service_role_all ON public.device_catalog_models;

CREATE POLICY device_catalog_models_select_own_org
ON public.device_catalog_models
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (org_id = public.current_user_org_id());

CREATE POLICY device_catalog_models_insert_own_org
ON public.device_catalog_models
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY device_catalog_models_update_own_org
ON public.device_catalog_models
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (org_id = public.current_user_org_id())
WITH CHECK (org_id = public.current_user_org_id());

CREATE POLICY device_catalog_models_delete_own_org
ON public.device_catalog_models
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (org_id = public.current_user_org_id());

-- service_role safety policy (in case bypassrls is not set)
CREATE POLICY device_catalog_models_service_role_all
ON public.device_catalog_models
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- -----------------------------
-- DEVICE_CATALOG_PRICES
-- -----------------------------
ALTER TABLE IF EXISTS public.device_catalog_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_catalog_prices_select_via_model_org ON public.device_catalog_prices;
DROP POLICY IF EXISTS device_catalog_prices_insert_via_model_org ON public.device_catalog_prices;
DROP POLICY IF EXISTS device_catalog_prices_update_via_model_org ON public.device_catalog_prices;
DROP POLICY IF EXISTS device_catalog_prices_delete_via_model_org ON public.device_catalog_prices;

DROP POLICY IF EXISTS device_catalog_prices_service_role_all ON public.device_catalog_prices;

CREATE POLICY device_catalog_prices_select_via_model_org
ON public.device_catalog_prices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.device_catalog_models m
    WHERE m.id = public.device_catalog_prices.model_id
      AND m.org_id = public.current_user_org_id()
  )
);

CREATE POLICY device_catalog_prices_insert_via_model_org
ON public.device_catalog_prices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.device_catalog_models m
    WHERE m.id = public.device_catalog_prices.model_id
      AND m.org_id = public.current_user_org_id()
  )
);

CREATE POLICY device_catalog_prices_update_via_model_org
ON public.device_catalog_prices
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.device_catalog_models m
    WHERE m.id = public.device_catalog_prices.model_id
      AND m.org_id = public.current_user_org_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.device_catalog_models m
    WHERE m.id = public.device_catalog_prices.model_id
      AND m.org_id = public.current_user_org_id()
  )
);

CREATE POLICY device_catalog_prices_delete_via_model_org
ON public.device_catalog_prices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.device_catalog_models m
    WHERE m.id = public.device_catalog_prices.model_id
      AND m.org_id = public.current_user_org_id()
  )
);

-- service_role safety policy (in case bypassrls is not set)
CREATE POLICY device_catalog_prices_service_role_all
ON public.device_catalog_prices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- -----------------------------
-- VIEWS (create or replace, security_invoker)
-- -----------------------------
CREATE OR REPLACE VIEW public.current_device_model_prices_public
WITH (security_invoker = on) AS
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

CREATE OR REPLACE VIEW public.current_device_catalog_prices_public
WITH (security_invoker = on) AS
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

COMMIT;
