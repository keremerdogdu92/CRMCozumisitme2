-- db/schema/public/meeting_accessories.sql
-- Purpose: Supabase table definition for `public.meeting_accessories`.
-- Summary: Accessory line-items attached to meetings and patients.
-- Source-of-truth: Mirrors current DB columns/constraints/indexes/RLS/policies/grants.
-- v1.0.1

create table if not exists public.meeting_accessories (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  meeting_id uuid not null,
  patient_id uuid not null,
  name text not null,
  cost_price numeric not null default 0,
  sale_price numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint meeting_accessories_pkey primary key (id),
  constraint meeting_accessories_cost_price_check check (cost_price >= 0::numeric),
  constraint meeting_accessories_sale_price_check check (sale_price >= 0::numeric),
  constraint meeting_accessories_meeting_id_fkey
    foreign key (meeting_id) references public.meetings (id) on delete cascade,
  constraint meeting_accessories_patient_id_fkey
    foreign key (patient_id) references public.patients (id) on delete restrict
);

-- Indexes (DB-truth)
create unique index if not exists meeting_accessories_pkey
  on public.meeting_accessories using btree (id);

create index if not exists idx_meeting_accessories_org_id
  on public.meeting_accessories using btree (org_id);

create index if not exists idx_meeting_accessories_meeting_id
  on public.meeting_accessories using btree (meeting_id);

create index if not exists idx_meeting_accessories_patient_id
  on public.meeting_accessories using btree (patient_id);

-- RLS
alter table public.meeting_accessories enable row level security;

-- Policies (DB-truth)
drop policy if exists meeting_accessories_select_by_org on public.meeting_accessories;
create policy meeting_accessories_select_by_org
  on public.meeting_accessories
  for select
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists meeting_accessories_insert_by_org on public.meeting_accessories;
create policy meeting_accessories_insert_by_org
  on public.meeting_accessories
  for insert
  to authenticated
  with check (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists meeting_accessories_update_by_org on public.meeting_accessories;
create policy meeting_accessories_update_by_org
  on public.meeting_accessories
  for update
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  )
  with check (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists meeting_accessories_service_full_access on public.meeting_accessories;
create policy meeting_accessories_service_full_access
  on public.meeting_accessories
  for all
  to public
  using (auth.role() = 'service_role'::text)
  with check (auth.role() = 'service_role'::text);

-- Grants
revoke all on table public.meeting_accessories from public;
grant all on table public.meeting_accessories to authenticated;
grant all on table public.meeting_accessories to service_role;
