-- Sprint 45B: make /api/analytics the only application ingestion path.

do $$
declare
  unexpected_policies text;
begin
  if to_regclass('public.hotel_analytics_events') is null then
    raise exception '45B analytics preflight failed: hotel_analytics_events is missing';
  end if;

  select string_agg(policyname, ', ' order by policyname)
    into unexpected_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'hotel_analytics_events'
    and policyname not in (
      'Allow constrained public analytics inserts',
      'Allow hotel users to view their analytics'
    );

  if unexpected_policies is not null then
    raise exception '45B analytics preflight failed: review unexpected policies: %', unexpected_policies;
  end if;
end;
$$;

alter table public.hotel_analytics_events enable row level security;

drop policy if exists "Allow constrained public analytics inserts" on public.hotel_analytics_events;
drop policy if exists "Allow hotel users to view their analytics" on public.hotel_analytics_events;

create policy "45b_hotel_read_analytics"
  on public.hotel_analytics_events
  for select
  to authenticated
  using (public.has_active_hotel_role(hotel_id, 'visualizador'));

revoke all on table public.hotel_analytics_events from anon, authenticated;
revoke all on table public.hotel_analytics_events from service_role;
grant select on table public.hotel_analytics_events to authenticated;
grant insert on table public.hotel_analytics_events to service_role;

comment on table public.hotel_analytics_events is
  'Analytics ingestion is server-only through /api/analytics; anon/authenticated have no INSERT grant or policy.';
