-- Sprint 49: hotel-scoped aggregated analytics without browser access to raw events.

do $$
declare
  event_constraint text;
  actual_event_keys text[];
  expected_event_keys text[] := array[
    'booking_click','department_click','language_selected','page_view',
    'website_click','whatsapp_click'
  ];
  analytics_policy record;
begin
  if to_regprocedure('public.get_current_hotel_analytics(text)') is not null then
    raise exception '49 preflight failed: analytics RPC already exists';
  end if;
  if to_regclass('public.hotel_sections_id_hotel_id_key') is not null then
    raise exception '49 preflight failed: service tenant key already exists unexpectedly';
  end if;
  if to_regclass('public.hotel_analytics_events') is null
    or to_regclass('public.hotel_module_entitlements') is null
    or to_regclass('public.hotel_sections') is null
    or to_regclass('public.hotel_departments') is null then
    raise exception '49 preflight failed: required analytics tables are missing';
  end if;
  if exists (
    select 1 from (values
      ('id','uuid','NO'),('hotel_id','uuid','NO'),('hotel_slug','text','NO'),
      ('event_type','text','NO'),('session_id','text','YES'),('language','text','YES'),
      ('target_url','text','YES'),('department_id','uuid','YES'),('metadata','jsonb','NO'),
      ('created_at','timestamp with time zone','NO')
    ) expected(column_name,data_type,is_nullable)
    left join information_schema.columns c on c.table_schema='public'
      and c.table_name='hotel_analytics_events' and c.column_name=expected.column_name
      and c.data_type=expected.data_type and c.is_nullable=expected.is_nullable
    where c.column_name is null
  ) or exists (
    select 1 from information_schema.columns c where c.table_schema='public'
      and c.table_name='hotel_analytics_events' and c.column_name='service_id'
  ) then
    raise exception '49 preflight failed: analytics event schema drifted';
  end if;
  if not exists (
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name='hotel_sections'
      and c.column_name='id' and c.data_type='uuid' and c.is_nullable='NO'
  ) or not exists (
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name='hotel_sections'
      and c.column_name='hotel_id' and c.data_type='uuid' and c.is_nullable='NO'
  ) then
    raise exception '49 preflight failed: service tenant columns drifted';
  end if;
  if (select pg_catalog.array_agg(c.column_name::text order by c.ordinal_position)
      from information_schema.columns c where c.table_schema='public'
        and c.table_name='hotel_analytics_events') is distinct from array[
      'id','hotel_id','hotel_slug','event_type','language','target_url','department_id',
      'metadata','created_at','session_id']::text[] then
    raise exception '49 preflight failed: analytics event projection drifted';
  end if;

  select pg_catalog.pg_get_constraintdef(c.oid) into event_constraint
  from pg_catalog.pg_constraint c
  where c.conrelid='public.hotel_analytics_events'::regclass
    and c.conname='hotel_analytics_events_event_type_check' and c.contype='c';
  select pg_catalog.array_agg(m[1] order by m[1]) into actual_event_keys
  from pg_catalog.regexp_matches(event_constraint,'''([a-z_]+)''','g') m;
  if actual_event_keys is distinct from expected_event_keys then
    raise exception '49 preflight failed: canonical event set is not exact';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid='public.hotel_analytics_events'::regclass
      and c.conname='hotel_analytics_events_language_check'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* '''pt'''
      and pg_catalog.pg_get_constraintdef(c.oid) ~* '''en'''
      and pg_catalog.pg_get_constraintdef(c.oid) ~* '''es'''
  ) then
    raise exception '49 preflight failed: analytics language contract drifted';
  end if;

  if not exists(select 1 from pg_catalog.pg_class c where c.oid='public.hotel_analytics_events'::regclass and c.relrowsecurity)
    or (select count(*) from pg_catalog.pg_policies p where p.schemaname='public' and p.tablename='hotel_analytics_events')<>1 then
    raise exception '49 preflight failed: analytics RLS/policy count drifted';
  end if;
  select * into analytics_policy from pg_catalog.pg_policies p
  where p.schemaname='public' and p.tablename='hotel_analytics_events'
    and p.policyname='45b_hotel_read_analytics';
  if analytics_policy is null or analytics_policy.cmd<>'SELECT'
    or analytics_policy.roles<>array['authenticated']::name[]
    or coalesce(analytics_policy.qual,'') !~* 'has_active_hotel_role.*hotel_id.*visualizador'
    or analytics_policy.with_check is not null then
    raise exception '49 preflight failed: known 45B analytics policy drifted';
  end if;

  if has_table_privilege('anon','public.hotel_analytics_events','SELECT')
    or has_table_privilege('anon','public.hotel_analytics_events','INSERT')
    or has_table_privilege('anon','public.hotel_analytics_events','UPDATE')
    or has_table_privilege('anon','public.hotel_analytics_events','DELETE')
    or not has_table_privilege('authenticated','public.hotel_analytics_events','SELECT')
    or has_table_privilege('authenticated','public.hotel_analytics_events','INSERT')
    or has_table_privilege('authenticated','public.hotel_analytics_events','UPDATE')
    or has_table_privilege('authenticated','public.hotel_analytics_events','DELETE')
    or not has_table_privilege('service_role','public.hotel_analytics_events','INSERT')
    or has_table_privilege('service_role','public.hotel_analytics_events','SELECT')
    or has_table_privilege('service_role','public.hotel_analytics_events','UPDATE')
    or has_table_privilege('service_role','public.hotel_analytics_events','DELETE') then
    raise exception '49 preflight failed: known 45B analytics grants drifted';
  end if;
  if to_regclass('public.hotel_analytics_events_hotel_id_created_at_idx') is null
    or to_regclass('public.hotel_analytics_events_event_type_created_at_idx') is null
    or to_regclass('public.hotel_analytics_events_department_id_idx') is null
    or to_regclass('public.hotel_analytics_events_hotel_id_session_id_created_at_idx') is null then
    raise exception '49 preflight failed: existing analytics indexes drifted';
  end if;
  if pg_catalog.pg_get_indexdef(to_regclass('public.hotel_analytics_events_hotel_id_created_at_idx')) !~* '\(hotel_id, created_at desc\)'
    or pg_catalog.pg_get_indexdef(to_regclass('public.hotel_analytics_events_event_type_created_at_idx')) !~* '\(event_type, created_at desc\)'
    or pg_catalog.pg_get_indexdef(to_regclass('public.hotel_analytics_events_department_id_idx')) !~* '\(department_id\)'
    or pg_catalog.pg_get_indexdef(to_regclass('public.hotel_analytics_events_hotel_id_session_id_created_at_idx')) !~* '\(hotel_id, session_id, created_at desc\)' then
    raise exception '49 preflight failed: existing analytics index definition drifted';
  end if;
  if to_regprocedure('public.has_active_hotel_role(uuid,text)') is null
    or to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is null
    or not exists(select 1 from pg_catalog.pg_proc p
      where p.oid=to_regprocedure('public.is_hotel_module_enabled(uuid,text)')
        and p.prosecdef and p.provolatile='s'
        and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[])))
    or not exists(select 1 from pg_catalog.pg_constraint c
      where c.conrelid='public.hotel_module_entitlements'::regclass
        and c.conname='hotel_module_entitlements_module_key_check'
        and pg_catalog.pg_get_constraintdef(c.oid) ~* 'analytics\.basic'
        and pg_catalog.pg_get_constraintdef(c.oid) ~* 'analytics\.advanced') then
    raise exception '49 preflight failed: authorization/entitlement helpers are missing';
  end if;
