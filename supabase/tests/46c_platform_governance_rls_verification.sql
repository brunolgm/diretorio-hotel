-- Sprint 46C catalog/RLS verification. Read-only apart from transaction-local state.
-- Run only after 45B, 46A, 46B and 46C in a disposable local/preview database.

begin;

do $$
declare
  lifecycle_default text;
  lifecycle_check text;
  brand_check text;
  audit_has_rls boolean;
begin
  select c.column_default
    into lifecycle_default
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'hotels'
    and c.column_name = 'platform_status'
    and c.is_nullable = 'NO';

  if lifecycle_default is null or lifecycle_default !~* '''active''::text' then
    raise exception '46C verification failed: platform_status must be NOT NULL default active';
  end if;

  select pg_catalog.pg_get_constraintdef(c.oid)
    into lifecycle_check
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.hotels'::regclass
    and c.conname = 'hotels_platform_status_check'
    and c.contype = 'c';

  if lifecycle_check is null
    or lifecycle_check !~* 'draft'
    or lifecycle_check !~* 'active'
    or lifecycle_check !~* 'suspended'
    or lifecycle_check !~* 'archived'
  then
    raise exception '46C verification failed: canonical lifecycle CHECK is missing';
  end if;

  select pg_catalog.pg_get_constraintdef(c.oid)
    into brand_check
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.hotels'::regclass
    and c.conname = 'hotels_brand_code_check'
    and c.contype = 'c';

  if brand_check is null
    or brand_check !~* 'brand_code[[:space:]]+is[[:space:]]+null'
    or brand_check !~* 'mercure'
    or brand_check !~* 'novotel'
    or brand_check !~* 'grand-mercure'
  then
    raise exception '46C verification failed: canonical nullable brand CHECK is missing';
  end if;

  select c.relrowsecurity
    into audit_has_rls
  from pg_catalog.pg_class c
  where c.oid = to_regclass('public.platform_audit_log');

  if audit_has_rls is distinct from true then
    raise exception '46C verification failed: platform_audit_log is missing or RLS is disabled';
  end if;

  if exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.platform_audit_log'::regclass
      and c.contype = 'f'
  ) then
    raise exception '46C verification failed: platform audit history has a destructive FK';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = 'platform_audit_log'
  ) then
    raise exception '46C verification failed: platform_audit_log must have no browser policy';
  end if;
end;
$$;

do $$
declare
  role_name text;
  privilege_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege(role_name, 'public.platform_audit_log', privilege_name) then
        raise exception '46C verification failed: % has % on platform_audit_log', role_name, privilege_name;
      end if;
    end loop;
  end loop;
end;
$$;

do $$
declare
  rpc oid;
  rpc_name text;
  definition text;
begin
  foreach rpc in array array[
    to_regprocedure('public.get_platform_hotel_metrics()'),
    to_regprocedure('public.list_platform_hotels(text,integer,integer)'),
    to_regprocedure('public.get_platform_hotel_detail(uuid)'),
    to_regprocedure('public.update_platform_hotel_brand(uuid,text)'),
    to_regprocedure('public.update_platform_hotel_status(uuid,text)')
  ] loop
    if rpc is null then
      raise exception '46C verification failed: an approved platform RPC is missing';
    end if;

    select p.proname, pg_catalog.pg_get_functiondef(p.oid)
      into strict rpc_name, definition
    from pg_catalog.pg_proc p
    where p.oid = rpc;

    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = rpc
        and p.prosecdef = true
        and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
    ) then
      raise exception '46C verification failed: % is not SECURITY DEFINER with empty search_path', rpc_name;
    end if;

    if not has_function_privilege('authenticated', rpc, 'EXECUTE')
      or has_function_privilege('anon', rpc, 'EXECUTE')
      or has_function_privilege('service_role', rpc, 'EXECUTE')
    then
      raise exception '46C verification failed: unexpected EXECUTE grants on %', rpc_name;
    end if;

    if definition !~* 'auth\.uid\(\)'
      or definition !~* 'platform_users'
      or definition !~* 'is_active[[:space:]]*=[[:space:]]*true'
      or definition !~* 'role[[:space:]]*=[[:space:]]*''platform_admin'''
    then
      raise exception '46C verification failed: % does not self-authorize active platform_admin', rpc_name;
    end if;
  end loop;
