-- db/schema/catalog/device_catalog_models.sql
-- Summary: Supabase table definition for `public.device_catalog_models` (per-org device catalog models).
-- Integrates with:
-- - `public.device_catalog_prices` via FK (model_id -> device_catalog_models.id)
-- - Multi-org isolation via `public.current_user_org_id()`
-- - Soft delete + restore via RPCs `public.soft_delete_device_catalog_models()` and `public.restore_device_catalog_models()`
-- Security model:
-- - No hard delete for authenticated (DELETE privilege revoked; no DELETE policy)
-- - Org-scoped SELECT/INSERT/UPDATE via RLS
-- - `service_role` has full access (imports/backoffice)
-- - `anon` has no access (no GRANT)
--
-- v2.0.0 (2025-12-28):
-- - SOFT DELETE: add deleted_at + deleted_by + delete_reason
-- - RPC: include soft_delete + restore functions (SECURITY DEFINER)
-- - HARD DELETE: remove authenticated DELETE policy + revoke DELETE privilege
-- - GRANTS: revoke anon; authenticated gets SELECT/INSERT/UPDATE only
-- - INDEX: add (org_id, deleted_at) index to support active/deleted filtering efficiently
-- - TRIGGER: stamp deleted_by automatically when deleted_at is set (helper-based)

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

  -- Soft delete columns
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT device_catalog_models_pkey PRIMARY KEY (id),

  CONSTRAINT device_catalog_models_org_id_fkey
    FOREIGN KEY (org_id)
    REFERENCES public.orgs (id)
    ON DELETE CASCADE,

  CONSTRAINT device_catalog_models_item_type_check
    CHECK (
      item_type = ANY (ARRAY[
        'hearing_aid'::text,
        'charger'::text,
        'receiver'::text,
        'battery'::text
      ])
    ),

  CONSTRAINT device_catalog_models_deleted_by_fkey
    FOREIGN KEY (deleted_by)
    REFERENCES auth.users (id)
    ON DELETE SET NULL
);

-- -----------------------------
-- Indexes
-- -----------------------------
-- Postgres auto-creates the PK index; keep explicit for determinism.
CREATE UNIQUE INDEX IF NOT EXISTS device_catalog_models_pkey
  ON public.device_catalog_models USING btree (id);

-- Supports UI filters: active/deleted/all within org.
CREATE INDEX IF NOT EXISTS device_catalog_models_org_deleted_at_idx
  ON public.device_catalog_models (org_id, deleted_at);

-- -----------------------------
-- Soft delete trigger (stamp deleted_by)
-- -----------------------------
-- Requires: public.trg_soft_delete_set_deleted_by() helper exists in DB.
-- Behavior: When deleted_at is set and deleted_by is NULL, the helper stamps deleted_by = auth.uid().
DROP TRIGGER IF EXISTS trg_device_catalog_models_soft_delete_stamp
ON public.device_catalog_models;

CREATE TRIGGER trg_device_catalog_models_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.device_catalog_models
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- -----------------------------
-- RPCs (soft delete + restore)
-- -----------------------------
-- NOTE:
-- - SECURITY DEFINER is used to ensure the operation is executed safely while still enforcing org isolation.
-- - We still constrain by org_id = public.current_user_org_id() to prevent cross-org changes.
-- - These RPCs assume the caller is authenticated; if you want explicit role checks, we can add them.

CREATE OR REPLACE FUNCTION public.soft_delete_device_catalog_models(
  p_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Soft delete within the caller's org only.
  UPDATE public.device_catalog_models
  SET deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = p_reason
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_device_catalog_models(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Restore within the caller's org only.
  UPDATE public.device_catalog_models
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

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

-- SELECT: org-scoped (includes deleted rows; UI can filter via deleted_at)
CREATE POLICY device_catalog_models_select_own_org
ON public.device_catalog_models
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- INSERT: org-scoped
CREATE POLICY device_catalog_models_insert_own_org
ON public.device_catalog_models
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- UPDATE: org-scoped
-- Security note: This allows updates on soft-deleted rows too. If you want “no edits when deleted”,
-- keep UPDATE permissive for RPC-based restore, but enforce at app-level OR split into two policies.
CREATE POLICY device_catalog_models_update_own_org
ON public.device_catalog_models
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

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
REVOKE ALL ON TABLE public.device_catalog_models FROM anon;
REVOKE ALL ON TABLE public.device_catalog_models FROM authenticated;

-- Authenticated: no hard delete
GRANT SELECT, INSERT, UPDATE ON TABLE public.device_catalog_models TO authenticated;

-- Service role: full access
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.device_catalog_models
TO service_role;
