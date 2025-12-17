-- db/schema/dashboard/dashboard_upcoming_meetings.rpc.sql
-- Purpose: Supabase RPC to fetch upcoming meetings for dashboard (org-scoped).
-- Notes:
--  - Resolves org_id like dashboard_kpis (profiles for authenticated; optional _org_id for service_role).
--  - Upcoming filter: at >= now() OR (at IS NULL AND next_at >= now()).
--  - Ordering uses the earliest timestamp per row: coalesce(at, next_at) ascending.
--  - Limited by _limit (default 10).

create or replace function public.dashboard_upcoming_meetings(
  _limit int default 10,
  _org_id uuid default null -- only used when auth.role() = 'service_role'
) returns table (
  id uuid,
  meeting_type text,
  subject text,
  subject_name text,
  at timestamptz,
  next_at timestamptz
) language sql stable as $$
with org_ctx as (
  select case
    when auth.role() = 'service_role'::text then _org_id
    else (select p.org_id from public.profiles p where p.id = auth.uid())
  end as org_id
)
select
  m.id,
  m.meeting_type,
  m.subject,
  m.subject_name,
  m.at,
  m.next_at
from public.meetings m
join org_ctx o on o.org_id is not null and o.org_id = m.org_id
where
  (
    m.at >= now()
    or (m.at is null and m.next_at >= now())
  )
order by coalesce(m.at, m.next_at) asc
limit greatest(1, coalesce(_limit, 10));
$$;

-- Permissions: allow authenticated users and service_role; revoke public/anon.
revoke all on function public.dashboard_upcoming_meetings(int, uuid) from public, anon;
grant execute on function public.dashboard_upcoming_meetings(int, uuid) to authenticated, service_role;
