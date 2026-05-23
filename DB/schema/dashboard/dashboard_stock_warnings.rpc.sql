-- DB/schema/dashboard/dashboard_stock_warnings.rpc.sql
-- Org-scoped model-level stock warnings for dashboard.

drop function if exists public.dashboard_stock_warnings(int, uuid);

create or replace function public.dashboard_stock_warnings(
  _limit int default 10,
  _org_id uuid default null
) returns table (
  catalog_model_id uuid,
  brand text,
  model text,
  item_type text,
  in_stock_count bigint,
  minimum_stock integer,
  threshold_scope text,
  severity text
) language sql stable
set search_path = public, pg_temp
as $$
with org_ctx as (
  select
    case
      when auth.role() = 'service_role'::text then _org_id
      else (select p.org_id from public.profiles p where p.id = auth.uid())
    end as org_id
), model_stock as (
  select
    m.id as catalog_model_id,
    m.brand,
    m.model,
    m.item_type,
    count(i.id) as in_stock_count
  from public.device_catalog_models m
  join org_ctx o on o.org_id is not null and o.org_id = m.org_id
  left join public.inventory_items i
    on i.org_id = m.org_id
   and i.deleted_at is null
   and i.status = 'in_stock'
   and i.item_type = m.item_type
   and (
     i.catalog_model_id = m.id
     or (
       i.catalog_model_id is null
       and public.catalog_model_match_key(i.brand, i.model, i.item_type)
         = public.catalog_model_match_key(m.brand, m.model, m.item_type)
     )
   )
  where m.deleted_at is null
    and m.is_active = true
  group by m.id, m.brand, m.model, m.item_type
), effective_thresholds as (
  select
    ms.catalog_model_id,
    ms.brand,
    ms.model,
    ms.item_type,
    ms.in_stock_count,
    coalesce(model_t.minimum_stock, general_t.minimum_stock) as minimum_stock,
    case
      when model_t.id is not null then 'model'
      when general_t.id is not null then 'general'
      else null
    end as threshold_scope
  from model_stock ms
  left join public.inventory_stock_thresholds model_t
    on model_t.org_id = (select org_id from org_ctx)
   and model_t.catalog_model_id = ms.catalog_model_id
  left join public.inventory_stock_thresholds general_t
    on general_t.org_id = (select org_id from org_ctx)
   and general_t.catalog_model_id is null
   and general_t.item_type = ms.item_type
)
select
  et.catalog_model_id,
  et.brand,
  et.model,
  et.item_type,
  et.in_stock_count,
  et.minimum_stock,
  et.threshold_scope,
  case when et.in_stock_count = 0 then 'error' else 'warning' end as severity
from effective_thresholds et
where et.minimum_stock is not null
  and et.in_stock_count <= et.minimum_stock
order by
  case when et.in_stock_count = 0 then 0 else 1 end,
  et.in_stock_count asc,
  et.brand asc,
  et.model asc
limit greatest(1, coalesce(_limit, 10));
$$;

revoke all on function public.dashboard_stock_warnings(int, uuid) from public, anon;
grant execute on function public.dashboard_stock_warnings(int, uuid) to authenticated, service_role;
