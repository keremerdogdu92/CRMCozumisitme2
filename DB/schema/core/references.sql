-- db/schema/core/references.sql
-- Purpose: Supabase table definition for `references`.
-- Includes: CREATE TABLE, constraints, indexes and RLS policies for reference contacts.
-- Source of truth: Supabase table editor / migrations.
--
-- [SECURITY NOTES]
--   - Row visibility:
--       * All authenticated users of the same org can SELECT (used for autocomplete).
--       * Only admins (profiles.role = 'admin') and service_role can INSERT/UPDATE/DELETE.
--   - Frontend:
--       * Normal staff screens should only select id + full_name for lookups.
--       * Admin screens may query full columns (phone, commission_* etc.).
--   - Later pass:
--       * If we need stricter separation (column-level privacy), either:
--           - move sensitive fields to a separate table, or
--           - add column-level privileges / dedicated RPCs.

CREATE TABLE public.references (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  full_name text NULL,
  "group" text NULL,
  last_meet_at date NULL,
  next_meet_at date NULL,
  note text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  phone text NULL,
  notes text NULL,
  commission_scheme text NULL,
  commission_percent numeric NULL,
  commission_fixed numeric NULL,
  is_active boolean NOT NULL DEFAULT true,
  contact_interval_days integer NULL,
  CONSTRAINT references_pkey PRIMARY KEY (id),
  CONSTRAINT references_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES orgs (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS references_org_id_idx
ON public."references" USING btree (org_id)
TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS references_created_at_idx
ON public."references" USING btree (created_at DESC)
TABLESPACE pg_default;

-- ============================================================
-- RLS POLICIES FOR public.references
-- ============================================================

ALTER TABLE public.references ENABLE ROW LEVEL SECURITY;

-- 1) Org-level SELECT for all authenticated users (staff + admin)
CREATE POLICY references_org_select
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
      AND p.org_id = references.org_id
  )
);

-- 2) Admin-only write (INSERT/UPDATE/DELETE) per org
CREATE POLICY references_admin_write
ON public.references
AS PERMISSIVE
FOR INSERT, UPDATE, DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = references.org_id
      AND p.role = 'admin'::text
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = references.org_id
      AND p.role = 'admin'::text
  )
);
