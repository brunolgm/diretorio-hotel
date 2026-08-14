-- Sprint 46B read-only catalog and privilege verification.
-- Run only after 45B, 46A and 46B migrations in a disposable local/preview database.

begin;

do $$
declare
  metrics_rpc oid := to_regprocedure('public.get_platform_hotel_metrics()');
  directory_rpc oid := to_regprocedure('public.list_platform_hotels(text,integer,integer)');
  rpc_oid oid;
  rpc_name text;
begin
  if metrics_rpc is null or directory_rpc is null then
    raise exception '46B verification failed: dashboard RPCs are missing';
  end if;

  foreach rpc_oid in array array[metrics_rpc, directory_rpc] loop
    select p.proname into strict rpc_name from pg_proc p where p.oid = rpc_oid;

    if not exists (
      select 1
      from pg_proc p
      where p.oid = rpc_oid
        and p.prosecdef = true
        and p.provolatile = 's'
        and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
    ) then
      raise exception '46B verification failed: % must be stable SECURITY DEFINER with empty search_path',
        rpc_name;
    end if;

    if not has_function_privilege('authenticated', rpc_oid, 'EXECUTE') then
      raise exception '46B verification failed: authenticated must execute %', rpc_name;
    end if;

    if has_function_privilege('anon', rpc_oid, 'EXECUTE')
      or has_function_privilege('service_role', rpc_oid, 'EXECUTE')
    then
      raise exception '46B verification failed: anon/service_role must not execute %', rpc_name;
    end if;

    if pg_get_functiondef(rpc_oid) !~* 'auth\.uid\(\)'
      or pg_get_functiondef(rpc_oid) !~* 'platform_users'
      or pg_get_functiondef(rpc_oid) !~* 'is_active[[:space:]]*=[[:space:]]*true'
      or pg_get_functiondef(rpc_oid) !~* 'role[[:space:]]*=[[:space:]]*''platform_admin'''
    then
      raise exception '46B verification failed: % does not self-authorize active platform_admin',
        rpc_name;
    end if;
  end loop;
end;
$$;

do $$
declare
  metrics_columns text[];
  directory_columns text[];
  directory_definition text;
begin
  select array_agg(p.parameter_name order by p.ordinal_position)
    into metrics_columns
  from information_schema.parameters p
  where p.specific_schema = 'public'
    and p.specific_name = (
      select routine.specific_name
      from information_schema.routines routine
      where routine.specific_schema = 'public'
        and routine.routine_name = 'get_platform_hotel_metrics'
    )
    and p.parameter_mode = 'OUT';

  if metrics_columns is distinct from array['total_hotels', 'hotels_by_brand']::text[] then
    raise exception '46B verification failed: metrics projection changed: %', metrics_columns;
  end if;

  select array_agg(p.parameter_name order by p.ordinal_position)
    into directory_columns
  from information_schema.parameters p
  where p.specific_schema = 'public'
    and p.specific_name = (
      select routine.specific_name
      from information_schema.routines routine
      where routine.specific_schema = 'public'
        and routine.routine_name = 'list_platform_hotels'
    )
    and p.parameter_mode = 'OUT';

  if directory_columns is distinct from array[
    'total_count', 'id', 'name', 'slug', 'subdomain', 'city',
    'brand_code', 'theme_preset', 'logo_url'
  ]::text[] then
    raise exception '46B verification failed: directory projection changed: %', directory_columns;
  end if;

  directory_definition := pg_get_functiondef(
    'public.list_platform_hotels(text,integer,integer)'::regprocedure
  );

  if directory_definition ~* '(wifi_password|wifi_name|room_token|notes|profiles|analytics|hotel_sections)'
  then
    raise exception '46B verification failed: directory references a prohibited field or relation';
  end if;

  if directory_definition !~* 'p_page_size[[:space:]]*>[[:space:]]*50'
    or directory_definition !~* 'length\(normalized_search\)[[:space:]]*>[[:space:]]*100'
    or directory_definition !~* 'order by[[:space:]]+lower\(fh\.name\),[[:space:]]*fh\.id'
    or directory_definition ~* 'execute[[:space:]]|format\('
  then
    raise exception '46B verification failed: pagination/search contract is not bounded and static';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hotels'
      and policyname <> '45b_hotel_read_own_hotel'
  ) or not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hotels'
      and policyname = '45b_hotel_read_own_hotel'
      and cmd = 'SELECT'
      and qual ~* '^(public\.)?has_active_hotel_role\(id, ''visualizador''::text\)$'
  ) then
    raise exception '46B verification failed: hotels policies differ from the 45B baseline';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hotels'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'platform'
  ) then
    raise exception '46B verification failed: platform logic leaked into hotels RLS';
  end if;

  if has_table_privilege('anon', 'public.hotels', 'SELECT')
    or has_table_privilege('anon', 'public.hotels', 'INSERT')
    or has_table_privilege('anon', 'public.hotels', 'UPDATE')
    or has_table_privilege('anon', 'public.hotels', 'DELETE')
  then
    raise exception '46B verification failed: anon gained a public.hotels privilege';
  end if;

  if has_table_privilege('authenticated', 'public.hotels', 'INSERT')
    or has_table_privilege('authenticated', 'public.hotels', 'UPDATE')
    or has_table_privilege('authenticated', 'public.hotels', 'DELETE')
  then
    raise exception '46B verification failed: authenticated gained hotels DML';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'hotels'
      and lower(grantee) like '%platform%'
  ) then
    raise exception '46B verification failed: a platform-named role is a hotels grantee';
  end if;
end;
$$;

rollback;
