-- DB/schema/core/references.sql
-- Purpose: Supabase table definition for `public.references` (admin-managed reference contacts).
-- Multi-org standard:
-- - Org isolation via public.current_user_org_id() (never JWT claims).
-- - Admin write operations only (role from profiles via public.current_user_role()).
-- - Staff can SELECT only active + not deleted in their org.
--
-- v3.0.0:
-- - FIX: remove broken org scoping (p.org_id = p.org_id) and replace with helper-based org isolation.
-- - KEEP: legacy `notes` column to match DB.

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
  deleted_at timestamp with time zone NULL,

  CONSTRAINT references_pkey PRIMARY KEY (id),
  CONSTRAINT references_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE
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

ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;

-- Drop legacy/buggy policies (keep deterministic)
DROP POLICY IF EXISTS references_org_select ON public.references;
DROP POLICY IF EXISTS references_staff_select_active ON public.references;
DROP POLICY IF EXISTS references_admin_select_all ON public.references;
DROP POLICY IF EXISTS references_admin_insert ON public.references;
DROP POLICY IF EXISTS references_admin_update ON public.references;
DROP POLICY IF EXISTS references_admin_delete ON public.references;

-- Staff SELECT: active + not deleted in own org
CREATE POLICY references_staff_select_active
ON public.references
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND deleted_at IS NULL
    AND is_active = true
    AND public.current_user_role() <> 'admin'
  )
);

-- Admin SELECT: all rows in own org (including deleted)
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

-- Admin-only INSERT (org must match caller org)
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

-- Admin-only UPDATE (org must match caller org)
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

-- Admin-only DELETE (temporary; replace with soft delete in app)
CREATE POLICY references_admin_delete
ON public.references
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND public.current_user_role() = 'admin'
  )
);

-- Grants (RLS still applies)
REVOKE ALL ON TABLE public.references FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.references TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.references TO service_role;
