-- db/schema/public/patients_legacy_devices_import_rows.sql
-- Purpose: Supabase table definition for `public.patients_legacy_devices_import_rows`.
-- Summary: Per-row staging for legacy device imports (raw+normalized payload, status, error tracking).
-- Source-of-truth: Mirrors current DB columns/constraints/indexes/RLS/policies/grants.
-- v1.0.1

create table if not exists public.patients_legacy_devices_import_rows (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  job_id uuid not null,
  row_index integer not null,
  raw_row jsonb not null,
  normalized_payload jsonb null,
  status text not null default 'pending'::text,
  error_message text null,
  duplicate_of_device_id uuid null,
  created_at timestamptz not null default now(),
  validated_at timestamptz null,
  imported_at timestamptz null,
  constraint patients_legacy_devices_import_rows_pkey primary key (id),
  constraint patients_legacy_devices_import_rows_status_check
    check (status = any (array[
      'pending'::text,
      'validated'::text,
      'error'::text,
      'imported'::text
    ])),
  constraint patients_legacy_devices_import_rows_org_id_fkey
    foreign key (org_id) references public.orgs (id) on delete cascade,
  constraint patients_legacy_devices_import_rows_job_id_fkey
    foreign key (job_id) references public.import_jobs (id) on delete cascade
);

-- Indexes (DB-truth)
create unique index if not exists patients_legacy_devices_import_rows_pkey
  on public.patients_legacy_devices_import_rows using btree (id);

-- RLS
alter table public.patients_legacy_devices_import_rows enable row level security;

-- Policies (DB-truth)
drop policy if exists patients_legacy_devices_import_rows_select_by_org on public.patients_legacy_devices_import_rows;
create policy patients_legacy_devices_import_rows_select_by_org
  on public.patients_legacy_devices_import_rows
  for select
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists patients_legacy_devices_import_rows_write_by_org on public.patients_legacy_devices_import_rows;
create policy patients_legacy_devices_import_rows_write_by_org
  on public.patients_legacy_devices_import_rows
  for all
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  )
  with check (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists patients_legacy_devices_import_rows_service_full_access on public.patients_legacy_devices_import_rows;
create policy patients_legacy_devices_import_rows_service_full_access
  on public.patients_legacy_devices_import_rows
  for all
  to public
  using (auth.role() = 'service_role'::text)
  with check (auth.role() = 'service_role'::text);

-- Grants
revoke all on table public.patients_legacy_devices_import_rows from public;
grant all on table public.patients_legacy_devices_import_rows to authenticated;
grant all on table public.patients_legacy_devices_import_rows to service_role;
