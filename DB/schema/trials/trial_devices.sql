a-- db/schema/trials/trial_devices.sql
-- Purpose: Supabase table definition for `trial_devices`.
-- Stores quoted devices (brand/model/side/price) attached to a trial.
-- Includes: CREATE TABLE, constraints and RLS policies.
-- Source of truth: Supabase table editor / migrations.
--
-- [RLS ÖNCEKİ DURUM NOTU]
--   Supabase UI’de eski policy’ler:
--     - debug_allow_all_trial_devices (ALL, USING true)
--     - Org insert for trial_devices
--     - Org insert for trial_devices via trials
--     - trial_devices_select
--     - trial_devices_write
--   Bunlar, org izolasyonu net olmadığı için yeniden yazıldı.
--
-- [TODO-SOFT-DELETE]
--   - Şu anda DELETE policy’leri gerçek (hard) delete yapar.
--   - Soft delete geçişinde:
--       * tabloya deleted_at (ve opsiyonel deleted_by) kolonu eklenecek,
--       * normal kullanıcılar için DELETE policy kaldırılacak,
--       * uygulama DELETE yerine UPDATE ... SET deleted_at = now() kullanacak,
--       * SELECT/UPDATE RLS, deleted_at IS NULL şartı ile güncellenecek.
--   - Ayrıntılı plan için: db/docs/soft_delete_plan.md

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

-- ============================================================
-- RLS POLICIES FOR public.trial_devices
-- ============================================================

ALTER TABLE public.trial_devices ENABLE ROW LEVEL SECURITY;

-- 1) Backend için full access (service_role)
CREATE POLICY "trial_devices_service_full_access"
ON public.trial_devices
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- 2) Org-bazlı SELECT (normal kullanıcılar)
CREATE POLICY "trial_devices_org_select"
ON public.trial_devices
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- 3) Org-bazlı INSERT (normal kullanıcılar)
CREATE POLICY "trial_devices_org_insert"
ON public.trial_devices
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- 4) Org-bazlı UPDATE (normal kullanıcılar)
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

-- 5) Org-bazlı DELETE (normal kullanıcılar) – şu an HARD DELETE
CREATE POLICY "trial_devices_org_delete"
ON public.trial_devices
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);
