-- db/schema/meetings/meeting_payments.sql
-- Purpose: Supabase table definition for `meeting_payments`.
-- Stores payments recorded during meetings for patients (Senet, Kredi Kartı, Nakit, etc.)
-- Includes: CREATE TABLE, constraints, indexes and RLS policies.
-- Source of truth: Supabase table editor / migrations.

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

-- Org-scoped SELECT: user must belong to same org as the payment row.
CREATE POLICY meeting_payments_select_by_org
ON public.meeting_payments
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = meeting_payments.org_id
  )
);

-- Org-scoped INSERT: user can only insert rows for their own org.
CREATE POLICY meeting_payments_insert_by_org
ON public.meeting_payments
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = meeting_payments.org_id
  )
);

-- Org-scoped UPDATE: user can only read/update rows for their own org.
CREATE POLICY meeting_payments_update_by_org
ON public.meeting_payments
AS PERMISSIVE
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = meeting_payments.org_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = meeting_payments.org_id
  )
);

-- NOTE: There is intentionally NO DELETE policy defined.
-- If delete support is needed later, add a policy mirroring the same org check.

-- ---------------------------------------------------------------------------
-- TODO-SECURITY-BEFORE-PROD (meeting_payments)
-- ---------------------------------------------------------------------------
-- - Keep RLS enabled; do NOT disable RLS on this table in production.
-- - Ensure `public.profiles` always has exactly one row per auth user with correct org_id.
-- - Frontend must never allow editing `org_id` directly; it should come from JWT/profile.
-- - If a DELETE policy is ever added, it must use the same org_id filter as above.
-- - When adding any CSV/import or background jobs that touch this table with
--   service_role key, review whether they should:
--     * bypass RLS intentionally, or
--     * still respect org_id (recommended for multi-clinic setups).
