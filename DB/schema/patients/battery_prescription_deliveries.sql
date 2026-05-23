-- DB/schema/patients/battery_prescription_deliveries.sql
-- Summary: Supabase table definition for `public.battery_prescription_deliveries`.
-- Stores SGK battery prescription deliveries per patient (multi-org).
--
-- Integrations:
-- - Org isolation: public.current_user_org_id()
-- - Soft delete + restore (UI must call RPC, not UPDATE deleted_* directly):
--   - public.soft_delete_battery_prescription_deliveries(p_id, p_reason)
--   - public.restore_battery_prescription_deliveries(p_id)
-- - Patients integration: marks public.patients.is_battery_patient = true when at least one non-deleted delivery exists.
--
-- Security model:
-- - SELECT: all authenticated users in the same org can see all rows (including deleted) — UI filters via deleted_at.
-- - INSERT/UPDATE: allowed within org; UPDATE is restricted to non-deleted rows and cannot set deleted_* (RPC-only).
-- - DELETE: disabled for authenticated users (no policy + no grant).
-- - service_role: full access for backoffice/import workflows.
--
-- v2.0.0 (2025-12-28):
-- - ALIGN: RPC-only soft delete/restore + no hard delete for authenticated.
-- - ALIGN: allow org-wide SELECT including deleted rows (filter in UI).
-- - REMOVE: dependency on trg_soft_delete_set_deleted_by() trigger (RPC stamps deleted_by).
-- - ADD: org_id + deleted_at index (matches DB batch strategy).
-- - SAFETY: avoid data-migration UPDATE statements in schema file (left as optional commented block).

CREATE TABLE IF NOT EXISTS public.battery_prescription_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  patient_id uuid NOT NULL,

  delivered_at timestamptz NOT NULL DEFAULT now(),
  prescription_no text NULL,

  -- Keep as text; validate at UI level.
  battery_type text NOT NULL,

  qty_boxes integer NULL,
  qty_packs integer NULL,
  qty_units integer NULL,

  sgk_expected_amount numeric(10, 2) NULL,
  sgk_rate_period_id uuid NULL,
  sgk_rate_effective_date date NULL,
  sgk_expected_reimbursement_month date NULL,

  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Soft delete columns
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT battery_prescription_deliveries_pkey PRIMARY KEY (id),

  CONSTRAINT battery_prescription_deliveries_org_id_fkey
    FOREIGN KEY (org_id)
    REFERENCES public.orgs (id)
    ON DELETE CASCADE,

  CONSTRAINT battery_prescription_deliveries_patient_id_fkey
    FOREIGN KEY (patient_id)
    REFERENCES public.patients (id)
    ON DELETE CASCADE,

  CONSTRAINT battery_prescription_deliveries_sgk_rate_period_id_fkey
    FOREIGN KEY (sgk_rate_period_id)
    REFERENCES public.sgk_reimbursement_periods (id)
    ON DELETE SET NULL,

  CONSTRAINT battery_prescription_qty_non_negative CHECK (
    (qty_boxes IS NULL OR qty_boxes >= 0)
    AND (qty_packs IS NULL OR qty_packs >= 0)
    AND (qty_units IS NULL OR qty_units >= 0)
  ),

  CONSTRAINT battery_prescription_battery_type_not_blank CHECK (
    length(trim(battery_type)) > 0
  ),

  CONSTRAINT battery_prescription_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_by_patient
ON public.battery_prescription_deliveries (patient_id, delivered_at DESC);

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_by_org
ON public.battery_prescription_deliveries (org_id, delivered_at DESC);

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_by_org_patient
ON public.battery_prescription_deliveries (org_id, patient_id, delivered_at DESC);

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_deleted_at_idx
ON public.battery_prescription_deliveries (deleted_at);

-- Matches DB batch strategy used across the project
CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_org_deleted_at_idx
ON public.battery_prescription_deliveries (org_id, deleted_at);

CREATE INDEX IF NOT EXISTS battery_prescription_deliveries_sgk_expected_month_idx
ON public.battery_prescription_deliveries (org_id, sgk_expected_reimbursement_month)
WHERE deleted_at IS NULL;

-- ============================================================
-- SOFT DELETE / RESTORE RPCs (UI must call these)
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_battery_prescription_deliveries(
  p_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.battery_prescription_deliveries
  SET deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = p_reason
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_battery_prescription_deliveries(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_battery_prescription_deliveries(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_battery_prescription_deliveries(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_current_user_admin();

  UPDATE public.battery_prescription_deliveries
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

REVOKE ALL ON FUNCTION public.restore_battery_prescription_deliveries(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_battery_prescription_deliveries(uuid) TO authenticated;

-- ============================================================
-- RLS (helper-based, consistent with multi-org standard)
-- ============================================================

ALTER TABLE public.battery_prescription_deliveries ENABLE ROW LEVEL SECURITY;

-- Drop legacy policies (deterministic)
DROP POLICY IF EXISTS battery_prescription_deliveries_service_full_access ON public.battery_prescription_deliveries;
DROP POLICY IF EXISTS battery_prescription_deliveries_select_by_org ON public.battery_prescription_deliveries;
DROP POLICY IF EXISTS battery_prescription_deliveries_write_by_org ON public.battery_prescription_deliveries;

-- service_role bypass
CREATE POLICY battery_prescription_deliveries_service_full_access
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT: org-scoped, includes deleted rows (UI filters)
CREATE POLICY battery_prescription_deliveries_select_by_org
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- INSERT: org-scoped; forbid inserting deleted rows from client
CREATE POLICY battery_prescription_deliveries_insert_by_org
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND deleted_at IS NULL
    AND deleted_by IS NULL
  )
);

-- UPDATE: org-scoped, only for non-deleted rows; forbid setting deleted_* directly (RPC-only)
CREATE POLICY battery_prescription_deliveries_update_by_org
ON public.battery_prescription_deliveries
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND deleted_at IS NULL
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND deleted_at IS NULL
    AND deleted_by IS NULL
  )
);

-- NOTE: No authenticated DELETE policy (hard delete disabled)

-- Grants (RLS still applies)
REVOKE ALL ON TABLE public.battery_prescription_deliveries FROM anon;

-- Authenticated: no DELETE
GRANT SELECT, INSERT, UPDATE ON TABLE public.battery_prescription_deliveries TO authenticated;

-- Service role: full control
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.battery_prescription_deliveries TO service_role;

-- ============================================================
-- TRIGGER: mark patients.is_battery_patient = true on delivery
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_patient_as_battery_patient()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only mark patient if the delivery is not soft-deleted.
  IF NEW.deleted_at IS NULL THEN
    UPDATE public.patients p
    SET is_battery_patient = TRUE
    WHERE p.id = NEW.patient_id
      AND p.org_id = NEW.org_id
      AND p.is_battery_patient IS DISTINCT FROM TRUE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_battery_delivery_mark_patient
ON public.battery_prescription_deliveries;

CREATE TRIGGER trg_battery_delivery_mark_patient
AFTER INSERT OR UPDATE OF patient_id, org_id, deleted_at
ON public.battery_prescription_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.mark_patient_as_battery_patient();

-- Optional one-time backfill (leave commented in schema to avoid repeated data migrations):
-- UPDATE public.patients p
-- SET is_battery_patient = TRUE
-- WHERE p.is_battery_patient IS DISTINCT FROM TRUE
--   AND EXISTS (
--     SELECT 1
--     FROM public.battery_prescription_deliveries b
--     WHERE b.patient_id = p.id
--       AND b.org_id = p.org_id
--       AND b.deleted_at IS NULL
--   );
