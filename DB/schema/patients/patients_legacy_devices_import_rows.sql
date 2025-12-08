-- DB/schema/patients/patients_legacy_devices_import_rows.sql
-- Staging table for legacy patient-device CSV imports.
-- Each row represents a device (or device pair) linked to a patient by national_id.
-- Final normalized payload will later be used to insert into devices + patient_devices.

create table if not exists public.patients_legacy_devices_import_rows (
  id uuid primary key default gen_random_uuid(),

  -- org scope
  org_id uuid not null references public.orgs (id) on delete cascade,

  -- import job linkage (reuse existing import_jobs)
  job_id uuid not null references public.import_jobs (id) on delete cascade,

  -- CSV row index (1-based, kept for error reporting)
  row_index integer not null,

  -- Raw CSV row as JSON (keys = header names)
  raw_row jsonb not null,

  -- Normalized payload after validation.
  -- Shape will match LegacyDeviceImportNormalizedPayload from frontend.
  normalized_payload jsonb,

  -- Import pipeline status
  status text not null default 'pending'
    check (status in ('pending', 'validated', 'error', 'imported')),

  -- Aggregated human-readable error/warning messages
  error_message text,

  -- If we later detect that this row corresponds to an already mapped device,
  -- we can optionally reference the final devices.id here.
  duplicate_of_device_id uuid,

  created_at timestamptz not null default now(),
  validated_at timestamptz,
  imported_at timestamptz
);

comment on table public.patients_legacy_devices_import_rows is
  'Staging rows for legacy patient-device CSV imports (per device or device pair).';

comment on column public.patients_legacy_devices_import_rows.raw_row is
  'Raw CSV row as JSON, kept for troubleshooting and re-validation.';

comment on column public.patients_legacy_devices_import_rows.normalized_payload is
  'Validated, normalized payload ready to be used for inserting devices + patient_devices.';
