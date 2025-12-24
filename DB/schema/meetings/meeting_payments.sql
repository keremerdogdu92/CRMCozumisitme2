-- db/schema/meetings/meeting_payments.sql
-- Purpose: Supabase table definition for `meeting_payments`.
-- Stores payments recorded during meetings for patients (Senet, Kredi Kartı, Nakit, etc.)
-- Includes: CREATE TABLE, constraints, indexes and RLS policies.
-- Source of truth: Supabase table editor / migrations.
-- Deletion model: meeting_payments currently has no soft-delete column.
-- Hard DELETE is not enabled via RLS (no DELETE policy). Prefer keeping rows,
-- or add a soft-delete column if deletion is needed later.
--
-- v2.0.0 (2025-12-24):
-- - SECURITY: Replace profiles subquery org check with public.current_user_org_id().

CREATE TABLE public.meeting_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  meeting_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  amount numeric(12, 2) NOT NULL,
  method text NOT NULL DEFAULT 'Senet'::text,
  note text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT meeting_payments_pkey PRIMARY KEY (id),

  CONSTRAINT meeting_payments_meeting_id_fkey
    FOREIGN KEY (meeting_id) REFERENCES public.meetings (id) ON DELETE CASCADE,

  CONSTRAINT meeting_payments_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE RESTRICT,

  CONSTRAINT meeting_payments_amount_check CHECK (amount > 0),

  CONSTRAINT meeting_payments_method_check CHECK (
    method = ANY (
      ARRAY[
        'Tim'::text,
        'Sivantos'::text,
        'Kredi_Kartı'::text,
        'Nakit'::text,
        'Senet'::text
      ]
    )
  )
) TABLESPACE pg_default;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_payments_meeting_id
  ON public.meeting_payments USING btree (meeting_id)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meeting_payments_patient_id
  ON public.meeting_payments USING btree (patient_id)
  TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_meeting_payments_org_id
  ON public.meeting_payments USING btree (org_id)
  TABLESPACE pg_default;

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ---------------------------------------------------------------------------

ALTER TABLE public.meeting_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_payments_select_by_org ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_insert_by_org ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_update_by_org ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_service_role_all ON public.meeting_payments;

-- Org-scoped SELECT
CREATE POLICY meeting_payments_select_by_org
ON public.meeting_payments
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- Org-scoped INSERT
CREATE POLICY meeting_payments_insert_by_org
ON public.meeting_payments
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- Org-scoped UPDATE
CREATE POLICY meeting_payments_update_by_org
ON public.meeting_payments
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
CREATE POLICY meeting_payments_service_role_all
ON public.meeting_payments
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Grants (RLS still applies)
REVOKE ALL ON TABLE public.meeting_payments FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.meeting_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.meeting_payments TO service_role;
