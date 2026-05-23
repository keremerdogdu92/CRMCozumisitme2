-- db/schema/catalog/device_catalog_prices.sql
-- Summary: Supabase table definition for `public.device_catalog_prices`.
-- Stores price history rows for catalog models with effective date `valid_from`.
--
-- Integrations:
-- - Org isolation: enforced via join to public.device_catalog_models + public.current_user_org_id()
-- - Soft delete + restore (UI must call RPC, not UPDATE deleted_* directly):
--   - public.soft_delete_device_catalog_prices(p_id, p_reason)
--   - public.restore_device_catalog_prices(p_id)
--
-- Security model (aligned with your latest DB direction):
-- - SELECT: authenticated users in the same org can see all rows (including deleted) — UI filters by deleted_at.
-- - INSERT/UPDATE: allowed within org; UPDATE restricted to non-deleted rows; clients cannot set deleted_* directly.
-- - DELETE: disabled for authenticated users (no policy + no grant).
-- - service_role: full access for backoffice/import workflows.
--
-- v2.0.0 (2025-12-28):
-- - ADD: deleted_at/deleted_by/delete_reason columns.
-- - ADD: RPC functions for soft_delete + restore (SECURITY DEFINER).
-- - CHANGE: remove authenticated hard DELETE policy + revoke DELETE grant for authenticated.
-- - CHANGE: remove anon grants (no anon write access).
-- - ADD: indexes supporting common access patterns and deleted filtering.

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

  -- Soft delete columns
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT device_catalog_prices_pkey PRIMARY KEY (id),

  CONSTRAINT device_catalog_prices_model_id_fkey
    FOREIGN KEY (model_id)
    REFERENCES public.device_catalog_models (id)
    ON DELETE CASCADE,

  CONSTRAINT device_catalog_prices_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

-- -----------------------------
-- Indexes
-- -----------------------------
CREATE UNIQUE INDEX IF NOT EXISTS device_catalog_prices_pkey
  ON public.device_catalog_prices USING btree (id);

-- One price row per model per valid_from
CREATE UNIQUE INDEX IF NOT EXISTS device_catalog_prices_model_date_uidx
  ON public.device_catalog_prices USING btree (model_id, valid_from);

-- Helps UI filters and “active rows” queries
CREATE INDEX IF NOT EXISTS device_catalog_prices_model_deleted_at_idx
  ON public.device_catalog_prices (model_id, deleted_at);

-- -----------------------------
-- SOFT DELETE / RESTORE RPCs (UI must call these)
-- -----------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_device_catalog_prices(
  p_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_current_user_admin();

  UPDATE public.device_catalog_prices p
  SET deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = p_reason
  WHERE p.id = p_id
    AND EXISTS (
      SELECT 1
      FROM public.device_catalog_models m
      WHERE m.id = p.model_id
        AND m.org_id = public.current_user_org_id()
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_device_catalog_prices(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_device_catalog_prices(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_device_catalog_prices(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_current_user_admin();

  UPDATE public.device_catalog_prices p
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE p.id = p_id
    AND EXISTS (
      SELECT 1
      FROM public.device_catalog_models m
      WHERE m.id = p.model_id
        AND m.org_id = public.current_user_org_id()
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_device_catalog_prices(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_device_catalog_prices(uuid) TO authenticated;

-- -----------------------------
-- RLS
-- -----------------------------
ALTER TABLE public.device_catalog_prices ENABLE ROW LEVEL SECURITY;

-- -----------------------------
-- Policies (deterministic)
-- -----------------------------
DROP POLICY IF EXISTS device_catalog_prices_select_via_model_org ON public.device_catalog_prices;
DROP POLICY IF EXISTS device_catalog_prices_insert_via_model_org ON public.device_catalog_prices;
DROP POLICY IF EXISTS device_catalog_prices_update_via_model_org ON public.device_catalog_prices;
DROP POLICY IF EXISTS device_catalog_prices_delete_via_model_org ON public.device_catalog_prices;
DROP POLICY IF EXISTS device_catalog_prices_service_full_access ON public.device_catalog_prices;

-- service_role full access
CREATE POLICY device_catalog_prices_service_full_access
ON public.device_catalog_prices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT: org-scoped via model, includes deleted rows (UI filters)
CREATE POLICY device_catalog_prices_select_via_model_org
ON public.device_catalog_prices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.device_catalog_models m
    WHERE m.id = public.device_catalog_prices.model_id
      AND m.org_id = public.current_user_org_id()
  )
);

-- INSERT: org-scoped; forbid inserting deleted rows from client
CREATE POLICY device_catalog_prices_insert_via_model_org
ON public.device_catalog_prices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    deleted_at IS NULL
    AND deleted_by IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.device_catalog_models m
      WHERE m.id = public.device_catalog_prices.model_id
        AND m.org_id = public.current_user_org_id()
    )
  )
);

-- UPDATE: org-scoped, only for non-deleted rows; forbid setting deleted_* directly (RPC-only)
CREATE POLICY device_catalog_prices_update_via_model_org
ON public.device_catalog_prices
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.device_catalog_models m
      WHERE m.id = public.device_catalog_prices.model_id
        AND m.org_id = public.current_user_org_id()
    )
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    deleted_at IS NULL
    AND deleted_by IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.device_catalog_models m
      WHERE m.id = public.device_catalog_prices.model_id
        AND m.org_id = public.current_user_org_id()
    )
  )
);

-- NOTE: No authenticated DELETE policy (hard delete disabled)

-- -----------------------------
-- Grants (RLS still applies)
-- -----------------------------
REVOKE ALL ON TABLE public.device_catalog_prices FROM anon;

-- Authenticated: no DELETE (RPC-only soft delete)
GRANT SELECT, INSERT, UPDATE ON TABLE public.device_catalog_prices TO authenticated;

-- Service role: full control
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.device_catalog_prices
TO service_role;
