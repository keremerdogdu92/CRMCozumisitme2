-- DB/schema/core/reference_gifts.sql
-- Purpose: Reference-level gifts/commission payments tracking (admin-managed).
-- Multi-org standard:
-- - Org isolation via public.current_user_org_id()
-- - Admin-only reads/writes (staff sees nothing).
-- - Soft delete via deleted_at + deleted_by + delete_reason.
--
-- Dependencies:
-- - Requires DB/schema/core/soft_delete_helpers.sql (public.trg_soft_delete_set_deleted_by()) to exist.
--
-- v2.2.0 (2025-12-28):
-- - REFACTOR: Move trg_soft_delete_set_deleted_by() into core/soft_delete_helpers.sql (single source of truth).
-- - KEEP: policies, grants, triggers unchanged.

CREATE TABLE IF NOT EXISTS public.reference_gifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  reference_id uuid NOT NULL,
  gift_type text NOT NULL DEFAULT 'other'::text,
  amount numeric(12, 2) NULL,
  gift_note text NULL,
  gift_at date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  -- Soft delete columns
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT reference_gifts_pkey PRIMARY KEY (id),
  CONSTRAINT reference_gifts_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE,
  CONSTRAINT reference_gifts_reference_id_fkey FOREIGN KEY (reference_id)
    REFERENCES public.references (id) ON DELETE CASCADE,
  CONSTRAINT reference_gifts_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS reference_gifts_org_id_idx
ON public.reference_gifts USING btree (org_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS reference_gifts_reference_id_idx
ON public.reference_gifts USING btree (reference_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS reference_gifts_deleted_at_idx
ON public.reference_gifts USING btree (deleted_at)
TABLESPACE pg_default;

-- ============================================================
-- SOFT DELETE TRIGGER (uses shared helper)
-- ============================================================

DROP TRIGGER IF EXISTS trg_reference_gifts_soft_delete_stamp ON public.reference_gifts;

CREATE TRIGGER trg_reference_gifts_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.reference_gifts
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.reference_gifts ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies (deterministic)
DROP POLICY IF EXISTS reference_gifts_service_full_access ON public.reference_gifts;
DROP POLICY IF EXISTS reference_gifts_admin_select ON public.reference_gifts;
DROP POLICY IF EXISTS reference_gifts_admin_insert ON public.reference_gifts;
DROP POLICY IF EXISTS reference_gifts_admin_update ON public.reference_gifts;
DROP POLICY IF EXISTS reference_gifts_admin_delete ON public.reference_gifts;

-- service_role bypass
CREATE POLICY reference_gifts_service_full_access
ON public.reference_gifts
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Admin-only SELECT (staff sees nothing)
CREATE POLICY reference_gifts_admin_select
ON public.reference_gifts
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

-- Admin-only INSERT
CREATE POLICY reference_gifts_admin_insert
ON public.reference_gifts
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

-- Admin-only UPDATE (soft delete happens here via UPDATE)
CREATE POLICY reference_gifts_admin_update
ON public.reference_gifts
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

-- NO authenticated DELETE policy (hard delete disabled)
-- service_role can still hard delete via reference_gifts_service_full_access.

-- Grants (RLS still applies)
REVOKE ALL ON TABLE public.reference_gifts FROM anon;
REVOKE ALL ON TABLE public.reference_gifts FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.reference_gifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.reference_gifts TO service_role;
