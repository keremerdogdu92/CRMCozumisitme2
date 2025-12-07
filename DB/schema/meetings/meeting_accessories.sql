-- db/schema/meetings/meeting_accessories.sql
-- Purpose: Supabase table definition for `meeting_accessories`.
-- Stores accessory sales linked to meetings (filters, wax guards, batteries, etc.)
-- Includes: CREATE TABLE, constraints, indexes and RLS policies.
-- Source of truth: Supabase table editor / migrations.
--
-- [TODO-SECURITY-BEFORE-PROD]
--   1) Confirm that every auth user has exactly one row in public.profiles
--      with the correct org_id, otherwise org-based RLS will fail.
--   2) Decide whether DELETE should be supported for this table.
--      - Currently there is NO delete policy → deletes are effectively blocked.
--      - If you allow deletes later, add a policy mirroring the same org_id check.
--   3) If background jobs / imports run with service_role, decide whether they
--      should bypass RLS or still go through a “profiles”-based org filter.

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

-- SELECT: user must belong to the same org as the accessory row.
CREATE POLICY meeting_accessories_select_by_org
ON public.meeting_accessories
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = meeting_accessories.org_id
  )
);

-- INSERT: user can only insert rows for their own org.
CREATE POLICY meeting_accessories_insert_by_org
ON public.meeting_accessories
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = meeting_accessories.org_id
  )
);

-- UPDATE: user can only read/update rows for their own org.
CREATE POLICY meeting_accessories_update_by_org
ON public.meeting_accessories
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = meeting_accessories.org_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = meeting_accessories.org_id
  )
);

-- NOTE: There is intentionally NO DELETE policy defined.
-- If user-side DELETE is needed later, add a policy with the same
-- org_id filter as above.
