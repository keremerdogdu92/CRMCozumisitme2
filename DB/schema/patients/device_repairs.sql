-- db/schema/device_repairs.sql
-- Purpose: Supabase table definition for `public.device_repairs`.
-- Summary: Repairs workflow tracking per org, with status lifecycle and timeline timestamps.
-- Source-of-truth: Mirrors current DB columns/constraints/indexes/RLS/policies/grants.
-- v1.0.1

create table if not exists public.device_repairs (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  device_id uuid null,
  patient_id uuid null,
  sent_at timestamptz null,
  returned_at timestamptz null,
  cost numeric null default 0,
  note text null,
  meeting_id uuid null,
  inventory_item_id uuid null,
  status text not null default 'created'::text,
  reason_note text null,
  cargo_company text null,
  cargo_tracking_no text null,
  shipped_at timestamptz null,
  returned_to_clinic_at timestamptz null,
  delivered_to_patient_at timestamptz null,
  expected_delivery_meeting_id uuid null,
  last_status_changed timestamptz not null default now(),
  constraint device_repairs_pkey primary key (id),
  constraint device_repairs_status_check
    check (status = any (array[
      'created'::text,
      'shipped'::text,
      'returned_waiting_meeting'::text,
      'scheduled'::text,
      'delivered'::text,
      'cancelled'::text
    ])),
  constraint device_repairs_org_id_fkey
    foreign key (org_id) references public.orgs (id) on delete cascade,
  constraint device_repairs_device_id_fkey
    foreign key (device_id) references public.devices (id) on delete set null,
  constraint device_repairs_patient_id_fkey
    foreign key (patient_id) references public.patients (id) on delete set null,
  constraint device_repairs_meeting_id_fkey
    foreign key (meeting_id) references public.meetings (id) on delete set null,
  constraint device_repairs_inventory_item_id_fkey
    foreign key (inventory_item_id) references public.inventory_items (id) on delete set null,
  constraint device_repairs_expected_delivery_meeting_id_fkey
    foreign key (expected_delivery_meeting_id) references public.meetings (id) on delete set null
);

-- Indexes (DB-truth)
create unique index if not exists device_repairs_pkey
  on public.device_repairs using btree (id);

create index if not exists device_repairs_active_idx
  on public.device_repairs using btree (org_id, status)
  where (status = any (array[
    'created'::text,
    'shipped'::text,
    'returned_waiting_meeting'::text,
    'scheduled'::text
  ]));

create index if not exists device_repairs_inventory_idx
  on public.device_repairs using btree (inventory_item_id);

create index if not exists device_repairs_org_patient_idx
  on public.device_repairs using btree (org_id, patient_id);

-- RLS
alter table public.device_repairs enable row level security;

-- Policies (DB-truth)
drop policy if exists device_repairs_org_select on public.device_repairs;
create policy device_repairs_org_select
  on public.device_repairs
  for select
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists device_repairs_org_write on public.device_repairs;
create policy device_repairs_org_write
  on public.device_repairs
  for all
  to authenticated
  using (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  )
  with check (
    (auth.role() = 'service_role'::text) or (org_id = current_user_org_id())
  );

drop policy if exists device_repairs_service_full_access on public.device_repairs;
create policy device_repairs_service_full_access
  on public.device_repairs
  for all
  to public
  using (auth.role() = 'service_role'::text)
  with check (auth.role() = 'service_role'::text);

-- Grants
revoke all on table public.device_repairs from public;
grant all on table public.device_repairs to authenticated;
grant all on table public.device_repairs to service_role;
