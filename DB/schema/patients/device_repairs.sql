-- DB/schema/patients/device_repairs.sql
-- Summary: Supabase table definition for `public.device_repairs` (repairs workflow per org).
-- Integrates with:
-- - `public.orgs` (org_id FK)
-- - `public.devices`, `public.patients`, `public.meetings`, `public.inventory_items` (optional FKs)
-- - Soft delete + restore via RPCs:
--   - public.soft_delete_device_repairs(p_id uuid, p_reason text)
--   - public.restore_device_repairs(p_id uuid)
-- Security model:
-- - Multi-org isolation via public.current_user_org_id()
-- - No hard delete for authenticated (no DELETE policy; DELETE privilege not granted)
-- - Staff/admin can see active+deleted rows (UI filter uses deleted_at)
-- - `service_role` has full access (imports/backoffice)
-- - `anon` has no access (no GRANT)
--
-- v2.0.0 (2025-12-28):
-- - RPC: add soft_delete + restore functions (SECURITY DEFINER)
-- - INDEX: add (org_id, deleted_at) for fast active/deleted filtering
-- - GRANTS: revoke anon; authenticated gets SELECT/INSERT/UPDATE only; service_role full
-- - RLS: keep deterministic helper-based policies; no authenticated DELETE policy

CREATE TABLE IF NOT EXISTS public.device_repairs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  device_id uuid NULL,
  patient_id uuid NULL,
  sent_at timestamptz NULL,
  returned_at timestamptz NULL,
  cost numeric NULL DEFAULT 0,
  note text NULL,
  meeting_id uuid NULL,
  inventory_item_id uuid NULL,
  status text NOT NULL DEFAULT 'created'::text,
  reason_note text NULL,
  cargo_company text NULL,
  cargo_tracking_no text NULL,
  shipped_at timestamptz NULL,
  returned_to_clinic_at timestamptz NULL,
  delivered_to_patient_at timestamptz NULL,
  expected_delivery_meeting_id uuid NULL,
  last_status_changed timestamptz NOT NULL DEFAULT now(),

  -- Soft delete
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT device_repairs_pkey PRIMARY KEY (id),

  CONSTRAINT device_repairs_status_check
    CHECK (status = ANY (ARRAY[
      'created'::text,
      'shipped'::text,
      'returned_waiting_meeting'::text,
      'scheduled'::text,
      'delivered'::text,
      'cancelled'::text
    ])),

  CONSTRAINT device_repairs_org_id_fkey
    FOREIGN KEY (org_id)
    REFERENCES public.orgs (id)
    ON DELETE CASCADE,

  CONSTRAINT device_repairs_device_id_fkey
    FOREIGN KEY (device_id)
    REFERENCES public.devices (id)
    ON DELETE SET NULL,

  CONSTRAINT device_repairs_patient_id_fkey
    FOREIGN KEY (patient_id)
    REFERENCES public.patients (id)
    ON DELETE SET NULL,

  CONSTRAINT device_repairs_meeting_id_fkey
    FOREIGN KEY (meeting_id)
    REFERENCES public.meetings (id)
    ON DELETE SET NULL,

  CONSTRAINT device_repairs_inventory_item_id_fkey
    FOREIGN KEY (inventory_item_id)
    REFERENCES public.inventory_items (id)
    ON DELETE SET NULL,

  CONSTRAINT device_repairs_expected_delivery_meeting_id_fkey
    FOREIGN KEY (expected_delivery_meeting_id)
    REFERENCES public.meetings (id)
    ON DELETE SET NULL,

  CONSTRAINT device_repairs_deleted_by_fkey
    FOREIGN KEY (deleted_by)
    REFERENCES auth.users (id)
    ON DELETE SET NULL
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS device_repairs_pkey
  ON public.device_repairs USING btree (id);

-- Supports UI filters: active/deleted/all within org.
CREATE INDEX IF NOT EXISTS device_repairs_org_deleted_at_idx
  ON public.device_repairs (org_id, deleted_at);

-- Active work queue index (excludes soft-deleted rows by design)
DROP INDEX IF EXISTS device_repairs_active_idx;
CREATE INDEX IF NOT EXISTS device_repairs_active_idx
  ON public.device_repairs USING btree (org_id, status)
  WHERE (
    deleted_at IS NULL
    AND status = ANY (ARRAY[
      'created'::text,
      'shipped'::text,
      'returned_waiting_meeting'::text,
      'scheduled'::text
    ])
  );

CREATE INDEX IF NOT EXISTS device_repairs_inventory_idx
  ON public.device_repairs USING btree (inventory_item_id);

CREATE INDEX IF NOT EXISTS device_repairs_org_patient_idx
  ON public.device_repairs USING btree (org_id, patient_id);

CREATE INDEX IF NOT EXISTS device_repairs_deleted_at_idx
  ON public.device_repairs (deleted_at);

-- ============================================================
-- SOFT DELETE TRIGGER (stamp deleted_by)
-- ============================================================
-- Requires: public.trg_soft_delete_set_deleted_by() helper exists in DB.
DROP TRIGGER IF EXISTS trg_device_repairs_soft_delete_stamp
ON public.device_repairs;

CREATE TRIGGER trg_device_repairs_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.device_repairs
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- ============================================================
-- RPCs (soft delete + restore)
-- ============================================================
-- SECURITY NOTES:
-- - SECURITY DEFINER is used so the operation is executed safely while still enforcing org isolation.
-- - We constrain by org_id = public.current_user_org_id() to prevent cross-org updates.
-- - UI should call these RPCs instead of attempting hard DELETE.

CREATE OR REPLACE FUNCTION public.soft_delete_device_repairs(
  p_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_current_user_admin();

  UPDATE public.device_repairs
  SET deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = p_reason
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_device_repairs(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_current_user_admin();

  UPDATE public.device_repairs
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

-- ============================================================
-- RLS POLICIES (multi-org, helper-based)
-- ============================================================

ALTER TABLE public.device_repairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_repairs_service_full_access ON public.device_repairs;
DROP POLICY IF EXISTS device_repairs_select_by_org ON public.device_repairs;
DROP POLICY IF EXISTS device_repairs_write_by_org ON public.device_repairs;

-- service_role bypass
CREATE POLICY device_repairs_service_full_access
ON public.device_repairs
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- SELECT: org-scoped (includes deleted rows; UI filters via deleted_at)
CREATE POLICY device_repairs_select_by_org
ON public.device_repairs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- INSERT/UPDATE: org-scoped
CREATE POLICY device_repairs_write_by_org
ON public.device_repairs
AS PERMISSIVE
FOR INSERT, UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR org_id = public.current_user_org_id()
);

-- NO authenticated DELETE policy (hard delete disabled by privileges)

-- ============================================================
-- GRANTS (RLS still applies)
-- ============================================================

REVOKE ALL ON TABLE public.device_repairs FROM anon;
REVOKE ALL ON TABLE public.device_repairs FROM authenticated;

-- Authenticated: no hard delete
GRANT SELECT, INSERT, UPDATE ON TABLE public.device_repairs TO authenticated;

-- Service role: full access
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.device_repairs
TO service_role;
