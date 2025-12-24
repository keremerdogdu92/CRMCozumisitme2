-- db/schema/catalog/device_catalog_prices.sql
-- Purpose: Supabase table definition for `public.device_catalog_prices`.
-- Stores price history for catalog models with an effective date (valid_from).
--
-- DB parity notes (from live DB output you provided):
-- - RLS: enabled, not forced.
-- - Columns: id, model_id, valid_from, list_price, purchase_price, created_at.
-- - Constraints: PK(id), FK(model_id -> device_catalog_models.id ON DELETE CASCADE).
-- - Indexes: unique (model_id, valid_from) + PK btree(id).
-- - Triggers: none.
-- - Policies: exactly ONE SELECT policy named `device_catalog_prices_select_via_model_org`, roles = {public}.
-- - Grants: anon/authenticated/service_role have table privileges (RLS still applies).
--
-- v1.0.0:
-- - Adds table, constraints, indexes, RLS, policy (select only), grants.

-- -----------------------------
-- Table
-- -----------------------------
create table if not exists public.device_catalog_prices (
  id uuid not null default gen_random_uuid(),
  model_id uuid not null,
  valid_from date not null,
  list_price numeric not null,
  purchase_price numeric not null,
  created_at timestamptz null default now(),
  constraint device_catalog_prices_pkey primary key (id),
  constraint device_catalog_prices_model_id_fkey
    foreign key (model_id) references public.device_catalog_models (id) on delete cascade
);

-- -----------------------------
-- Indexes
-- -----------------------------
create unique index if not exists device_catalog_prices_pkey
  on public.device_catalog_prices using btree (id);

create unique index if not exists device_catalog_prices_model_date_uidx
  on public.device_catalog_prices using btree (model_id, valid_from);

-- -----------------------------
-- RLS
-- -----------------------------
alter table public.device_catalog_prices enable row level security;

-- -----------------------------
-- Policies (DB parity: exactly one SELECT policy, role = public)
-- -----------------------------
drop policy if exists device_catalog_prices_select_via_model_org on public.device_catalog_prices;

create policy device_catalog_prices_select_via_model_org
on public.device_catalog_prices
as permissive
for select
to public
using (
  exists (
    select 1
    from public.device_catalog_models m
    where m.id = public.device_catalog_prices.model_id
      and m.org_id = (
        select p.org_id
        from public.profiles p
        where p.id = auth.uid()
      )
  )
);

-- -----------------------------
-- Grants (mirrors DB output you sent)
-- -----------------------------
grant select, insert, update, delete, truncate, references, trigger
on table public.device_catalog_prices
to anon, authenticated, service_role;
