-- DB/schema/_migrations_apply_latest.sql
-- Purpose: Apply multi-org helper-based RLS to trials, trial_devices, inventory_items, meetings.
-- Safe to run multiple times (DROP POLICY IF EXISTS).

BEGIN;

-- trials
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trials_service_full_access" ON public.trials;
DROP POLICY IF EXISTS "trials_org_select" ON public.trials;
DROP POLICY IF EXISTS "trials_org_insert" ON public.trials;
DROP POLICY IF EXISTS "trials_org_update" ON public.trials;
DROP POLICY IF EXISTS "trials_org_delete" ON public.trials;

CREATE POLICY "trials_service_full_access"
ON public.trials
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "trials_org_select"
ON public.trials
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (deleted_at IS NULL OR public.current_user_role() = 'admin')
  )
);

CREATE POLICY "trials_org_insert"
ON public.trials
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

CREATE POLICY "trials_org_update"
ON public.trials
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

CREATE POLICY "trials_org_delete"
ON public.trials
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- trial_devices
ALTER TABLE public.trial_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trial_devices_service_full_access" ON public.trial_devices;
DROP POLICY IF EXISTS "trial_devices_org_select" ON public.trial_devices;
DROP POLICY IF EXISTS "trial_devices_org_insert" ON public.trial_devices;
DROP POLICY IF EXISTS "trial_devices_org_update" ON public.trial_devices;
DROP POLICY IF EXISTS "trial_devices_org_delete" ON public.trial_devices;

CREATE POLICY "trial_devices_service_full_access"
ON public.trial_devices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "trial_devices_org_select"
ON public.trial_devices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

CREATE POLICY "trial_devices_org_insert"
ON public.trial_devices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

CREATE POLICY "trial_devices_org_update"
ON public.trial_devices
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

CREATE POLICY "trial_devices_org_delete"
ON public.trial_devices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- inventory_items
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_items_service_full_access" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_select_by_org" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert_by_org" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_update_by_org" ON public.inventory_items;

CREATE POLICY "inventory_items_service_full_access"
ON public.inventory_items
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "inventory_items_select_by_org"
ON public.inventory_items
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

CREATE POLICY "inventory_items_insert_by_org"
ON public.inventory_items
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

CREATE POLICY "inventory_items_update_by_org"
ON public.inventory_items
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id = public.current_user_org_id())
);

-- meetings
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meetings_select_by_org_and_type" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert_by_org_and_type" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update_by_org_and_type" ON public.meetings;

CREATE POLICY "meetings_select_by_org_and_type"
ON public.meetings
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

CREATE POLICY "meetings_insert_by_org_and_type"
ON public.meetings
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

CREATE POLICY "meetings_update_by_org_and_type"
ON public.meetings
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (
    org_id = public.current_user_org_id()
    AND (
      public.current_user_role() = 'admin'
      OR meeting_type <> 'reference'::text
    )
  )
);

COMMIT;
