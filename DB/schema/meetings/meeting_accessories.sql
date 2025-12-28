-- DB/schema/meetings/meeting_accessories.sql
-- Summary: Supabase table definition for `public.meeting_accessories`.
-- Accessory line-items attached to meetings and patients.
-- Integrates with:
-- - `public.meetings` (meeting_id) for meeting_type gating and cascade behavior
-- - `public.patients` (patient_id)
-- - Soft delete + restore RPCs:
--   - public.soft_delete_meeting_accessories(p_id uuid, p_reason text)
--   - public.restore_meeting_accessories(p_id uuid)
-- Security model:
-- - Multi-org isolation via public.current_user_org_id()
-- - Staff must not see rows belonging to meetings where meeting_type='reference' (admin-only)
-- - Soft delete supported (deleted_at/deleted_by/delete_reason)
-- - Hard delete disabled for authenticated (no DELETE policy; no DELETE privilege)
-- - `service_role` has full access
-- - `anon` has no access
--
-- v2.0.0 (2025-12-28):
-- - RPC: add soft_delete + restore functions (SECURITY DEFINER)
-- - INDEX: add (org_id, deleted_at)
-- - GRANTS: authenticated SELECT/INSERT/UPDATE only (no DELETE)

CREATE TABLE IF NOT EXISTS public.meeting_accessories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  meeting_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  name text NOT NULL,
  cost_price numeric NOT NULL DEFAULT 0,
  sale_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Soft delete
  deleted_at timestamptz NULL,
  deleted_by uuid NULL,
  delete_reason text NULL,

  CONSTRAINT meeting_accessories_pkey PRIMARY KEY (id),
  CONSTRAINT meeting_accessories_cost_price_check CHECK (cost_price >= 0::numeric),
  CONSTRAINT meeting_accessories_sale_price_check CHECK (sale_price >= 0::numeric),

  CONSTRAINT meeting_accessories_meeting_id_fkey
    FOREIGN KEY (meeting_id) REFERENCES public.meetings (id) ON DELETE CASCADE,

  CONSTRAINT meeting_accessories_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients (id) ON DELETE RESTRICT,

  CONSTRAINT meeting_accessories_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS meeting_accessories_pkey
  ON public.meeting_accessories USING btree (id);

CREATE INDEX IF NOT EXISTS meeting_accessories_org_id_idx
  ON public.meeting_accessories USING btree (org_id);

CREATE INDEX IF NOT EXISTS meeting_accessories_meeting_id_idx
  ON public.meeting_accessories USING btree (meeting_id);

CREATE INDEX IF NOT EXISTS meeting_accessories_patient_id_idx
  ON public.meeting_accessories USING btree (patient_id);

CREATE INDEX IF NOT EXISTS meeting_accessories_deleted_at_idx
  ON public.meeting_accessories USING btree (deleted_at);

-- Performance: common filters (org + active/deleted)
CREATE INDEX IF NOT EXISTS meeting_accessories_org_deleted_at_idx
  ON public.meeting_accessories USING btree (org_id, deleted_at);

-- ============================================================
-- SOFT DELETE TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trg_meeting_accessories_soft_delete_stamp ON public.meeting_accessories;

CREATE TRIGGER trg_meeting_accessories_soft_delete_stamp
BEFORE UPDATE OF deleted_at, deleted_by ON public.meeting_accessories
FOR EACH ROW
EXECUTE FUNCTION public.trg_soft_delete_set_deleted_by();

-- ============================================================
-- RPCs (soft delete + restore)
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_meeting_accessories(
  p_id uuid,
  p_reason text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.meeting_accessories
  SET deleted_at = now(),
      deleted_by = auth.uid(),
      delete_reason = p_reason
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_meeting_accessories(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.meeting_accessories
  SET deleted_at = NULL,
      deleted_by = NULL,
      delete_reason = NULL
  WHERE id = p_id
    AND org_id = public.current_user_org_id();
END;
$function$;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.meeting_accessories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meeting_accessories_service_full_access ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_select_by_org_and_meeting_type ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_insert_by_org_and_meeting_type ON public.meeting_accessories;
DROP POLICY IF EXISTS meeting_accessories_update_by_org_and_meeting_type ON public.meeting_accessories;

-- service_role bypass
CREATE POLICY meeting_accessories_service_full_access
ON public.meeting_accessories
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Meeting-type gating via join to meetings (staff cannot access reference meetings)
CREATE POLICY meeting_accessories_select_by_org_and_meeting_type
ON public.meeting_accessories
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
      WHERE m.id = meeting_accessories.meeting_id
        AND m.org_id = meeting_accessories.org_id
        AND (
          public.current_user_role() = 'admin'
          OR m.meeting_type <> 'reference'::text
        )
    )
  )
);

CREATE POLICY meeting_accessories_insert_by_org_and_meeting_type
ON public.meeting_accessories
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
      WHERE m.id = meeting_accessories.meeting_id
        AND m.org_id = meeting_accessories.org_id
        AND (
          public.current_user_role() = 'admin'
          OR m.meeting_type <> 'reference'::text
        )
    )
  )
);

CREATE POLICY meeting_accessories_update_by_org_and_meeting_type
ON public.meeting_accessories
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
      WHERE m.id = meeting_accessories.meeting_id
        AND m.org_id = meeting_accessories.org_id
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
      WHERE m.id = meeting_accessories.meeting_id
        AND m.org_id = meeting_accessories.org_id
        AND (
          public.current_user_role() = 'admin'
          OR m.meeting_type <> 'reference'::text
        )
    )
  )
);

-- NO authenticated DELETE policy (hard delete disabled by privileges)

-- ============================================================
-- GRANTS (RLS still applies)
-- ============================================================

REVOKE ALL ON TABLE public.meeting_accessories FROM anon;
REVOKE ALL ON TABLE public.meeting_accessories FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.meeting_accessories TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.meeting_accessories
TO service_role;
