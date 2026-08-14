-- Sprint 46A catalog/RLS verification.
-- Run only after applying 45B 001-006 and 46A to a disposable local/preview database.
-- This script is read-only. BEGIN/ROLLBACK make that intent explicit.

begin;

do $$
declare
  platform_table oid := to_regclass('public.platform_users');
  platform_rpc oid := to_regprocedure('public.get_current_platform_access()');
  access_role text;
  privilege_name text;
begin
  if platform_table is null then
    raise exception '46A verification failed: public.platform_users is missing';
  end if;

  if not exists (
    select 1
    from pg_class c
    where c.oid = platform_table
      and c.relkind = 'r'
      and c.relrowsecurity = true
  ) then
    raise exception '46A verification failed: platform_users must have RLS enabled';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'platform_users'
  ) then
    raise exception '46A verification failed: platform_users must not have table policies';
  end if;

  foreach access_role in array array['anon', 'authenticated', 'service_role'] loop
    foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if has_table_privilege(
        access_role,
        'public.platform_users',
        privilege_name
      ) then
        raise exception '46A verification failed: % must not have direct % on platform_users',
          access_role, privilege_name;
      end if;
    end loop;
  end loop;

  if platform_rpc is null then
    raise exception '46A verification failed: get_current_platform_access() is missing';
  end if;

  if not exists (
    select 1
    from pg_proc p
    where p.oid = platform_rpc
      and p.prosecdef = true
      and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
  ) then
    raise exception '46A verification failed: platform RPC must be SECURITY DEFINER with empty search_path';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_current_platform_access()',
    'EXECUTE'
  ) then
    raise exception '46A verification failed: authenticated must execute the current-user RPC';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_current_platform_access()',
    'EXECUTE'
  ) then
    raise exception '46A verification failed: anon must not execute the platform RPC';
  end if;

  if has_function_privilege(
    'service_role',
    'public.get_current_platform_access()',
    'EXECUTE'
  ) then
    raise exception '46A verification failed: service_role does not require platform RPC EXECUTE';
  end if;
end;
$$;

do $$
declare
  role_check_expression text;
begin
  select regexp_replace(
           pg_get_expr(con.conbin, con.conrelid),
           '[[:space:]()]',
           '',
           'g'
         )
    into role_check_expression
  from pg_constraint con
  where con.conrelid = 'public.platform_users'::regclass
    and con.contype = 'c'
    and con.conname = 'platform_users_role_check'
    and con.convalidated = true;

  if role_check_expression is distinct from 'role=''platform_admin''::text' then
    raise exception '46A verification failed: canonical role CHECK changed: %',
      coalesce(role_check_expression, '<missing>');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_users'
      and column_name = 'hotel_id'
  ) then
    raise exception '46A verification failed: platform_users must not contain hotel_id';
  end if;

  if not exists (
    select 1
    from pg_constraint con
    join pg_attribute local_column
      on local_column.attrelid = con.conrelid
     and local_column.attnum = con.conkey[1]
    join pg_attribute referenced_column
      on referenced_column.attrelid = con.confrelid
     and referenced_column.attnum = con.confkey[1]
    where con.conrelid = 'public.platform_users'::regclass
      and con.contype = 'f'
      and con.convalidated = true
      and con.confrelid = 'auth.users'::regclass
      and array_length(con.conkey, 1) = 1
      and array_length(con.confkey, 1) = 1
      and local_column.attname = 'user_id'
      and referenced_column.attname = 'id'
      and con.confdeltype = 'c'
  ) then
    raise exception '46A verification failed: user_id FK must target auth.users(id) ON DELETE CASCADE';
  end if;
end;
$$;

do $$
declare
  helper_name text;
begin
  -- The 45B baseline has exactly one base-table hotels policy. 46A must not add a
  -- platform/global branch or any extra policy to public.hotels.
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
    raise exception '46A verification failed: public.hotels policy set differs from the 45B baseline';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hotels'
      and (
        coalesce(policyname, '') || ' ' ||
        coalesce(qual, '') || ' ' ||
        coalesce(with_check, '')
      ) ~* 'platform(_admin|_users|_access)?'
  ) then
    raise exception '46A verification failed: public.hotels contains platform-aware policy logic';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'hotels'
      and lower(grantee) like '%platform%'
  ) then
    raise exception '46A verification failed: a platform-named database role is a hotels grantee';
  end if;

  if has_table_privilege('anon', 'public.hotels', 'SELECT')
    or has_table_privilege('anon', 'public.hotels', 'INSERT')
    or has_table_privilege('anon', 'public.hotels', 'UPDATE')
    or has_table_privilege('anon', 'public.hotels', 'DELETE')
  then
    raise exception '46A verification failed: anon gained a public.hotels base-table privilege';
  end if;

  if has_table_privilege('authenticated', 'public.hotels', 'INSERT')
    or has_table_privilege('authenticated', 'public.hotels', 'UPDATE')
    or has_table_privilege('authenticated', 'public.hotels', 'DELETE')
  then
    raise exception '46A verification failed: authenticated gained hotels DML';
  end if;

  if exists (
    select 1
    from public.profiles
    where lower(trim(coalesce(role, ''))) = 'platform_admin'
  ) then
    raise exception '46A verification failed: platform_admin must not appear in profiles';
  end if;

  foreach helper_name in array array[
    'has_active_hotel_role',
    'has_active_hotel_path_role',
    'admin_update_hotel_user'
  ] loop
    if exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = helper_name
        and pg_get_functiondef(p.oid) ~* 'platform_admin'
    ) then
      raise exception '46A verification failed: platform_admin leaked into hotel helper %',
        helper_name;
    end if;
  end loop;
end;
$$;

rollback;
