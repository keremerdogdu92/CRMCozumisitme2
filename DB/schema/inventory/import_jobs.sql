-- db/schema/inventory/import_jobs.sql
-- Purpose: Supabase table definition for `import_jobs`.
-- Tracks bulk import operations (inventory, patients, trials, legacy patient devices) with status and error metadata.
-- Includes: CREATE TABLE, constraints, enum-like checks and RLS.
-- Source of truth: Supabase table editor / migrations.

CREATE TABLE public.import_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  target_entity text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  source_filename text NULL,
  row_count integer NULL DEFAULT 0,
  error_count integer NULL DEFAULT 0,
  created_at timestamp with time zone NULL DEFAULT now(),
  created_by uuid NULL,
  finished_at timestamp with time zone NULL,
  error_message text NULL,

  CONSTRAINT import_jobs_pkey PRIMARY KEY (id),

  CONSTRAINT import_jobs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id),

  CONSTRAINT import_jobs_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.orgs (id) ON DELETE CASCADE,

  CONSTRAINT import_jobs_status_check CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'processing'::text,
        'completed'::text,
        'failed'::text
      ]
    )
  ),

  -- [UPDATED] target_entity: inventory / patients / trials / legacy_patient_devices
  CONSTRAINT import_jobs_target_entity_check CHECK (
    target_entity = ANY (
      ARRAY[
        'inventory'::text,
        'patients'::text,
        'trials'::text,
        'legacy_patient_devices'::text
      ]
    )
  )
) TABLESPACE pg_default;

-- ============================================================
-- RLS POLICIES FOR public.import_jobs
-- ============================================================

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- service_role full access
CREATE POLICY import_jobs_service_full_access
ON public.import_jobs
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- org-level SELECT
CREATE POLICY import_jobs_org_select
ON public.import_jobs
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = import_jobs.org_id
  )
);

-- org-level INSERT (staff + admin)
CREATE POLICY import_jobs_org_insert
ON public.import_jobs
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = import_jobs.org_id
  )
);

-- admin-only UPDATE
CREATE POLICY import_jobs_admin_update
ON public.import_jobs
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = import_jobs.org_id
      AND p.role = 'admin'::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = import_jobs.org_id
      AND p.role = 'admin'::text
  )
);

-- admin-only DELETE
CREATE POLICY import_jobs_admin_delete
ON public.import_jobs
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = import_jobs.org_id
      AND p.role = 'admin'::text
  )
);
