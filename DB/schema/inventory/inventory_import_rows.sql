-- db/schema/inventory/inventory_import_rows.sql
-- Purpose: Supabase table definition for `inventory_import_rows`.
-- Stores per-row parsed/validated data for inventory CSV imports.
-- Includes: CREATE TABLE, constraints and RLS policies.
-- Source of truth: Supabase table editor / migrations.
--
-- NOTES:
--   - Rows are temporary staging data for CSV imports.
--   - Access is org-scoped via import_jobs + profiles.
--   - Housekeeping: old rows can be purged via
--       SELECT public.purge_old_inventory_import_rows();
--   - İş kuralları:
--       * brand / model / item_type / serial_no uygulama seviyesinde zorunlu.
--       * Bu alanlar eksikse valid = false ve satır import edilmez.

CREATE TABLE public.inventory_import_rows (
  id bigserial NOT NULL,
  job_id uuid NOT NULL,
  row_index integer NOT NULL,
  raw_brand text NULL,
  raw_model text NULL,
  raw_item_type text NULL,
  raw_barcode text NULL,
  raw_serial_no text NULL,
  raw_status text NULL,
  raw_purchase_price text NULL,
  raw_list_price text NULL,
  raw_purchase_date text NULL,
  raw_notes text NULL,
  valid boolean NULL DEFAULT false,
  validation_error text NULL,
  resolved_at timestamp with time zone NULL,
  resolved_by uuid NULL,
  resolved_inventory_item_id uuid NULL,
  resolution_note text NULL,

  CONSTRAINT inventory_import_rows_pkey PRIMARY KEY (id),

  CONSTRAINT inventory_import_rows_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES public.import_jobs (id) ON DELETE CASCADE,
  CONSTRAINT inventory_import_rows_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES auth.users (id) ON DELETE SET NULL,

  CONSTRAINT inventory_import_rows_resolved_inventory_item_id_fkey
    FOREIGN KEY (resolved_inventory_item_id) REFERENCES public.inventory_items (id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- ============================================================
-- RLS POLICIES FOR public.inventory_import_rows
-- ============================================================

ALTER TABLE public.inventory_import_rows ENABLE ROW LEVEL SECURITY;

-- Backend full access
CREATE POLICY inventory_import_rows_service_full_access
ON public.inventory_import_rows
AS PERMISSIVE
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Org-scoped SELECT
CREATE POLICY inventory_import_rows_org_select
ON public.inventory_import_rows
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.import_jobs j
    JOIN public.profiles p ON p.org_id = j.org_id
    WHERE j.id = inventory_import_rows.job_id
      AND p.id = auth.uid()
  )
);

-- Org-scoped write (INSERT/UPDATE/DELETE)
CREATE POLICY inventory_import_rows_org_write
ON public.inventory_import_rows
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.import_jobs j
    JOIN public.profiles p ON p.org_id = j.org_id
    WHERE j.id = inventory_import_rows.job_id
      AND p.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.import_jobs j
    JOIN public.profiles p ON p.org_id = j.org_id
    WHERE j.id = inventory_import_rows.job_id
      AND p.id = auth.uid()
  )
);
