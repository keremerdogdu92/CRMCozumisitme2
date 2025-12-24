-- db/schema/public/patient_sale_breakdown.sql
-- Purpose: Supabase table definition for `public.patient_sale_breakdown`.
-- Summary: Captures sale split rows (method/amount) per patient+org.
-- Source-of-truth: Mirrors current DB columns/constraints/indexes/RLS/policies/grants.
-- v1.0.1

create table if not exists public.patient_sale_breakdown (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  patient_id uuid not null,
  method text not null,
  amount numeric not null,
  note text null,
  created_at timestamptz not null default now(),
  created_by uuid null,
  constraint patient_sale_breakdown_pkey primary key (id),
  constraint fk_patient_sale_breakdown_patient
    foreign key (patient_id) references public.patients (id) on delete cascade
);

-- Indexes (DB-truth)
create unique index if not exists patient_sale_breakdown_pkey
  on public.patient_sale_breakdown using btree (id);

create index if not exists idx_patient_sale_breakdown_patient
  on public.patient_sale_breakdown using btree (patient_id);

create index if not exists idx_patient_sale_breakdown_org_patient
  on public.patient_sale_breakdown using btree (org_id, patient_id);

-- RLS
alter table public.patient_sale_breakdown enable row level security;

-- Policies (DB-truth)
drop policy if exists patient_sale_breakdown_select_by_org on public.patient_sale_breakdown;
create policy patient_sale_breakdown_select_by_org
  on public.patient_sale_breakdown
  for select
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists patient_sale_breakdown_insert_by_org on public.patient_sale_breakdown;
create policy patient_sale_breakdown_insert_by_org
  on public.patient_sale_breakdown
  for insert
  to authenticated
  with check (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists patient_sale_breakdown_update_by_org on public.patient_sale_breakdown;
create policy patient_sale_breakdown_update_by_org
  on public.patient_sale_breakdown
  for update
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  )
  with check (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists patient_sale_breakdown_service_full_access on public.patient_sale_breakdown;
create policy patient_sale_breakdown_service_full_access
  on public.patient_sale_breakdown
  for all
  to public
  using (auth.role() = 'service_role'::text)
  with check (auth.role() = 'service_role'::text);

-- Grants
revoke all on table public.patient_sale_breakdown from public;
grant all on table public.patient_sale_breakdown to authenticated;
grant all on table public.patient_sale_breakdown to service_role;
