-- DB/schema/patients/patients_import_rows.sql
-- Purpose: Staging table for patients CSV imports.
-- Flow: CSV → import_jobs + patients_import_rows → processing → patients.
-- Each row represents a single CSV row, with raw data, normalized payload,
-- validation status and optional error/duplicate info.
--
-- Source of truth: Supabase table editor / migrations.
--
-- Notes:
-- - org_id should always match the org_id of the related import_jobs row.
--   The application layer is responsible for keeping them consistent.
-- - RLS is aligned with patients/import_jobs: users can only see rows
--   for their own org; service_role can see all.

CREATE TABLE public.patients_import_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  job_id uuid NOT NULL,
  row_index integer NOT NULL,
  raw_row jsonb NOT NULL,
  normalized_payload jsonb NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text NULL,
  duplicate_of_patient_id uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  validated_at timestamp with time zone NULL,
  imported_at timestamp with time zone NULL,
  CONSTRAINT patients_import_rows_pkey PRIMARY KEY (id),
  CONSTRAINT patients_import_rows_org_id_fkey FOREIGN KEY (org_id)
    REFERENCES public.orgs (id) ON DELETE CASCADE,
  CONSTRAINT patients_import_rows_job_id_fkey FOREIGN KEY (job_id)
    REFERENCES public.import_jobs (id) ON DELETE CASCADE,
  CONSTRAINT patients_import_rows_duplicate_patient_fkey FOREIGN KEY (duplicate_of_patient_id)
    REFERENCES public.patients (id) ON DELETE SET NULL,
  CONSTRAINT patients_import_rows_status_check CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'validated'::text,
        'error'::text,
        'imported'::text
      ]
    )
  )
) TABLESPACE pg_default;

-- Helpful indexes for import processing (by job and status).
CREATE INDEX patients_import_rows_job_id_idx
  ON public.patients_import_rows (job_id);

CREATE INDEX patients_import_rows_job_status_idx
  ON public.patients_import_rows (job_id, status);

CREATE INDEX patients_import_rows_org_id_idx
  ON public.patients_import_rows (org_id);

-- ============================================================
-- RLS POLICIES FOR public.patients_import_rows
-- Pattern is similar to patients/import_jobs:
--  - Service role can access all orgs.
--  - Authenticated users are restricted to their org_id.
--  - org_id is resolved from JWT user_metadata.org_id or JWT root org_id.
--
-- [TODO-SECURITY-BEFORE-PROD]
--   1) Decide a single org resolution strategy (user_metadata.org_id vs root org_id).
--   2) Remove redundant policies after settling on one strategy.
--   3) Review that clients never leak other orgs' import rows.
-- ============================================================

ALTER TABLE public.patients_import_rows ENABLE ROW LEVEL SECURITY;

-- 1) Debug policy: allow all rows for authenticated users (SELECT only).
--    [TODO-SECURITY-BEFORE-PROD] Remove or disable this policy.
CREATE POLICY "patients_import_rows_debug_allow_all"
ON public.patients_import_rows
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

-- 2) Authenticated INSERT: org_id must match JWT user_metadata.org_id.
CREATE POLICY "patients_import_rows_org_insert"
ON public.patients_import_rows
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
);

-- 3) Authenticated SELECT: org_id must match JWT user_metadata.org_id.
CREATE POLICY "patients_import_rows_org_select"
ON public.patients_import_rows
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
);

-- 4) Authenticated UPDATE: same org rule for both read and write sides.
CREATE POLICY "patients_import_rows_org_update"
ON public.patients_import_rows
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
)
WITH CHECK (
  (org_id)::text = ((auth.jwt() -> 'user_metadata'::text) ->> 'org_id'::text)
);

-- 5) Public SELECT: service_role bypass OR JWT root claim org_id match.
CREATE POLICY "patients_import_rows_select"
ON public.patients_import_rows
AS PERMISSIVE
FOR SELECT
TO public
USING (
  auth.role() = 'service_role'::text
  OR (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);

-- 6) Public ALL (INSERT/UPDATE/DELETE): service_role or JWT root claim org_id match.
CREATE POLICY "patients_import_rows_write"
ON public.patients_import_rows
AS PERMISSIVE
FOR ALL
TO public
USING (
  auth.role() = 'service_role'::text
  OR (org_id)::text = (auth.jwt() ->> 'org_id'::text)
)
WITH CHECK (
  auth.role() = 'service_role'::text
  OR (org_id)::text = (auth.jwt() ->> 'org_id'::text)
);
