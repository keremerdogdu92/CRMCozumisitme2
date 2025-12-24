-- db/schema/public/meeting_payments.sql
-- Purpose: Supabase table definition for `public.meeting_payments`.
-- Summary: Payment rows linked to meetings + patients.
-- Source-of-truth: Mirrors current DB columns/constraints/indexes/RLS/policies/grants.
-- v1.0.1

create table if not exists public.meeting_payments (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  meeting_id uuid not null,
  patient_id uuid not null,
  amount numeric not null,
  method text not null default 'Senet'::text,
  note text null,
  created_at timestamptz not null default now(),
  constraint meeting_payments_pkey primary key (id),
  constraint meeting_payments_amount_check check (amount > 0::numeric),
  constraint meeting_payments_method_check check (
    method = any (array[
      'Tim'::text,
      'Sivantos'::text,
      'Kredi_Kartı'::text,
      'Nakit'::text,
      'Senet'::text
    ])
  ),
  constraint meeting_payments_meeting_id_fkey
    foreign key (meeting_id) references public.meetings (id) on delete cascade,
  constraint meeting_payments_patient_id_fkey
    foreign key (patient_id) references public.patients (id) on delete restrict
);

-- Indexes (DB-truth)
create unique index if not exists meeting_payments_pkey
  on public.meeting_payments using btree (id);

create index if not exists idx_meeting_payments_org_id
  on public.meeting_payments using btree (org_id);

create index if not exists idx_meeting_payments_meeting_id
  on public.meeting_payments using btree (meeting_id);

create index if not exists idx_meeting_payments_patient_id
  on public.meeting_payments using btree (patient_id);

-- RLS
alter table public.meeting_payments enable row level security;

-- Policies (DB-truth)
drop policy if exists meeting_payments_select_by_org on public.meeting_payments;
create policy meeting_payments_select_by_org
  on public.meeting_payments
  for select
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists meeting_payments_insert_by_org on public.meeting_payments;
create policy meeting_payments_insert_by_org
  on public.meeting_payments
  for insert
  to authenticated
  with check (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists meeting_payments_update_by_org on public.meeting_payments;
create policy meeting_payments_update_by_org
  on public.meeting_payments
  for update
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  )
  with check (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists meeting_payments_service_full_access on public.meeting_payments;
create policy meeting_payments_service_full_access
  on public.meeting_payments
  for all
  to public
  using (auth.role() = 'service_role'::text)
  with check (auth.role() = 'service_role'::text);

-- Grants
revoke all on table public.meeting_payments from public;
grant all on table public.meeting_payments to authenticated;
grant all on table public.meeting_payments to service_role;
