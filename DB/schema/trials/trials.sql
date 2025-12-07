-- db/schema/trials/trials.sql
-- Purpose: Supabase table definition for `trials`.
-- Represents trial customers (deneme kullanıcıları) before becoming patients.
-- Includes: CREATE TABLE, constraints and RLS policies.
-- Source of truth: Supabase table editor / migrations.
--
-- [TODO-SECURITY-BEFORE-PROD]
--   1) Tek bir org çözüm stratejisine standardize et:
--        - auth.jwt()->>'org_id' (şu an bu dosyada kullanılan)
--        - veya public.profiles.org_id
--      Sonra patients / trial_devices / meetings vb. hepsini aynı modele çek.
--   2) Mevcut client’ların JWT’lerinde org_id claim’inin geldiğinden emin ol.
--   3) Gerekirse sadece SELECT için extra read-only policy ekleyebilirsin
--      ama yine org_id filtresi ile.
--   4) Regression:
--      - Tek klinik senaryosu (CRUD)
--      - Çoklu klinik senaryosu (org izolasyonu)
--      - service_role ile tüm org’lara erişim.
--
-- [TODO-SOFT-DELETE]
--   - Şu anda DELETE policy’leri gerçek (hard) delete yapar.
--   - Soft delete geçişinde:
--       * tabloya deleted_at (ve opsiyonel deleted_by) kolonu eklenecek,
--       * normal kullanıcılar için DELETE policy kaldırılacak,
--       * uygulama DELETE yerine UPDATE ... SET deleted_at = now() kullanacak,
--       * SELECT/UPDATE RLS, deleted_at IS NULL şartı ile güncellenecek.
--   - Ayrıntılı plan için: db/docs/soft_delete_plan.md

CREATE TABLE public.trials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  full_name text NULL,
  phone text NULL,
  first_meet_at timestamp with time zone NULL,
  next_meet_at timestamp with time zone NULL,
  reference_id uuid NULL,
  created_at timestamp with time zone NULL DEFAULT now(),

  CONSTRAINT trials_pkey PRIMARY KEY (id),

  CONSTRAINT trials_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- ============================================================
-- RLS POLICIES FOR public.trials
-- ============================================================

ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;

-- 1) Backend için full access (service_role)
CREATE POLICY "trials_service_full_access"
ON public.trials
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- 2) Org-bazlı SELECT (normal kullanıcılar)
CREATE POLICY "trials_org_select"
ON public.trials
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- 3) Org-bazlı INSERT (normal kullanıcılar)
CREATE POLICY "trials_org_insert"
ON public.trials
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- 4) Org-bazlı UPDATE (normal kullanıcılar)
CREATE POLICY "trials_org_update"
ON public.trials
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
CREATE POLICY "trials_org_delete"
ON public.trials
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);
