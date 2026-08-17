-- Read-only catalog/RLS verification for Sprint 46.8. Safe against a reviewed database.
begin;

do $$
declare direct_policies integer; canonical_keys integer; baseline_bad integer;
begin
  if to_regclass('public.hotel_module_entitlements') is null then raise exception '46.8: table missing'; end if;
  if not (select relrowsecurity from pg_catalog.pg_class where oid='public.hotel_module_entitlements'::regclass) then raise exception '46.8: RLS disabled'; end if;
  select count(*) into direct_policies from pg_catalog.pg_policies where schemaname='public' and tablename='hotel_module_entitlements';
  if direct_policies <> 0 then raise exception '46.8: entitlement table must have zero policies'; end if;
  if has_table_privilege('anon','public.hotel_module_entitlements','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.hotel_module_entitlements','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('service_role','public.hotel_module_entitlements','SELECT,INSERT,UPDATE,DELETE') then
    raise exception '46.8: direct table privilege leaked';
  end if;
  if to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is null
    or to_regprocedure('public.get_current_hotel_modules()') is null
    or to_regprocedure('public.get_platform_hotel_modules(uuid)') is null
    or to_regprocedure('public.update_platform_hotel_module(uuid,text,boolean)') is null then raise exception '46.8: RPC contract missing'; end if;
  if exists (select 1 from pg_catalog.pg_proc p where p.oid in (
      'public.is_hotel_module_enabled(uuid,text)'::regprocedure,'public.get_current_hotel_modules()'::regprocedure,
      'public.get_platform_hotel_modules(uuid)'::regprocedure,'public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure)
      and (not p.prosecdef or not ('search_path=""'=any(coalesce(p.proconfig,array[]::text[]))))) then raise exception '46.8: SECURITY DEFINER/search_path contract invalid'; end if;
  if has_function_privilege('anon','public.get_current_hotel_modules()','EXECUTE')
    or has_function_privilege('anon','public.get_platform_hotel_modules(uuid)','EXECUTE')
    or has_function_privilege('anon','public.update_platform_hotel_module(uuid,text,boolean)','EXECUTE') then raise exception '46.8: anon can execute protected RPC'; end if;
  if not has_function_privilege('authenticated','public.get_current_hotel_modules()','EXECUTE')
    or not has_function_privilege('authenticated','public.get_platform_hotel_modules(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.update_platform_hotel_module(uuid,text,boolean)','EXECUTE') then raise exception '46.8: authenticated RPC grant missing'; end if;
  select count(*) into canonical_keys
  from pg_constraint c
  cross join lateral regexp_matches(pg_get_constraintdef(c.oid),'''[a-z0-9._-]+''','g')
  where c.conrelid='public.hotel_module_entitlements'::regclass and c.conname='hotel_module_entitlements_module_key_check';
  if canonical_keys <> 19 then raise exception '46.8: canonical CHECK does not contain 19 keys'; end if;
  if not exists(select 1 from pg_constraint where conrelid='public.hotel_module_entitlements'::regclass and contype='f' and pg_get_constraintdef(oid) ~* 'hotels.*ON DELETE CASCADE') then raise exception '46.8: hotel FK/cascade missing'; end if;
  if exists(select 1 from pg_constraint where conrelid='public.hotel_module_entitlements'::regclass and contype='f' and pg_get_constraintdef(oid) ~* '(enabled_by|disabled_by)') then raise exception '46.8: destructive actor FK present'; end if;
  select count(*) into baseline_bad from public.hotels h where (select count(*) from public.hotel_module_entitlements e where e.hotel_id=h.id and e.is_enabled) <> 11;
  if baseline_bad <> 0 then raise exception '46.8: existing hotel baseline is not eleven enabled modules'; end if;
  if exists(select 1 from public.hotels h where not public.is_hotel_module_enabled(h.id,'experience.preview')) then raise exception '46.8: experience.preview is not available in baseline'; end if;
  if pg_get_viewdef('public.public_hotels'::regclass,true) !~* 'core.directory' then raise exception '46.8: public hotel resolution ignores core.directory'; end if;
  if (select count(*) from pg_policies where schemaname='public' and policyname like '45b_public_%' and coalesce(qual,'') ~ 'is_hotel_module_enabled') < 10 then raise exception '46.8: public policies ignore entitlements'; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='hotels' and coalesce(qual,'') ~* 'platform_users') then raise exception '46.8: global hotels policy introduced'; end if;
  if pg_get_functiondef('public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure) !~* 'platform_module_not_available'
    or pg_get_functiondef('public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure) !~* 'platform_module_dependency_required'
    or pg_get_functiondef('public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure) !~* 'record_platform_audit_event'
    or pg_get_functiondef('public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure) ~* 'insert[[:space:]]+into[[:space:]]+public\.platform_audit_log' then
    raise exception '46.8: availability/dependency/controlled audit contract invalid';
  end if;
  if pg_get_functiondef('public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)'::regprocedure) !~* 'hotel\.module_enabled'
    or pg_get_functiondef('public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)'::regprocedure) !~* 'hotel\.module_disabled' then
    raise exception '46.8: known audit writer was not safely extended';
  end if;
end;
$$;

rollback;
