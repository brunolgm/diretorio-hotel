-- Read-only catalog/security verification for Sprint 49.
begin;

do $$
declare
  analytics_fn oid := to_regprocedure('public.get_current_hotel_analytics(text)');
  fn_source text;
  event_constraint text;
  service_constraint text;
  service_tenant_key text;
  actual_event_keys text[];
begin
  if analytics_fn is null then raise exception '49 catalog: analytics RPC missing'; end if;
  if not exists(select 1 from pg_catalog.pg_proc p where p.oid=analytics_fn
      and p.prosecdef and p.provolatile='s'
      and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))) then
    raise exception '49 catalog: RPC security contract invalid';
  end if;
  if has_function_privilege('anon',analytics_fn,'EXECUTE')
    or has_function_privilege('service_role',analytics_fn,'EXECUTE')
    or not has_function_privilege('authenticated',analytics_fn,'EXECUTE') then
    raise exception '49 catalog: RPC grants invalid';
  end if;
  select pg_catalog.pg_get_functiondef(analytics_fn) into fn_source;
  if fn_source !~* 'auth\.uid\(\)'
    or fn_source !~* 'from public\.profiles'
    or fn_source !~* 'analytics\.basic'
    or fn_source !~* 'platform_status.*archived'
    or fn_source !~* 'today.*7d.*30d.*90d'
    or fn_source !~* 'hotel_id[[:space:]]*=[[:space:]]*current_hotel_id'
    or fn_source ~* 'wifi_password|target_url|metadata|session_id.*jsonb_build_object' then
    raise exception '49 catalog: RPC scope/privacy contract drifted';
  end if;

  if not exists(select 1 from information_schema.columns c where c.table_schema='public'
      and c.table_name='hotel_analytics_events' and c.column_name='service_id'
      and c.data_type='uuid' and c.is_nullable='YES') then
    raise exception '49 catalog: service event reference missing';
  end if;
  if not exists(select 1 from pg_catalog.pg_constraint c
      where c.conrelid='public.hotel_analytics_events'::regclass
        and c.conname='hotel_analytics_events_service_hotel_fkey' and c.confdeltype='n'
        and c.confrelid='public.hotel_sections'::regclass) then
    raise exception '49 catalog: tenant-safe service FK must use ON DELETE SET NULL';
  end if;
  select pg_catalog.pg_get_constraintdef(c.oid) into service_constraint
  from pg_catalog.pg_constraint c where c.conrelid='public.hotel_analytics_events'::regclass
    and c.conname='hotel_analytics_events_service_hotel_fkey';
  if service_constraint !~* 'foreign key \(service_id, hotel_id\) references (public\.)?hotel_sections\(id, hotel_id\)'
    or service_constraint !~* 'on delete set null \(service_id\)' then
    raise exception '49 catalog: service FK does not enforce same-hotel ownership safely';
  end if;
  select pg_catalog.pg_get_constraintdef(c.oid) into service_tenant_key
  from pg_catalog.pg_constraint c where c.conrelid='public.hotel_sections'::regclass
    and c.conname='hotel_sections_id_hotel_id_key' and c.contype='u';
  if service_tenant_key is null or service_tenant_key !~* 'unique \(id, hotel_id\)' then
    raise exception '49 catalog: service tenant key missing';
  end if;
  select pg_catalog.pg_get_constraintdef(c.oid) into event_constraint
  from pg_catalog.pg_constraint c where c.conrelid='public.hotel_analytics_events'::regclass
    and c.conname='hotel_analytics_events_event_type_check';
  select pg_catalog.array_agg(m[1] order by m[1]) into actual_event_keys
  from pg_catalog.regexp_matches(event_constraint,'''([a-z_]+)''','g') m;
  if actual_event_keys is distinct from array[
    'booking_click','department_click','language_selected','page_view','service_view',
    'website_click','whatsapp_click']::text[] then
    raise exception '49 catalog: seven-event catalog invalid';
  end if;
  if to_regclass('public.hotel_analytics_events_service_id_idx') is null then
    raise exception '49 catalog: service FK index missing';
  end if;
end;
$$;

do $$
begin
  if exists(select 1 from pg_catalog.pg_policies p where p.schemaname='public'
      and p.tablename='hotel_analytics_events') then
    raise exception '49 catalog: raw event policy remains';
  end if;
  if has_table_privilege('anon','public.hotel_analytics_events','SELECT')
    or has_table_privilege('authenticated','public.hotel_analytics_events','SELECT')
    or has_table_privilege('service_role','public.hotel_analytics_events','SELECT')
    or has_table_privilege('anon','public.hotel_analytics_events','INSERT')
    or has_table_privilege('authenticated','public.hotel_analytics_events','INSERT')
    or not has_table_privilege('service_role','public.hotel_analytics_events','INSERT') then
    raise exception '49 catalog: raw table grants invalid';
  end if;
  if to_regprocedure('public.get_platform_analytics(text)') is not null then
    raise exception '49 catalog: global platform analytics is out of scope';
  end if;
end;
$$;

rollback;
