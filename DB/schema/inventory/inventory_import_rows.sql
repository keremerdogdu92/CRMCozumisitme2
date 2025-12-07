-- db/schema/inventory/inventory_import_rows.sql
-- Purpose: Supabase table definition for `inventory_import_rows`.
-- Stores per-row parsed/validated data for inventory CSV imports.
-- Includes: CREATE TABLE + constraints.
-- Source of truth: Supabase table editor / migrations.
-- NOTE: RLS policies will be added separately.

CREATE TABLE public.inventory_import_rows (
  id bigserial NOT NULL,
  job_id uuid NOT NULL,
  row_index integer NOT NULL,
  raw_brand text NULL,
  raw_model text NULL,
  raw_item_type text NULL,
  raw_barcode text NULL,
  raw_serial_no text NULL,
  raw_ear_side text NULL,
  raw_status text NULL,
  raw_purchase_price text NULL,
  raw_list_price text NULL,
  raw_notes text NULL,
  valid boolean NULL DEFAULT false,
  validation_error text NULL,

  CONSTRAINT inventory_import_rows_pkey PRIMARY KEY (id),

  CONSTRAINT inventory_import_rows_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES public.import_jobs (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- RLS POLICIES PLACEHOLDER
-- TODO: Paste Supabase RLS definitions for `public.inventory_import_rows`.
--   ALTER TABLE public.inventory_import_rows ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY ...;
