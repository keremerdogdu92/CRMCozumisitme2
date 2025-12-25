-- DB/schema/meetings/meeting_payments.sql
-- Purpose: Supabase table definition for `public.meeting_payments`.
-- Summary: Payment rows linked to meetings + patients.
-- Multi-org + soft delete standard:
-- - Org isolation via public.current_user_org_id()
-- - Soft delete via deleted_at + deleted_by + delete_reason
-- - Hard delete disabled for authenticated users (service_role only)
-- - Staff must NOT see rows that belong to reference meetings
--
-- v1.1.0 (2025-12-25):
-- - SOFT DELETE: add deleted_* columns + trigger stamp deleted_by.
-- - SECURITY: enforce meeting_type='reference' visibility rule (admin-only) via join to meetings.
-- - HARD DELETE: remove authenticated DELETE policy.

CREATE TABLE IF NOT EXISTS public.meeting_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  meeting_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'Senet'::text,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Soft delete
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT meeting_payments_pkey PRIMARY KEY (id),
  CONSTRAINT meeting_payments_amount_check CHECK (amount > 0::numeric),
  CONSTRAINT meeting_payments_method_check CHECK (
    method = ANY (ARRAY[
      'Tim'::text,
      'Sivantos'::text,
      'Kredi_Kartı'::text,
      'Nakit'::text,
      'Senet'::text
    ])
  ),
  CONSTRAINT meeting_payments_meeting_id_fkey
    FOREIGN KEY (meeting_id) REFERENCES public.meetings (id) ON DELETE CASCADE,
  CONSTRAINT meeting_payments_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE RESTRICT,
  CONSTRAINT meeting_payments_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

-- Indexes (DB-truth + soft-delete support)
CREATE UNIQUE INDEX IF NOT EXISTS meeting_payments_pkey
  ON public.meeting_payments USING btree (id);

CREATE INDEX IF NOT EXISTS idx_meeting_payments_org_id
  ON public.meeting_payments USING btree (org_id);

CREATE INDEX IF NOT EXISTS idx_meeting_payments_meeting_id
  ON public.meeting_payments USING btree (meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_payments_patient_id
  ON public.meeting_payments USING btree (patient_id);

CREATE INDEX IF NOT EXISTS idx_meeting_payments_deleted_at
  ON public.meeting_payments USING btree (deleted_at);

-- ============================================================
-- SOFT DELETE TRIGGER (shared helper name)
-- ============================================================

-- Uses public.trg_soft_delete_set_deleted_by() created in core/reference_gifts.sql patch.
-- If you prefer, we can move it to a dedicated core/helpers.sql later.

DROP TRIGGER IF EXISTS trg_meeting_payments_soft_delete_stamp ON public.meeting_payments;

CREATE TRIGGER trg_meeting_payments_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.meeting_payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.meeting_payments ENABLE ROW LEVEL SECURITY;

-- Drop policies (deterministic)
DROP POLICY IF EXISTS meeting_payments_service_full_access ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_select_by_org_and_meeting_type ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_insert_by_org_and_meeting_type ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_update_by_org_and_meeting_type ON public.meeting_payments;
DROP POLICY IF EXISTS meeting_payments_delete_by_org ON public.meeting_payments;

-- service_role bypass
CREATE POLICY meeting_payments_service_full_access
  ON public.meeting_payments
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- Helper predicate:
-- Staff cannot see reference meeting rows; admin can.
-- Note: we join meetings to reuse the same meeting_type rule.
CREATE POLICY meeting_payments_select_by_org_and_meeting_type
  ON public.meeting_payments
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'service_role'::text
    OR (
      org_id = public.current_user_org_id()
      AND EXISTS (
        SELECT 1
        FROM public.meetings m
        WHERE m.id = meeting_payments.meeting_id
          AND m.org_id = meeting_payments.org_id
          AND (
            public.current_user_role() = 'admin'
            OR m.meeting_type <> 'reference'::text
          )
      )
    )
  );

CREATE POLICY meeting_payments_insert_by_org_and_meeting_type
  ON public.meeting_payments
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.role() = 'service_role'::text
    OR (
      org_id = public.current_user_org_id()
      AND EXISTS (
        SELECT 1
        FROM public.meetings m
        WHERE m.id = meeting_payments.meeting_id
          AND m.org_id = meeting_payments.org_id
          AND (
            public.current_user_role() = 'admin'
            OR m.meeting_type <> 'reference'::text
          )
      )
    )
  );

CREATE POLICY meeting_payments_update_by_org_and_meeting_type
  ON public.meeting_payments
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    auth.role() = 'service_role'::text
    OR (
      org_id = public.current_user_org_id()
      AND EXISTS (
        SELECT 1
        FROM public.meetings m
        WHERE m.id = meeting_payments.meeting_id
          AND m.org_id = meeting_payments.org_id
          AND (
            public.current_user_role() = 'admin'
            OR m.meeting_type <> 'reference'::text
          )
      )
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'::text
    OR (
      org_id = public.current_user_org_id()
      AND EXISTS (
        SELECT 1
        FROM public.meetings m
        WHERE m.id = meeting_payments.meeting_id
          AND m.org_id = meeting_payments.org_id
          AND (
            public.current_user_role() = 'admin'
            OR m.meeting_type <> 'reference'::text
          )
      )
    )
  );

-- NO authenticated DELETE policy (hard delete disabled)

-- Grants
REVOKE ALL ON TABLE public.meeting_payments FROM anon;
REVOKE ALL ON TABLE public.meeting_payments FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.meeting_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.meeting_payments TO service_role;
