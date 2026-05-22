-- db/schema/dashboard/dashboard_upcoming_meetings.rpc.sql
-- Purpose: Org-scoped upcoming meetings for dashboard.

drop function if exists public.dashboard_upcoming_meetings(int, uuid);

create or replace function public.dashboard_upcoming_meetings(
  _limit int default 10,
  _org_id uuid default null
) returns table (
  id uuid,
  meeting_type text,
  subject text,
  subject_name text,
  at timestamptz,
  next_at timestamptz
) language sql stable as $$
with org_ctx as (
  select
    case
      when auth.role() = 'service_role'::text then _org_id
      else (select p.org_id from public.profiles p where p.id = auth.uid())
    end as org_id,
    case
      when auth.role() = 'service_role'::text then true
      else public.current_user_role() = 'admin'
    end as is_admin
), candidates as (
  select
    m.id,
    m.meeting_type,
    m.subject,
    m.subject_name,
    m.at,
    m.next_at,
    least(
      coalesce(m.at, 'infinity'::timestamptz),
      coalesce(m.next_at, 'infinity'::timestamptz)
    ) as order_at
  from public.meetings m
  join org_ctx o on o.org_id is not null and o.org_id = m.org_id
  where m.deleted_at is null
    and (m.at >= now() or m.next_at >= now())
    and (o.is_admin or coalesce(m.meeting_type, '') <> 'reference')
)
select
  c.id,
  c.meeting_type,
  c.subject,
  c.subject_name,
  c.at,
  c.next_at
from candidates c
order by c.order_at asc
limit greatest(1, coalesce(_limit, 10));
$$;

revoke all on function public.dashboard_upcoming_meetings(int, uuid) from public, anon;
grant execute on function public.dashboard_upcoming_meetings(int, uuid) to authenticated, service_role;