end;
$$;

do $$
declare
  writer oid := to_regprocedure(
    'public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)'
  );
  detail_definition text;
  brand_definition text;
  status_definition text;
begin
  if writer is null then
    raise exception '46C verification failed: internal platform audit writer is missing';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = writer
      and p.prosecdef = true
      and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
  ) then
    raise exception '46C verification failed: audit writer hardening is invalid';
  end if;

  if has_function_privilege('anon', writer, 'EXECUTE')
    or has_function_privilege('authenticated', writer, 'EXECUTE')
    or has_function_privilege('service_role', writer, 'EXECUTE')
  then
    raise exception '46C verification failed: audit writer is directly executable by an application role';
  end if;

  detail_definition := pg_catalog.pg_get_functiondef(
    'public.get_platform_hotel_detail(uuid)'::regprocedure
  );
  brand_definition := pg_catalog.pg_get_functiondef(
    'public.update_platform_hotel_brand(uuid,text)'::regprocedure
  );
  status_definition := pg_catalog.pg_get_functiondef(
    'public.update_platform_hotel_status(uuid,text)'::regprocedure
  );

  if detail_definition ~* '(wifi_password|wifi_name|breakfast_hours|checkin_time|checkout_time|whatsapp_number|profiles|room_links|analytics|notes)'
  then
    raise exception '46C verification failed: detail contract references a prohibited field or relation';
  end if;

  if brand_definition !~* 'for update'
    or brand_definition !~* 'set brand_code[[:space:]]*=[[:space:]]*p_brand_code'
    or brand_definition !~* 'hotel\.brand_updated'
    or brand_definition !~* 'platform_hotel_archived'
    or status_definition !~* 'for update'
    or status_definition !~* 'set platform_status[[:space:]]*=[[:space:]]*p_status'
    or status_definition !~* 'hotel\.status_updated'
  then
    raise exception '46C verification failed: lock/update/audit mutation contract is incomplete';
  end if;
end;
$$;

do $$
declare
  detail_columns text[];
  metrics_columns text[];
  directory_columns text[];
begin
  select array_agg(p.parameter_name order by p.ordinal_position)
    into detail_columns
  from information_schema.parameters p
  where p.specific_schema = 'public'
    and p.specific_name = (
      select r.specific_name from information_schema.routines r
      where r.specific_schema = 'public' and r.routine_name = 'get_platform_hotel_detail'
    )
    and p.parameter_mode = 'OUT';

  if detail_columns is distinct from array[
    'id', 'name', 'slug', 'subdomain', 'city', 'brand_code', 'theme_preset',
    'logo_url', 'hero_image_url', 'platform_status', 'created_at', 'updated_at'
  ]::text[] then
    raise exception '46C verification failed: detail projection changed: %', detail_columns;
  end if;

  select array_agg(p.parameter_name order by p.ordinal_position)
    into metrics_columns
  from information_schema.parameters p
  where p.specific_schema = 'public'
    and p.specific_name = (
      select r.specific_name from information_schema.routines r
      where r.specific_schema = 'public' and r.routine_name = 'get_platform_hotel_metrics'
    )
    and p.parameter_mode = 'OUT';

  if metrics_columns is distinct from array[
    'total_hotels', 'hotels_by_brand', 'hotels_by_status'
  ]::text[] then
    raise exception '46C verification failed: metrics projection changed: %', metrics_columns;
  end if;

  select array_agg(p.parameter_name order by p.ordinal_position)
    into directory_columns
  from information_schema.parameters p
  where p.specific_schema = 'public'
    and p.specific_name = (
      select r.specific_name from information_schema.routines r
      where r.specific_schema = 'public' and r.routine_name = 'list_platform_hotels'
    )
    and p.parameter_mode = 'OUT';

  if directory_columns is distinct from array[
    'total_count', 'id', 'name', 'slug', 'subdomain', 'city', 'brand_code',
    'theme_preset', 'logo_url', 'platform_status'
  ]::text[] then
    raise exception '46C verification failed: directory projection changed: %', directory_columns;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'hotels'
      and policyname <> '45b_hotel_read_own_hotel'
  ) or exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'hotels'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'platform'
  ) then
    raise exception '46C verification failed: platform governance leaked into hotels RLS';
  end if;

  if has_table_privilege('authenticated', 'public.hotels', 'INSERT')
    or has_table_privilege('authenticated', 'public.hotels', 'UPDATE')
    or has_table_privilege('authenticated', 'public.hotels', 'DELETE')
    or has_table_privilege('anon', 'public.hotels', 'SELECT')
    or has_table_privilege('anon', 'public.hotels', 'UPDATE')
  then
    raise exception '46C verification failed: browser roles gained direct hotels privileges';
  end if;

  if pg_catalog.pg_get_viewdef('public.public_hotels'::regclass, true)
      !~* 'where[[:space:]]+hotels\.platform_status[[:space:]]*=[[:space:]]*''active'''
    and pg_catalog.pg_get_viewdef('public.public_hotels'::regclass, true)
      !~* 'where[[:space:]]+platform_status[[:space:]]*=[[:space:]]*''active'''
  then
    raise exception '46C verification failed: public_hotels is not restricted to active lifecycle';
  end if;

  if exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'public_hotels'
      and c.column_name = 'platform_status'
  ) then
    raise exception '46C verification failed: public_hotels exposes lifecycle instead of only filtering it';
  end if;
