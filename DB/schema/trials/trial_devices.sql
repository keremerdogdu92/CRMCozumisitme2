-- db/schema/trials/trial_devices.sql
-- Purpose: Supabase table definition for `trial_devices`.
-- Stores quoted devices (brand/model/side/price) attached to a trial.
-- Includes: CREATE TABLE, constraints and RLS policies.
-- Source of truth: Supabase table editor / migrations.
--
-- [RLS NOTE]
--   - Backend (service_role) tüm org’lara bakabilir.
--   - Normal kullanıcılar sadece kendi org_id satırlarını görür / yazar.
--   - İleride istersen INSERT/UPDATE için trials.org_id ile extra cross-check
--     EXISTS bloğu eklenebilir.

CREATE TABLE public.trial_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  trial_id uuid NOT NULL,
  side text NULL,
  brand text NULL,
  model text NULL,
  quote_price numeric(12, 2) NULL,

  CONSTRAINT trial_devices_pkey PRIMARY KEY (id),

  CONSTRAINT trial_devices_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT trial_devices_trial_id_fkey
    FOREIGN KEY (trial_id) REFERENCES public.trials (id) ON DELETE CASCADE,

  CONSTRAINT trial_devices_side_check CHECK (
    side IS NULL
    OR side = ANY (
      ARRAY['left'::text, 'right'::text, 'both'::text]
    )
  )
) TABLESPACE pg_default;

-- =========================================================
-- RLS POLICIES FOR public.trial_devices
-- =========================================================

ALTER TABLE public.trial_devices ENABLE ROW LEVEL SECURITY;

-- Backend için full access (service_role)
CREATE POLICY "trial_devices_service_full_access"
ON public.trial_devices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Org-bazlı SELECT (normal kullanıcılar)
CREATE POLICY "trial_devices_org_select"
ON public.trial_devices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- Org-bazlı INSERT (normal kullanıcılar)
CREATE POLICY "trial_devices_org_insert"
ON public.trial_devices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
  -- Daha sıkı istersen:
  -- AND EXISTS (
  --   SELECT 1
  --   FROM public.trials t
  --   WHERE t.id = trial_devices.trial_id
  --     AND (t.org_id)::text = (auth.jwt() ->> 'org_id'::text)
  -- )
);

-- Org-bazlı UPDATE (normal kullanıcılar)
CREATE POLICY "trial_devices_org_update"
ON public.trial_devices
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
)
WITH CHECK (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- Org-bazlı DELETE (normal kullanıcılar)
CREATE POLICY "trial_devices_org_delete"
ON public.trial_devices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);
