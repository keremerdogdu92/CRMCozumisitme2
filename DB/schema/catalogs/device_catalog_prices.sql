-- db/schema/catalog/device_catalog_prices.sql
-- Purpose: Supabase table definition for `public.device_catalog_prices`.
-- Stores price history for catalog models with an effective date (valid_from).
--
-- Multi-org standard:
-- - Never trust JWT org claims in RLS.
-- - Resolve org via public.current_user_org_id() through device_catalog_models.
--
-- v1.1.0 (2025-12-24):
-- - CHANGE: RLS policies now use public.current_user_org_id() (no profiles subquery, no JWT).
-- - ADD: org-scoped INSERT/UPDATE/DELETE policies for authenticated (required by catalog import).
-- - ADD: service_role safety policy for ALL commands.

-- -----------------------------
-- Table
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.device_catalog_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL,
  valid_from date NOT NULL,
  list_price numeric NOT NULL,
  purchase_price numeric NOT NULL,
  created_at timestamptz NULL DEFAULT now(),
  CONSTRAINT device_catalog_prices_pkey PRIMARY KEY (id),
  CONSTRAINT device_catalog_prices_model_id_fkey
    FOREIGN KEY (model_id) REFERENCES public.device_catalog_models (id) ON DELETE CASCADE
);

-- -----------------------------
-- Indexes
-- -----------------------------
CREATE UNIQUE INDEX IF NOT EXISTS device_catalog_prices_pkey
  ON public.device_catalog_prices USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS device_catalog_prices_model_date_uidx
  ON public.device_catalog_prices USING btree (model_id, valid_from);

-- -----------------------------
-- RLS
-- -----------------------------
ALTER TABLE public.device_catalog_prices ENABLE ROW LEVEL SECURITY;

-- -----------------------------
-- Policies
-- -----------------------------
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

-- Safety policy for service_role (in case bypassrls is not set)
CREATE POLICY device_catalog_prices_service_role_all
ON public.device_catalog_prices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- -----------------------------
-- Grants (RLS still applies)
-- -----------------------------
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.device_catalog_prices
TO anon, authenticated, service_role;
