-- db/schema/catalog/device_catalog_models.sql
-- Purpose: Supabase table definition for `public.device_catalog_models`.
-- Stores per-organisation device catalog models (brand/model/type) used by catalog import and pricing history.
--
-- DB parity notes (from live DB output you provided):
-- - RLS: enabled, not forced.
-- - Constraints: PK(id), FK(org_id -> orgs.id ON DELETE CASCADE), CHECK(item_type in hearing_aid/charger/receiver/battery).
-- - Indexes: only PK btree(id).
-- - Triggers: none.
-- - Policies: exactly ONE SELECT policy named `device_catalog_models_select_own_org`, roles = {public}.
-- - Grants: anon/authenticated/service_role have table privileges (RLS still applies).
--
-- v1.0.1:
-- - Align policies with DB (single SELECT policy for role public).
-- - Keep grants aligned with DB output.

-- -----------------------------
-- Table
-- -----------------------------
create table if not exists public.device_catalog_models (
  id uuid not null default gen_random_uuid(),
  org_id uuid not null,
  brand text not null,
  model text not null,
  item_type text not null,
  battery_type text null,
  details text null,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz null default now(),
  updated_at timestamptz null default now(),
  constraint device_catalog_models_pkey primary key (id),
  constraint device_catalog_models_org_id_fkey
    foreign key (org_id) references public.orgs (id) on delete cascade,
  constraint device_catalog_models_item_type_check
    check (
      item_type = any (array[
        'hearing_aid'::text,
        'charger'::text,
        'receiver'::text,
        'battery'::text
      ])
    )
);

-- -----------------------------
-- Indexes (DB has only the PK index)
-- -----------------------------
-- Note: Postgres auto-creates the PK index; Supabase introspection showed it explicitly.
create unique index if not exists device_catalog_models_pkey
  on public.device_catalog_models using btree (id);

-- -----------------------------
-- RLS
-- -----------------------------
alter table public.device_catalog_models enable row level security;

-- -----------------------------
-- Policies (DB parity: exactly one SELECT policy, role = public)
-- -----------------------------
drop policy if exists device_catalog_models_select_own_org on public.device_catalog_models;

create policy device_catalog_models_select_own_org
on public.device_catalog_models
as permissive
for select
to public
using (
  org_id = (
    select p.org_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

-- -----------------------------
-- Grants (mirrors DB output you sent)
-- -----------------------------
grant select, insert, update, delete, truncate, references, trigger
on table public.device_catalog_models
to anon, authenticated, service_role;
