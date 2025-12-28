-- DB/schema/core/references.sql
-- Purpose: Supabase table definition for `public.references`.
-- Integrations:
-- - Multi-org isolation via public.current_user_org_id() (never JWT claims).
-- - Soft delete + restore via RPCs (UI must call RPC; do not hard delete):
--   - public.soft_delete_references(p_id, p_reason)
--   - public.restore_references(p_id)
-- - Hard delete is disabled for authenticated users (no DELETE policy, no DELETE grant).
--
-- v3.2.0 (2025-12-28):
-- - CHANGE: staff visibility restored — all authenticated users in org can SELECT (including deleted rows).
-- - CHANGE: staff can INSERT/UPDATE (and soft delete/restore via RPC).
-- - ALIGN WITH DB: include org+deleted_at index used by global soft-delete filters.
-- - REMOVE: dependency on trg_soft_delete_set_deleted_by() trigger to avoid missing-function failures.
-- - KEEP: service_role bypass.

CREATE TABLE IF NOT EXISTS public.references (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  full_name text NULL,
  "group" text NULL,
  last_meet_at date NULL,
  next_meet_at date NULL,
  note text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  phone text NULL,

  -- NOTE: Present in DB (legacy/extra). Kept to match DB as-is.
  notes text NULL,

  commission_scheme text NULL,
  commission_percent numeric NULL,
  commission_fixed numeric NULL,
  is_active boolean NOT NULL DEFAULT true,
  contact_interval_days integer NULL,

  -- Soft delete columns (DB uses all three here)
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT references_pkey PRIMARY KEY (id),

  CONSTRAINT references_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT references_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS references_org_id_idx
ON public.references USING btree (org_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS references_created_at_idx
ON public.references USING btree (created_at DESC)
TABLESPACE pg_default;

-- Existing/legacy index (kept, harmless)
CREATE INDEX IF NOT EXISTS references_deleted_at_idx
ON public.references USING btree (deleted_at)
TABLESPACE pg_default;

-- Soft delete filtering performance (added by batch in DB)
CREATE INDEX IF NOT EXISTS references_org_deleted_at_idx
ON public.references (org_id, deleted_at);

-- ============================================================
-- SOFT DELETE RPCs (UI must call RPC; hard delete is disabled)
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_references(
  p_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.references
  SET deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = p_reason
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_references(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_references(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_references(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.references
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_references(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_references(uuid) TO authenticated;

-- ============================================================
-- RLS POLICIES FOR public.references
-- ============================================================

ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;

-- Drop deterministic set (legacy + admin-only variants)
DROP POLICY IF EXISTS references_service_full_access ON public.references;

DROP POLICY IF EXISTS references_staff_select_active ON public.references;
DROP POLICY IF EXISTS references_admin_select_all ON public.references;
DROP POLICY IF EXISTS references_admin_insert ON public.references;
DROP POLICY IF EXISTS references_admin_update ON public.references;
DROP POLICY IF EXISTS references_admin_delete ON public.references;

DROP POLICY IF EXISTS references_select_by_org ON public.references;
DROP POLICY IF EXISTS references_insert_by_org ON public.references;
DROP POLICY IF EXISTS references_update_by_org ON public.references;
DROP POLICY IF EXISTS references_delete_by_org ON public.references;

-- service_role bypass (imports/backoffice)
CREATE POLICY references_service_full_access
ON public.references
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT: everyone in org can see everything (including deleted rows)
CREATE POLICY references_select_by_org
ON public.references
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- INSERT: within org
CREATE POLICY references_insert_by_org
ON public.references
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- UPDATE: within org (includes edits; soft delete/restore are via RPC)
CREATE POLICY references_update_by_org
ON public.references
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- NOTE:
-- - Hard delete is intentionally disabled for authenticated users:
--   - No DELETE policy is created.
--   - No DELETE grant is given.

-- Grants (RLS still applies)
REVOKE ALL ON TABLE public.references FROM anon;

-- Authenticated: no DELETE
GRANT SELECT, INSERT, UPDATE ON TABLE public.references TO authenticated;

-- Service role: full control for administrative operations
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.references TO service_role;
