-- DB/schema/patients/patients.sql
-- Summary: Supabase table definition for `public.patients`.
-- Integrations:
-- - Multi-org isolation via public.current_user_org_id() (helper-based; never trust JWT org_id claims).
-- - Soft delete via deleted_at / deleted_by / delete_reason.
--   - UI should call RPCs (soft delete + restore) instead of hard DELETE.
--   - deleted_by is stamped automatically by the shared trigger helper:
--     public.trg_soft_delete_set_deleted_by() (defined in DB/schema/core/soft_delete_helpers.sql).
-- - Archive code generation via trigger trg_patients_archive_code -> set_patient_archive_code().
-- - National ID uniqueness is enforced only for active (not soft-deleted) rows.
--
-- v3.2.0 (2025-12-28):
-- - SOFT DELETE: soft_delete_patients is idempotent (no-op if already deleted).
-- - SOFT DELETE: restore_patients only affects rows that are currently deleted.
-- - TRIGGER: ensure patients soft-delete stamp trigger exists (uses shared helper).
-- - KEEP: No hard delete for authenticated (no DELETE policy, no DELETE grant).
-- - KEEP: SELECT includes deleted rows; UI controls visibility via filters.

CREATE TABLE IF NOT EXISTS public.patients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  full_name text NOT NULL,
  national_id text NULL,
  address text NULL,
  phone text NULL,
  kin_phone text NULL,
  sgk_prescription_no text NULL,
  sgk_flag boolean NULL DEFAULT false,
  sgk_docs_received boolean NULL DEFAULT false,
  sgk_processed boolean NULL DEFAULT false,
  satisfaction_10 integer NULL,
  created_at timestamptz NULL DEFAULT now(),
  last_visit_at timestamptz NULL,
  sgk_prescription_received boolean NOT NULL DEFAULT false,
  sgk_recorded_to_system boolean NOT NULL DEFAULT false,
  payment_method text NULL,
  sale_total_amount numeric(12, 2) NULL,
  card_fee_rate numeric(5, 2) NULL,
  card_fee_amount numeric(12, 2) NULL,
  reference_id uuid NULL,
  archive_code text NULL,
  invoice_issued boolean NOT NULL DEFAULT false,
  invoice_issued_at timestamptz NULL,
  sgk_profile text NULL,
  sgk_expected_reimbursement numeric(10, 2) NULL,
  sgk_expected_reimbursement_month date NULL,

  -- Soft delete columns
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  -- Battery patient marker
  is_battery_patient boolean NOT NULL DEFAULT false,

  -- Timestamp for when sgk_recorded_to_system was recorded as true.
  sgk_recorded_to_system_at timestamptz NULL,

  CONSTRAINT patients_pkey PRIMARY KEY (id),

  CONSTRAINT patients_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT patients_reference_id_fkey FOREIGN KEY (reference_id)
    REFERENCES public."references" (id) ON DELETE SET NULL,

  CONSTRAINT patients_payment_method_check CHECK (
    payment_method IS NULL
    OR payment_method = ANY (
      ARRAY[
        'Tim'::text,
        'Sivantos'::text,
        'Kredi_Kartı'::text,
        'Nakit'::text,
        'Senet'::text,
        'legacy_unknown'::text
      ]
    )
  ),

  CONSTRAINT patients_satisfaction_10_check CHECK (
    satisfaction_10 >= 1 AND satisfaction_10 <= 10
  ),

  CONSTRAINT patients_sgk_flow CHECK (
    (sgk_processed IS NOT TRUE OR sgk_docs_received IS TRUE)
    AND (sgk_docs_received IS NOT TRUE OR sgk_flag IS TRUE)
  ),

  CONSTRAINT patients_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Archive code trigger
DROP TRIGGER IF EXISTS trg_patients_archive_code ON public.patients;

CREATE TRIGGER trg_patients_archive_code
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION set_patient_archive_code();

-- Soft delete stamp trigger (uses shared helper from core/soft_delete_helpers.sql)
-- Note: This stamps deleted_by when deleted_at transitions NULL -> NOT NULL.
DROP TRIGGER IF EXISTS trg_patients_soft_delete_stamp ON public.patients;

CREATE TRIGGER trg_patients_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- ============================================================
-- INDEXES
-- ============================================================

-- Uniqueness only for active (not soft-deleted) rows.
-- This allows creating a new patient with the same national_id if the old one was soft-deleted,
-- while still preventing duplicates among active patients.
CREATE UNIQUE INDEX IF NOT EXISTS patients_national_id_unique_not_deleted
ON public.patients (org_id, national_id)
WHERE national_id IS NOT NULL
  AND deleted_at IS NULL;

-- Soft delete filtering performance
CREATE INDEX IF NOT EXISTS patients_org_deleted_at_idx
ON public.patients (org_id, deleted_at);

-- ============================================================
-- SOFT DELETE RPCs (UI must call RPC; hard delete is disabled)
-- ============================================================

-- Soft delete: marks row as deleted.
-- Idempotent: if already deleted, this UPDATE affects 0 rows and returns successfully.
CREATE OR REPLACE FUNCTION public.soft_delete_patients(
  p_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.patients
  SET deleted_at = now(),
      delete_reason = p_reason
  WHERE id = p_id
    AND org_id = public.current_user_org_id()
    AND deleted_at IS NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_patients(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_patients(uuid, text) TO authenticated;

-- Restore: un-deletes the row.
-- Idempotent: if not deleted, this UPDATE affects 0 rows and returns successfully.
CREATE OR REPLACE FUNCTION public.restore_patients(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.patients
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id()
    AND deleted_at IS NOT NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_patients(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_patients(uuid) TO authenticated;

-- ============================================================
-- RLS POLICIES FOR public.patients (multi-org, no JWT trust)
-- ============================================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patients_service_full_access ON public.patients;
DROP POLICY IF EXISTS patients_select_by_org ON public.patients;
DROP POLICY IF EXISTS patients_insert_by_org ON public.patients;
DROP POLICY IF EXISTS patients_update_by_org ON public.patients;
DROP POLICY IF EXISTS patients_delete_by_org ON public.patients;

-- service_role bypass
CREATE POLICY patients_service_full_access
ON public.patients
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT (includes deleted rows; UI filters by deleted_at if needed)
CREATE POLICY patients_select_by_org
ON public.patients
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- INSERT
CREATE POLICY patients_insert_by_org
ON public.patients
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- UPDATE (includes soft delete + restore through RPC, which runs as definer but still org-scoped)
CREATE POLICY patients_update_by_org
ON public.patients
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

-- NOTE:
-- - Hard delete is intentionally disabled for authenticated users.
-- - No DELETE policy is created.

-- ============================================================
-- GRANTS (RLS still applies)
-- ============================================================

REVOKE ALL ON TABLE public.patients FROM anon;

-- Authenticated: no DELETE
GRANT SELECT, INSERT, UPDATE ON TABLE public.patients TO authenticated;

-- Service role: full control for administrative operations
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.patients TO service_role;
