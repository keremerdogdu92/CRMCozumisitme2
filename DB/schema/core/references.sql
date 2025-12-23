-- DB/schema/core/references.sql
-- Purpose: Supabase table definition for `references` (admin-managed reference contacts).
-- v2.3.0:
-- - ADD: deleted_at for soft delete.
-- - UPDATE: SELECT policies split (staff sees active+not-deleted, admin sees all in org).
-- - NOTE: This file keeps existing admin INSERT/UPDATE/DELETE rules; delete should be replaced by soft delete later.

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
  commission_scheme text NULL,
  commission_percent numeric NULL,
  commission_fixed numeric NULL,
  is_active boolean NOT NULL DEFAULT true,
  contact_interval_days integer NULL,
  deleted_at timestamp with time zone NULL,
  CONSTRAINT references_pkey PRIMARY KEY (id),
  CONSTRAINT references_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES orgs (id) ON DELETE CASCADE
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
-- RLS POLICIES FOR public.references
-- ============================================================

ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;

-- Helper predicate repeated in policies:
-- "same org" check
-- (service_role bypass allowed)

-- 1) Staff SELECT: only active + not deleted rows in org
DROP POLICY IF EXISTS references_org_select ON public.references;
CREATE POLICY references_staff_select_active
ON public.references
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    deleted_at IS NULL
    AND is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.org_id = org_id
        AND p.role <> 'admin'::text
    )
  )
);

-- 2) Admin SELECT: all rows in org (including deleted)
CREATE POLICY references_admin_select_all
ON public.references
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = org_id
      AND p.role = 'admin'::text
  )
);

-- 3) Admin-only INSERT per org
DROP POLICY IF EXISTS references_admin_insert ON public.references;
CREATE POLICY references_admin_insert
ON public.references
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = org_id
      AND p.role = 'admin'::text
  )
);

-- 4) Admin-only UPDATE per org
DROP POLICY IF EXISTS references_admin_update ON public.references;
CREATE POLICY references_admin_update
ON public.references
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = org_id
      AND p.role = 'admin'::text
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = org_id
      AND p.role = 'admin'::text
  )
);

-- 5) Admin-only DELETE per org (temporary; replace with soft delete later)
DROP POLICY IF EXISTS references_admin_delete ON public.references;
CREATE POLICY references_admin_delete
ON public.references
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = org_id
      AND p.role = 'admin'::text
  )
);