end;
$$;

do $$
declare
  public_helper oid := to_regprocedure('public.is_hotel_publicly_active(uuid)');
  helper oid;
  definition text;
begin
  if public_helper is null
    or not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = public_helper
        and p.prosecdef = true
        and p.provolatile = 's'
        and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
    )
    or not has_function_privilege('anon', public_helper, 'EXECUTE')
    or not has_function_privilege('authenticated', public_helper, 'EXECUTE')
    or has_function_privilege('service_role', public_helper, 'EXECUTE')
  then
    raise exception '46C verification failed: public lifecycle helper contract is invalid';
  end if;

  definition := pg_catalog.pg_get_functiondef(public_helper);
  if definition !~* 'platform_status[[:space:]]*=[[:space:]]*''active'''
    or definition ~* 'profiles|platform_users'
  then
    raise exception '46C verification failed: public lifecycle helper is not a narrow active check';
  end if;

  foreach helper in array array[
    to_regprocedure('public.has_active_hotel_role(uuid,text)'),
    to_regprocedure('public.has_active_hotel_path_role(text,text)')
  ] loop
    definition := pg_catalog.pg_get_functiondef(helper);
    if definition !~* 'join public\.hotels'
      or definition !~* 'platform_status[[:space:]]*<>[[:space:]]*''archived'''
      or definition ~* 'platform_status[[:space:]]*=[[:space:]]*''active'''
    then
      raise exception '46C verification failed: hotel admin helper does not block only archived';
    end if;
  end loop;
end;
$$;

do $$
declare
  lifecycle_policy_count integer;
begin
  select count(*)
    into lifecycle_policy_count
  from pg_catalog.pg_policies p
  where p.schemaname = 'public'
    and p.policyname in (
      '45b_public_read_enabled_sections',
      '45b_public_read_enabled_departments',
      '45b_public_read_enabled_policies',
      '45b_public_read_section_translations',
      '45b_public_read_department_translations',
      '45b_public_read_policy_translations',
      '45b_public_read_active_announcements',
      '45b_public_read_announcement_translations',
      '45b_public_read_active_banners',
      '45b_public_read_banner_translations'
    )
    and p.qual ~* 'is_hotel_publicly_active';

  if lifecycle_policy_count <> 10 then
    raise exception '46C verification failed: % of 10 public content policies enforce lifecycle', lifecycle_policy_count;
  end if;
end;
$$;

rollback;
