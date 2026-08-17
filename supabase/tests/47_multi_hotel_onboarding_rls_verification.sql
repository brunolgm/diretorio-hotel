-- Read-only catalog/security verification for Sprint 47. No persistent mutation.
begin;

do $$
declare
  fn oid := to_regprocedure('public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)');
  source text;
begin
  if fn is null then raise exception '47 catalog: onboarding RPC missing'; end if;
  select pg_catalog.pg_get_functiondef(fn) into source;
  if not (select p.prosecdef from pg_catalog.pg_proc p where p.oid=fn)
    or not (select 'search_path=""'=any(coalesce(p.proconfig,array[]::text[])) from pg_catalog.pg_proc p where p.oid=fn) then
    raise exception '47 catalog: RPC must be SECURITY DEFINER with empty search_path';
  end if;
  if has_function_privilege('anon',fn,'EXECUTE')
    or has_function_privilege('service_role',fn,'EXECUTE')
    or not has_function_privilege('authenticated',fn,'EXECUTE') then
    raise exception '47 catalog: RPC grants drifted';
  end if;
  if source !~* 'active_platform_admin_required'
    or source !~* 'from public\.platform_users'
    or source !~* 'from auth\.users'
    or source !~* '''draft'''
    or source ~* '''active''[^;]*insert into public\.hotels' then
    raise exception '47 catalog: authorization/Auth/draft contract drifted';
  end if;
  if source !~* 'platform_hotel_slug_conflict'
    or source !~* 'platform_hotel_subdomain_conflict'
    or source !~* 'platform_initial_admin_incompatible' then
    raise exception '47 catalog: conflict/compatibility errors drifted';
  end if;
  if exists (
    select 1 from (values
      ('core.directory'),('content.services'),('content.departments'),('content.policies'),
      ('content.announcements'),('content.banners'),('rooms.qr'),('content.languages'),
      ('experience.appearance'),('experience.preview'),('analytics.basic')
    ) baseline(module_key)
    where pg_catalog.strpos(source,pg_catalog.quote_literal(module_key))=0
  ) then raise exception '47 catalog: canonical eleven-module baseline is incomplete'; end if;
  if source ~* '(experience\.navigation|experience\.seo|fb\.menu|content\.tourism|analytics\.advanced|integrations\.thex|integrations\.opera|audit\.access_logs)' then
    raise exception '47 catalog: coming-soon module leaked into onboarding RPC';
  end if;
  if source !~* 'record_platform_audit_event'
    or source ~* 'insert into public\.platform_audit_log'
    or source !~* '''hotel\.created'''
    or source !~* '''baseline_modules''[[:space:]]*,[[:space:]]*11' then
    raise exception '47 catalog: controlled shallow audit contract drifted';
  end if;
  if source !~*
  'jsonb_build_object[[:space:]]*\([[:space:]]*''brand_code''[[:space:]]*,[[:space:]]*p_brand_code[[:space:]]*,[[:space:]]*''baseline_modules''[[:space:]]*,[[:space:]]*11[[:space:]]*\)'
then
  raise exception '47 catalog: expected shallow hotel.created metadata missing';
end if;

if source ~*
  'jsonb_build_object[^;]*(p_admin_email|normalized_email|p_admin_full_name|normalized_full_name)'
then
  raise exception '47 catalog: initial administrator PII leaked into audit metadata';
end if;
end;
$$;

do $$
declare
  expected_keys text[] := array[
    'analytics.advanced','analytics.basic','audit.access_logs','content.announcements',
    'content.banners','content.departments','content.languages','content.policies',
    'content.services','content.tourism','core.directory','experience.appearance',
    'experience.navigation','experience.preview','experience.seo','fb.menu',
    'integrations.opera','integrations.thex','rooms.qr'
  ];
  actual_keys text[];
  public_hotels_definition text;
begin
  select pg_catalog.array_agg(matches[1] order by matches[1]) into actual_keys
  from pg_catalog.pg_constraint c
  cross join lateral pg_catalog.regexp_matches(
    pg_catalog.pg_get_constraintdef(c.oid),
    '''([a-z0-9._-]+)''',
    'g'
  ) matches
  where c.conrelid='public.hotel_module_entitlements'::regclass
    and c.conname='hotel_module_entitlements_module_key_check';
  if actual_keys is distinct from expected_keys then
    raise exception '47 catalog: exact canonical 19-module catalog drifted';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_index i
    join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
    where i.indrelid='public.hotels'::regclass and i.indisunique
      and i.indnkeyatts=1 and i.indpred is null and a.attname='slug'
  ) then raise exception '47 catalog: hotels.slug UNIQUE guarantee missing'; end if;
  if not exists (
    select 1 from pg_catalog.pg_index i
    join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
    where i.indrelid='public.hotels'::regclass and i.indisunique
      and i.indnkeyatts=1 and a.attname='subdomain'
      and pg_catalog.pg_get_expr(i.indpred,i.indrelid) ~* 'subdomain[[:space:]]+is[[:space:]]+not[[:space:]]+null'
  ) then raise exception '47 catalog: hotels.subdomain UNIQUE guarantee missing'; end if;
  if has_table_privilege('anon','public.hotels','INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.hotels','INSERT,UPDATE,DELETE')
    or has_table_privilege('anon','public.profiles','INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.hotel_module_entitlements','SELECT,INSERT,UPDATE,DELETE') then
    raise exception '47 catalog: direct browser privilege expanded';
  end if;
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname='public' and tablename='hotels'
      and (coalesce(qual,'') ~* 'platform_users|platform_admin' or coalesce(with_check,'') ~* 'platform_users|platform_admin')
  ) then raise exception '47 catalog: global platform access leaked into hotels policies'; end if;
  public_hotels_definition :=
    pg_catalog.pg_get_viewdef('public.public_hotels'::regclass, true);

  if public_hotels_definition !~*
      'platform_status[[:space:]]*=[[:space:]]*''active''(::text)?'
    or public_hotels_definition !~*
      'is_hotel_module_enabled[[:space:]]*\([[:space:]]*id[[:space:]]*,[[:space:]]*''core\.directory''(::text)?[[:space:]]*\)'
  then
    raise exception '47 catalog: lifecycle/entitlement public isolation drifted';
  end if;
end;
$$;

rollback;
