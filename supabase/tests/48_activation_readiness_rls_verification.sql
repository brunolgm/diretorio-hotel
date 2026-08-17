-- Read-only catalog/security verification for Sprint 48.
begin;

do $$
declare
  internal_fn oid := to_regprocedure('public.calculate_hotel_readiness(uuid)');
  platform_fn oid := to_regprocedure('public.get_platform_hotel_readiness(uuid)');
  current_fn oid := to_regprocedure('public.get_current_hotel_readiness()');
  status_source text;
  readiness_source text;
  expected_check_keys text[] := array[
    'admin.active','contact.primary','content.banners','content.departments',
    'content.policies','content.services','experience.preview','identity.city',
    'identity.name','identity.slug','identity.subdomain','languages.translations',
    'module.core_directory','operation.breakfast','operation.checkin',
    'operation.checkout','rooms.qr','visual.hero','visual.logo'
  ];
  expected_key text;
begin
  if internal_fn is null or platform_fn is null or current_fn is null then
    raise exception '48 catalog: readiness function missing';
  end if;
  if exists(select 1 from pg_catalog.pg_proc p where p.oid=any(array[internal_fn,platform_fn,current_fn])
      and (not p.prosecdef or p.provolatile<>'s' or not ('search_path=""'=any(coalesce(p.proconfig,array[]::text[]))))) then
    raise exception '48 catalog: readiness SECURITY DEFINER/STABLE/search_path contract invalid';
  end if;
  if has_function_privilege('anon',internal_fn,'EXECUTE')
    or has_function_privilege('authenticated',internal_fn,'EXECUTE')
    or has_function_privilege('service_role',internal_fn,'EXECUTE') then
    raise exception '48 catalog: internal readiness evaluator is executable directly';
  end if;
  if has_function_privilege('anon',platform_fn,'EXECUTE')
    or has_function_privilege('anon',current_fn,'EXECUTE')
    or has_function_privilege('service_role',platform_fn,'EXECUTE')
    or has_function_privilege('service_role',current_fn,'EXECUTE')
    or not has_function_privilege('authenticated',platform_fn,'EXECUTE')
    or not has_function_privilege('authenticated',current_fn,'EXECUTE') then
    raise exception '48 catalog: public readiness RPC grants invalid';
  end if;

  select pg_catalog.pg_get_functiondef(internal_fn) into readiness_source;
  if readiness_source ~* 'wifi_password|select[[:space:]]+\*[^;]*return'
    or readiness_source !~* 'identity\.name'
    or readiness_source !~* 'admin\.active'
    or readiness_source !~* 'module\.core_directory'
    or readiness_source !~* 'experience\.preview' then
    raise exception '48 catalog: fixed/safe readiness projection drifted';
  end if;
  foreach expected_key in array expected_check_keys loop
    if pg_catalog.strpos(readiness_source,pg_catalog.quote_literal(expected_key))=0 then
      raise exception '48 catalog: canonical readiness key % is missing',expected_key;
    end if;
  end loop;

  select pg_catalog.pg_get_functiondef('public.update_platform_hotel_status(uuid,text)'::regprocedure)
    into status_source;
  if status_source !~* 'previous_status[[:space:]]*=[[:space:]]*''draft''[[:space:]]+and[[:space:]]+p_status[[:space:]]*=[[:space:]]*''active'''
    or status_source !~* 'platform_hotel_not_ready'
    or status_source !~* 'calculate_hotel_readiness'
    or status_source !~* '''hotel\.status_updated'''
    or status_source !~* '''previous_status'''
    or status_source !~* '''new_status''' then
    raise exception '48 catalog: gated lifecycle/audit contract drifted';
  end if;
end;
$$;

do $$
declare public_hotels_source text;
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='hotels'
      and column_name in ('readiness_status','setup_status','onboarding_status','go_live_status')) then
    raise exception '48 catalog: readiness state was persisted';
  end if;
  if exists(select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='hotels'
      and (coalesce(qual,'') ~* 'readiness' or coalesce(with_check,'') ~* 'readiness')) then
    raise exception '48 catalog: readiness leaked into hotels RLS';
  end if;
  select pg_catalog.pg_get_viewdef('public.public_hotels'::regclass,true)
    into public_hotels_source;
  if public_hotels_source !~* '([a-z_][a-z0-9_]*\.)?platform_status[[:space:]]*=[[:space:]]*''active''(::text)?'
    or public_hotels_source !~* '(public\.)?is_hotel_module_enabled[[:space:]]*\([[:space:]]*([a-z_][a-z0-9_]*\.)?id[[:space:]]*,[[:space:]]*''core\.directory''(::text)?[[:space:]]*\)'
    or public_hotels_source ~* 'readiness' then
    raise exception '48 catalog: public lifecycle/entitlement isolation drifted';
  end if;
end;
$$;

rollback;
