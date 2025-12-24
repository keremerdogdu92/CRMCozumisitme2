-- db/schema/meetings/meeting_accessories.sql
-- Purpose: Supabase table definition for `meeting_accessories`.
-- Stores accessory sales linked to meetings (filters, wax guards, batteries, etc.)
-- Includes: CREATE TABLE, constraints, indexes and RLS policies.
-- Source of truth: Supabase table editor / migrations.
--
-- v2.0.0 (2025-12-24):
-- - SECURITY: Replace profiles subquery org check with public.current_user_org_id().

CREATE TABLE public.meeting_accessories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  meeting_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  name text NOT NULL,
  cost_price numeric(12, 2) NOT NULL DEFAULT 0,
  sale_price numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT meeting_accessories_pkey PRIMARY KEY (id),

  CONSTRAINT meeting_accessories_meeting_id_fkey
    FOREIGN KEY (meeting_id) REFERENCES public.meetings (id) ON DELETE CASCADE,

  CONSTRAINT meeting_accessories_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE RESTRICT,

  CONSTRAINT meeting_accessories_cost_price_check CHECK (cost_price >= 0),
  CONSTRAINT meeting_accessories_sale_price_check CHECK (sale_price >= 0)
) TABLESPACE pg_default;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_accessories_meeting_id
  ON public.meeting_accessories USING btree (meeting_id)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meeting_accessories_patient_id
  ON public.meeting_accessories USING btree (patient_id)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meeting_accessories_org_id
  ON public.meeting_accessories USING btree (org_id)
  TABLESPACE pg_default;

-- ============================================================
-- Row Level Security (RLS) for public.meeting_accessories
-- ============================================================

ALTER TABLE public.meeting_accessories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_accessories_select_by_org ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_insert_by_org ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_update_by_org ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_service_role_all ON public.meeting_accessories;

-- SELECT
CREATE POLICY meeting_accessories_select_by_org
ON public.meeting_accessories
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- INSERT
CREATE POLICY meeting_accessories_insert_by_org
ON public.meeting_accessories
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- UPDATE
CREATE POLICY meeting_accessories_update_by_org
ON public.meeting_accessories
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
CREATE POLICY meeting_accessories_service_role_all
ON public.meeting_accessories
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Grants (RLS still applies)
REVOKE ALL ON TABLE public.meeting_accessories FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.meeting_accessories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.meeting_accessories TO service_role;
