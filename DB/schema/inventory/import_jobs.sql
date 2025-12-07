-- db/schema/inventory/import_jobs.sql
-- Purpose: Supabase table definition for `import_jobs`.
-- Tracks bulk import operations (inventory, patients, trials) with status and error metadata.
-- Includes: CREATE TABLE, constraints, and enum-like checks.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies will be added later.

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

  CONSTRAINT import_jobs_target_entity_check CHECK (
    target_entity = ANY (
      ARRAY[
        'inventory'::text,
        'patients'::text,
        'trials'::text
      ]
    )
  )
) TABLESPACE pg_default;

-- RLS POLICIES PLACEHOLDER
-- TODO: Paste Supabase RLS definitions for `public.import_jobs`.
--   ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ...;
