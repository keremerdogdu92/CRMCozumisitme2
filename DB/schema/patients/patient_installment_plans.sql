-- db/schema/patient_installment_plans.sql
-- Purpose: Supabase table definition for `public.patient_installment_plans`.
-- Summary: Single active installment plan per (org_id, patient_id) enforced via partial unique index.
-- Source-of-truth: Mirrors current DB columns/constraints/indexes/RLS/policies/grants.
-- v1.0.1

create table if not exists public.patient_installment_plans (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  patient_id uuid not null,
  sale_total numeric not null,
  upfront_paid numeric not null default 0,
  installment_count integer not null,
  installment_amount numeric not null,
  first_due_date date not null,
  day_of_month integer not null,
  status text not null default 'active'::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null,
  constraint patient_installment_plans_pkey primary key (id),
  constraint patient_installment_plans_org_id_fkey
    foreign key (org_id) references public.orgs (id) on delete cascade,
  constraint patient_installment_plans_patient_id_fkey
    foreign key (patient_id) references public.patients (id) on delete cascade,
  constraint patient_installment_plans_created_by_fkey
    foreign key (created_by) references auth.users (id)
);

-- Indexes (DB-truth)
create unique index if not exists patient_installment_plans_pkey
  on public.patient_installment_plans using btree (id);

create unique index if not exists patient_installment_plans_org_patient_active_idx
  on public.patient_installment_plans using btree (org_id, patient_id)
  where (status = 'active'::text);

-- RLS
alter table public.patient_installment_plans enable row level security;

-- Policies (DB-truth)
drop policy if exists patient_installment_plans_org_select on public.patient_installment_plans;
create policy patient_installment_plans_org_select
  on public.patient_installment_plans
  for select
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists patient_installment_plans_org_write on public.patient_installment_plans;
create policy patient_installment_plans_org_write
  on public.patient_installment_plans
  for all
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  )
  with check (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists patient_installment_plans_service_full_access on public.patient_installment_plans;
create policy patient_installment_plans_service_full_access
  on public.patient_installment_plans
  for all
  to public
  using (auth.role() = 'service_role'::text)
  with check (auth.role() = 'service_role'::text);

-- Grants
revoke all on table public.patient_installment_plans from public;
grant all on table public.patient_installment_plans to authenticated;
grant all on table public.patient_installment_plans to service_role;
