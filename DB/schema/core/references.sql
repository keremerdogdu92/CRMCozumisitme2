-- DB/schema/core/references.sql
-- Purpose: Supabase table definition for `public.references` (admin-managed reference contacts).
-- Multi-org standard:
-- - Org isolation via public.current_user_org_id() (never JWT claims).
-- - References are admin-only for authenticated users (staff sees nothing).
-- - Soft delete via deleted_at + deleted_by + delete_reason.
-- - Hard delete disabled for authenticated users (service_role only).
--
-- v3.1.0 (2025-12-25):
-- - SECURITY: remove staff visibility entirely (admin-only SELECT/WRITE).
-- - SOFT DELETE: add deleted_by + delete_reason, and auto-set deleted_by on soft delete.
-- - HARD DELETE: remove authenticated DELETE policy.

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

  -- Soft delete
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT references_pkey PRIMARY KEY (id),
  CONSTRAINT references_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE,
  CONSTRAINT references_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS references_org_id_idx
ON public.references USING btree (org_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS references_created_at_idx
ON public.references USING btree (created_at DESC)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS references_deleted_at_idx
ON public.references USING btree (deleted_at)
TABLESPACE pg_default;

-- ============================================================
-- SOFT DELETE STAMPING
-- ============================================================
-- Uses public.trg_soft_delete_set_deleted_by() (defined once elsewhere).
-- If it's not present yet in your DB, create it in a core helpers file.
DROP TRIGGER IF EXISTS trg_references_soft_delete_stamp ON public.references;

CREATE TRIGGER trg_references_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.references
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;

-- Drop legacy/buggy policies (deterministic)
DROP POLICY IF EXISTS references_service_full_access ON public.references;

DROP POLICY IF EXISTS references_staff_select_active ON public.references;
DROP POLICY IF EXISTS references_admin_select_all ON public.references;
DROP POLICY IF EXISTS references_admin_insert ON public.references;
DROP POLICY IF EXISTS references_admin_update ON public.references;
DROP POLICY IF EXISTS references_admin_delete ON public.references;

-- service_role bypass (imports/backoffice)
CREATE POLICY references_service_full_access
ON public.references
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Admin-only SELECT (staff sees nothing)
CREATE POLICY references_admin_select_all
ON public.references
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
CREATE POLICY references_admin_insert
ON public.references
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

-- Admin-only UPDATE (includes soft delete)
CREATE POLICY references_admin_update
ON public.references
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
-- service_role can still hard delete via references_service_full_access.

-- Grants (RLS still applies)
REVOKE ALL ON TABLE public.references FROM anon;
REVOKE ALL ON TABLE public.references FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.references TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.references TO service_role;
