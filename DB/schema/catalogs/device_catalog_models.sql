-- db/schema/catalog/device_catalog_models.sql
-- Purpose: Supabase table definition for `public.device_catalog_models`.
-- Stores per-organisation device catalog models (brand/model/type) used by catalog import and pricing history.
--
-- Multi-org standard:
-- - Never trust JWT org claims in RLS.
-- - Resolve org_id via public.current_user_org_id() (SECURITY DEFINER).
--
-- v1.1.0 (2025-12-24):
-- - CHANGE: RLS policies now use public.current_user_org_id() (no subquery, no JWT).
-- - ADD: org-scoped INSERT/UPDATE/DELETE policies for authenticated (required by catalog import).
-- - ADD: service_role safety policy for ALL commands.

-- -----------------------------
-- Table
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.device_catalog_models (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  item_type text NOT NULL,
  battery_type text NULL,
  details text NULL,
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  CONSTRAINT device_catalog_models_pkey PRIMARY KEY (id),
  CONSTRAINT device_catalog_models_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,
  CONSTRAINT device_catalog_models_item_type_check
    CHECK (
      item_type = ANY (ARRAY[
        'hearing_aid'::text,
        'charger'::text,
        'receiver'::text,
        'battery'::text
      ])
    )
);

-- -----------------------------
-- Indexes
-- -----------------------------
-- Postgres auto-creates the PK index; keep explicit for determinism.
CREATE UNIQUE INDEX IF NOT EXISTS device_catalog_models_pkey
  ON public.device_catalog_models USING btree (id);

-- -----------------------------
-- RLS
-- -----------------------------
ALTER TABLE public.device_catalog_models ENABLE ROW LEVEL SECURITY;

-- -----------------------------
-- Policies
-- -----------------------------
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

-- Safety policy for service_role (in case bypassrls is not set)
CREATE POLICY device_catalog_models_service_role_all
ON public.device_catalog_models
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- -----------------------------
-- Grants (RLS still applies)
-- -----------------------------
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.device_catalog_models
TO anon, authenticated, service_role;
