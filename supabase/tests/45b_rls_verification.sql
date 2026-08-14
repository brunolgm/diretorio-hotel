-- Run only against a disposable local/preview database after applying the 45B migrations.
-- This script is read-only: it verifies the resulting catalog and privileges.
-- Behavioral A/B tests additionally require a reviewed synthetic seed because the repository
-- does not contain the original hotels/profiles baseline or a Supabase local config.

begin;

do $$
begin
  if has_table_privilege('authenticated', 'public.hotels', 'UPDATE')
    or has_table_privilege('anon', 'public.hotels', 'UPDATE')
  then
    raise exception 'browser roles must not have UPDATE on public.hotels';
  end if;
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'hotels'
      and cmd in ('UPDATE', 'ALL')
      and roles && array['public', 'anon', 'authenticated']::name[]
  ) then
    raise exception 'public.hotels must not have a browser UPDATE policy';
  end if;
  if has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'authenticated must not have direct UPDATE on public.profiles';
  end if;
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd in ('UPDATE', 'ALL')
      and roles && array['public', 'anon', 'authenticated']::name[]
  ) then
    raise exception 'public.profiles must not have a browser UPDATE policy';
  end if;

  if has_table_privilege('anon', 'public.hotel_analytics_events', 'INSERT') then
    raise exception 'anon must not have direct analytics INSERT';
  end if;
  if has_table_privilege('authenticated', 'public.hotel_analytics_events', 'INSERT') then
    raise exception 'authenticated must not have direct analytics INSERT';
  end if;
  if not has_table_privilege('service_role', 'public.hotel_analytics_events', 'INSERT') then
    raise exception 'service_role must retain analytics INSERT for the server gatekeeper';
  end if;

  if has_table_privilege('anon', 'public.hotel_room_links', 'SELECT') then
    raise exception 'anon must not list room links/tokens';
  end if;
  if not has_table_privilege('authenticated', 'public.hotel_room_links', 'SELECT')
    or not has_table_privilege('authenticated', 'public.hotel_room_links', 'INSERT')
    or not has_table_privilege('authenticated', 'public.hotel_room_links', 'UPDATE')
    or has_table_privilege('authenticated', 'public.hotel_room_links', 'DELETE')
  then
    raise exception 'authenticated room-link grants must be SELECT, INSERT and UPDATE only';
  end if;
  if not has_table_privilege('service_role', 'public.hotel_room_links', 'SELECT')
    or has_table_privilege('service_role', 'public.hotel_room_links', 'INSERT')
    or has_table_privilege('service_role', 'public.hotel_room_links', 'UPDATE')
    or has_table_privilege('service_role', 'public.hotel_room_links', 'DELETE')
  then
    raise exception 'service_role room-link grant must be SELECT only';
  end if;
  if has_table_privilege('anon', 'public.admin_audit_log', 'SELECT') then
    raise exception 'anon must not read audit events';
  end if;
  if has_table_privilege('authenticated', 'public.admin_audit_log', 'INSERT') then
    raise exception 'browser roles must not insert audit events';
  end if;
  if has_table_privilege('service_role', 'public.admin_audit_log', 'INSERT')
    or has_table_privilege('service_role', 'public.admin_audit_log', 'SELECT')
  then
    raise exception 'service_role must use the audit function and must not access the table directly';
  end if;
  if has_table_privilege('authenticated', 'public.admin_audit_log', 'UPDATE')
    or has_table_privilege('authenticated', 'public.admin_audit_log', 'DELETE')
    or has_table_privilege('service_role', 'public.admin_audit_log', 'UPDATE')
    or has_table_privilege('service_role', 'public.admin_audit_log', 'DELETE')
  then
    raise exception 'audit log must remain append-only through declared grants';
  end if;

  if has_function_privilege(
    'anon', 'public.admin_update_hotel_user(uuid,text,text,text,boolean)', 'EXECUTE'
  ) then
    raise exception 'anon must not execute the last-admin RPC';
  end if;
  if not has_function_privilege(
    'authenticated', 'public.admin_update_hotel_user(uuid,text,text,text,boolean)', 'EXECUTE'
  ) then
    raise exception 'authenticated must be able to call the self-authorizing admin RPC';
  end if;
  if has_function_privilege(
    'authenticated', 'public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)', 'EXECUTE'
  ) then
    raise exception 'authenticated clients must not spoof audit events';
  end if;
  if not has_function_privilege(
    'service_role', 'public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)', 'EXECUTE'
  ) then
    raise exception 'service_role must execute the controlled audit writer';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_admin_audit_event'
      and p.prosecdef = true
      and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
  ) then
    raise exception 'audit writer must be SECURITY DEFINER with an empty search_path';
  end if;
end;
$$;

do $$
declare
  missing_policies text;
begin
  select string_agg(expected.policyname, ', ' order by expected.policyname)
    into missing_policies
  from unnest(array[
    '45b_operator_manage_sections',
    '45b_operator_manage_departments',
    '45b_operator_manage_policies',
    '45b_operator_manage_announcements',
    '45b_operator_manage_banners',
    '45b_hotel_read_analytics',
    '45b_admin_read_own_hotel_audit',
    '45b_editor_read_room_links',
    '45b_editor_insert_room_links',
    '45b_editor_update_room_links'
  ]) as expected(policyname)
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.policyname = expected.policyname
  );

  if missing_policies is not null then
    raise exception 'missing 45B public policies: %', missing_policies;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'Allow authenticated uploads to hotel-assets',
        'Allow authenticated updates in hotel-assets',
        'Hotel users can upload promotional banners',
        'Hotel users can update promotional banners',
        'Hotel users can delete promotional banners',
        'Hotel users can upload promotional banners in hotel folder',
        'Hotel users can update promotional banners in hotel folder',
        'Hotel users can delete promotional banners in hotel folder'
      )
  ) then
    raise exception 'legacy hotel-assets Storage policies must be removed';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like '45b_%'
  ) then
    raise exception 'migration 005 must not create a 45B Storage policy';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and roles && array['public', 'anon', 'authenticated']::name[]
      and not (
        (coalesce(qual, '') || ' ' || coalesce(with_check, '')) not ilike '%hotel-assets%'
        and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
          ~* 'bucket_id[[:space:]]*=[[:space:]]*''[a-z0-9][a-z0-9._-]*''(::text)?'
        and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
          !~* '(^|[^a-z_])or([^a-z_]|$)'
        and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
          !~* '(^|[^a-z_])not([^a-z_]|$)'
      )
  ) then
    raise exception 'a browser Storage policy may authorize access to hotel-assets';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_update_hotel_user'
      and p.prosecdef = true
      and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
  ) then
    raise exception 'last-admin RPC must be SECURITY DEFINER with an empty search_path';
  end if;
end;
$$;

rollback;