end;
$$;

drop policy "45b_hotel_read_analytics" on public.hotel_analytics_events;
revoke select on table public.hotel_analytics_events from authenticated;

alter table public.hotel_analytics_events
  add column service_id uuid null;

alter table public.hotel_sections
  add constraint hotel_sections_id_hotel_id_key unique(id,hotel_id);

alter table public.hotel_analytics_events
  add constraint hotel_analytics_events_service_hotel_fkey
    foreign key(service_id,hotel_id) references public.hotel_sections(id,hotel_id)
    on delete set null(service_id);

alter table public.hotel_analytics_events
  drop constraint hotel_analytics_events_event_type_check,
  add constraint hotel_analytics_events_event_type_check check(event_type in(
    'page_view','language_selected','whatsapp_click','website_click','booking_click',
    'department_click','service_view'
  ));

create index hotel_analytics_events_service_id_idx
  on public.hotel_analytics_events(service_id);

create function public.get_current_hotel_analytics(p_period text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  current_hotel_id uuid;
  current_start timestamptz;
  current_end timestamptz;
  previous_start timestamptz;
  previous_end timestamptz;
  period_days integer;
  result jsonb;
begin
  if p_period is null or p_period not in ('today','7d','30d','90d') then
    raise exception using errcode='22023',message='analytics_period_invalid';
  end if;

  select p.hotel_id into current_hotel_id
  from public.profiles p
  join public.hotels h on h.id=p.hotel_id
  where p.id=auth.uid() and p.is_active and h.platform_status<>'archived';
  if current_hotel_id is null
    or not public.has_active_hotel_role(current_hotel_id,'visualizador') then
    raise exception using errcode='42501',message='active_hotel_profile_required';
  end if;
  if not public.is_hotel_module_enabled(current_hotel_id,'analytics.basic') then
    raise exception using errcode='42501',message='analytics_basic_required';
  end if;

  period_days := case p_period when 'today' then 1 when '7d' then 7
    when '30d' then 30 else 90 end;
  -- Calendar-day windows are half-open. The current window includes today and
  -- ends at the next local database midnight; the previous window is adjacent.
  current_end := pg_catalog.date_trunc('day',now())+interval '1 day';
  current_start := current_end-period_days*interval '1 day';
  previous_end := current_start;
  previous_start := previous_end-period_days*interval '1 day';

  with all_events as materialized (
    select e.event_type,e.language,e.department_id,e.service_id,e.created_at
    from public.hotel_analytics_events e
    where e.hotel_id=current_hotel_id and e.created_at>=previous_start and e.created_at<current_end
  ), current_events as materialized (
    select * from all_events e where e.created_at>=current_start
  ), previous_events as materialized (
    select * from all_events e where e.created_at>=previous_start and e.created_at<previous_end
  ), metric_values as (
    select
      count(*) filter(where event_type='page_view') as page_views,
      count(*) filter(where event_type<>'page_view') as engagements,
      count(*) filter(where event_type='whatsapp_click') as whatsapp_clicks,
      count(*) filter(where event_type in('booking_click','website_click')) as booking_website_clicks,
      count(*) filter(where event_type='language_selected') as language_changes,
      count(*) filter(where event_type in('whatsapp_click','booking_click','website_click')) as external_clicks
    from current_events
  ), previous_values as (
    select
      count(*) filter(where event_type='page_view') as page_views,
      count(*) filter(where event_type<>'page_view') as engagements,
      count(*) filter(where event_type='whatsapp_click') as whatsapp_clicks,
      count(*) filter(where event_type in('booking_click','website_click')) as booking_website_clicks,
      count(*) filter(where event_type='language_selected') as language_changes
    from previous_events
  ), day_series as (
    select day::date as day from pg_catalog.generate_series(
      current_start,current_end-interval '1 day',interval '1 day'
    ) day
  ), daily as (
    select d.day,
      count(e.created_at) filter(where e.event_type='page_view') as page_views,
      count(e.created_at) filter(where e.event_type<>'page_view') as engagements,
      count(e.created_at) filter(where e.event_type in('whatsapp_click','booking_click','website_click')) as external_clicks
    from day_series d left join current_events e on e.created_at>=d.day::timestamptz
      and e.created_at<(d.day+1)::timestamptz
    group by d.day order by d.day
  ), action_counts as (
    select event_type,count(*) as count from current_events
    where event_type in('whatsapp_click','booking_click','website_click','service_view','department_click')
    group by event_type
  ), action_total as (select coalesce(sum(count),0) as total from action_counts),
  service_counts as (
    select s.id,s.title as name,count(*) as count
    from current_events e join public.hotel_sections s
      on s.id=e.service_id and s.hotel_id=current_hotel_id
    where e.event_type='service_view' and e.service_id is not null
    group by s.id,s.title order by count(*) desc limit 5
  ), department_counts as (
    select d.id,d.name,count(*) as count
    from current_events e join public.hotel_departments d
      on d.id=e.department_id and d.hotel_id=current_hotel_id
    where e.event_type='department_click' and e.department_id is not null
    group by d.id,d.name order by count(*) desc limit 5
  ), language_counts as (
    select language,count(*) as count from current_events
    where event_type='page_view' and language in('pt','en','es')
    group by language order by count(*) desc
  )
  select pg_catalog.jsonb_build_object(
    'period',p_period,'current_start',current_start,'current_end',current_end,
    'previous_start',previous_start,'previous_end',previous_end,
    'metrics',pg_catalog.jsonb_build_object(
      'page_views',pg_catalog.jsonb_build_object('current',m.page_views,'previous',p.page_views),
      'engagements',pg_catalog.jsonb_build_object('current',m.engagements,'previous',p.engagements),
      'whatsapp_clicks',pg_catalog.jsonb_build_object('current',m.whatsapp_clicks,'previous',p.whatsapp_clicks),
      'booking_website_clicks',pg_catalog.jsonb_build_object('current',m.booking_website_clicks,'previous',p.booking_website_clicks),
      'language_changes',pg_catalog.jsonb_build_object('current',m.language_changes,'previous',p.language_changes)
    ),
    'journey',pg_catalog.jsonb_build_object('views',m.page_views,'interactions',m.engagements,'external_clicks',m.external_clicks),
    'timeseries',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'date',day,'page_views',page_views,'engagements',engagements,'external_clicks',external_clicks) order by day),'[]'::jsonb) from daily),
    'actions',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'event_type',a.event_type,'count',a.count,'share',case when t.total=0 then 0 else pg_catalog.round(a.count*100.0/t.total,1) end)
      order by a.count desc,a.event_type),'[]'::jsonb) from action_counts a cross join action_total t),
    'services',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'name',name,'count',count) order by count desc),'[]'::jsonb) from service_counts),
    'departments',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'name',name,'count',count) order by count desc),'[]'::jsonb) from department_counts),
    'languages',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('language',language,'count',count) order by count desc),'[]'::jsonb) from language_counts)
  ) into result from metric_values m cross join previous_values p;

  return result;
end;
$$;

revoke all on function public.get_current_hotel_analytics(text) from public,anon,authenticated,service_role;
grant execute on function public.get_current_hotel_analytics(text) to authenticated;

comment on function public.get_current_hotel_analytics(text) is
  'Bounded hotel-scoped Analytics Pro aggregation. Raw events remain unavailable to browser roles.';
