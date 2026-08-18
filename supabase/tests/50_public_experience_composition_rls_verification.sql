-- Read-only catalog/security verification for Sprint 50.
begin;

do $$
declare keys text[]; fn oid; source text;
begin
  if to_regclass('public.hotel_experience_layout') is null then raise exception '50 catalog: layout table missing'; end if;
  if not exists(select 1 from pg_catalog.pg_class c where c.oid='public.hotel_experience_layout'::regclass and c.relrowsecurity) then raise exception '50 catalog: RLS disabled'; end if;
  if exists(select 1 from pg_catalog.pg_policies p where p.schemaname='public' and p.tablename='hotel_experience_layout') then raise exception '50 catalog: layout policies must remain closed'; end if;
  if has_table_privilege('anon','public.hotel_experience_layout','SELECT')
    or has_table_privilege('authenticated','public.hotel_experience_layout','SELECT')
    or has_table_privilege('service_role','public.hotel_experience_layout','SELECT')
    or has_table_privilege('authenticated','public.hotel_experience_layout','INSERT')
    or has_table_privilege('authenticated','public.hotel_experience_layout','UPDATE')
    or has_table_privilege('authenticated','public.hotel_experience_layout','DELETE') then raise exception '50 catalog: direct layout grants exist'; end if;
  select pg_catalog.array_agg(m[1] order by m[1]) into keys from pg_catalog.pg_constraint c
  cross join lateral pg_catalog.regexp_matches(pg_catalog.pg_get_constraintdef(c.oid),'''([a-z_]+)''','g') m
  where c.conrelid='public.hotel_experience_layout'::regclass and c.conname='hotel_experience_layout_block_key_check';
  if keys is distinct from array['announcements','banners','contact','departments','hero','policies','quick_info','services']::text[] then raise exception '50 catalog: block catalog drifted'; end if;
  if not exists(select 1 from pg_catalog.pg_constraint c where c.conrelid='public.hotel_experience_layout'::regclass and c.conname='hotel_experience_layout_position_key' and c.contype='u' and c.condeferrable and c.condeferred)
    or not exists(select 1 from pg_catalog.pg_constraint c where c.conrelid='public.hotel_experience_layout'::regclass and c.conname='hotel_experience_layout_hero_check') then raise exception '50 catalog: order/hero constraints missing'; end if;

  foreach fn in array array[
    to_regprocedure('public.get_current_hotel_experience_layout()'),
    to_regprocedure('public.get_public_hotel_experience_layout(uuid)'),
    to_regprocedure('public.update_current_hotel_experience_block(text,boolean)'),
    to_regprocedure('public.reorder_current_hotel_experience_blocks(text[])')
  ] loop
    if fn is null or not exists(select 1 from pg_catalog.pg_proc p where p.oid=fn and p.prosecdef and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))) then raise exception '50 catalog: RPC security contract invalid'; end if;
    if pg_catalog.pg_get_function_result(fn) !~* 'table\s*\(\s*block_key text\s*,\s*is_enabled boolean\s*,\s*block_position smallint\s*\)' then
      raise exception '50 catalog: RPC return contract must expose block_position';
    end if;
  end loop;
  if not has_function_privilege('authenticated','public.get_current_hotel_experience_layout()','EXECUTE')
    or has_function_privilege('anon','public.get_current_hotel_experience_layout()','EXECUTE')
    or not has_function_privilege('anon','public.get_public_hotel_experience_layout(uuid)','EXECUTE')
    or has_function_privilege('anon','public.update_current_hotel_experience_block(text,boolean)','EXECUTE')
    or has_function_privilege('service_role','public.reorder_current_hotel_experience_blocks(text[])','EXECUTE') then raise exception '50 catalog: RPC grants invalid'; end if;
  select pg_catalog.pg_get_functiondef('public.update_current_hotel_experience_block(text,boolean)'::regprocedure) into source;
  if source !~* 'auth\.uid\(\)' or source !~* 'from public\.profiles'
    or source !~* 'has_active_hotel_role.*editor'
    or source !~* 'experience\.navigation' or source !~* 'experience_block_entitlement_required'
    or source !~* 'record_admin_audit_event' or source ~* 'p_hotel_id' then raise exception '50 catalog: mutation scope drifted'; end if;
  select pg_catalog.pg_get_functiondef('public.reorder_current_hotel_experience_blocks(text[])'::regprocedure) into source;
  if source !~* 'count\(distinct' or source !~* 'set constraints public\.hotel_experience_layout_position_key deferred'
    or source !~* 'experience\.layout_updated' then raise exception '50 catalog: atomic reorder contract drifted'; end if;
  select pg_catalog.pg_get_functiondef('public.get_public_hotel_experience_layout(uuid)'::regprocedure) into source;
  if source !~* 'is_hotel_publicly_active' or source !~* 'core\.directory'
    or source !~* 'content\.services' or source !~* 'experience\.navigation' then raise exception '50 catalog: public entitlement contract drifted'; end if;
end;
$$;

do $$
declare
  module_source text;
  unavailable_modules text;
  required_unavailable text;
  platform_audit_source text;
  admin_audit_source text;
  onboarding_source text;
  onboarding_keys text[];
begin
  select pg_catalog.pg_get_functiondef('public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure) into module_source;
  select (pg_catalog.regexp_match(
    module_source,
    'p_enabled[[:space:]]+and[[:space:]]+p_module_key[[:space:]]+in[[:space:]]*\(([^)]*)\).*?platform_module_not_available',
    'i'
  ))[1] into unavailable_modules;
  if module_source !~* '''experience\.navigation'''
    or module_source !~* 'platform_module_not_available'
    or unavailable_modules is null
    or unavailable_modules ~* '''experience\.navigation''' then
    raise exception '50 catalog: navigation availability not evolved safely';
  end if;
  foreach required_unavailable in array array[
    'experience.seo','fb.menu','content.tourism','analytics.advanced',
    'integrations.thex','integrations.opera','audit.access_logs'
  ] loop
    if pg_catalog.strpos(unavailable_modules,pg_catalog.quote_literal(required_unavailable))=0 then
      raise exception '50 catalog: unavailable module guard lost %',required_unavailable;
    end if;
  end loop;
  select pg_catalog.pg_get_functiondef('public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)'::regprocedure) into onboarding_source;
  select pg_catalog.array_agg(distinct m[1] order by m[1]) into onboarding_keys
  from pg_catalog.regexp_matches(onboarding_source,'''((analytics|audit|content|core|experience|fb|integrations|rooms)\.[a-z0-9._-]+)''','g') m;
  if onboarding_keys is distinct from array[
      'analytics.basic','content.announcements','content.banners','content.departments',
      'content.languages','content.policies','content.services','core.directory',
      'experience.appearance','experience.navigation','experience.preview','rooms.qr'
    ]::text[]
    or onboarding_source !~* 'baseline_modules.*12'
    or onboarding_source ~* 'baseline_modules.*11' then raise exception '50 catalog: onboarding baseline is not explicitly twelve'; end if;
  select pg_catalog.pg_get_functiondef('public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)'::regprocedure) into platform_audit_source;
  if platform_audit_source ~* 'effective_metadata|baseline_modules'
    or platform_audit_source !~* 'platform_audit_metadata_invalid' then raise exception '50 catalog: platform audit writer transforms metadata'; end if;
  select pg_catalog.pg_get_functiondef('public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)'::regprocedure) into admin_audit_source;
  if admin_audit_source !~* 'audit_actor_not_authorized'
    or admin_audit_source !~* 'audit_metadata_invalid'
    or admin_audit_source !~* 'jsonb_path_exists'
    or has_function_privilege('anon','public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)','EXECUTE')
    or has_function_privilege('authenticated','public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)','EXECUTE')
    or not has_function_privilege('service_role','public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)','EXECUTE') then raise exception '50 catalog: hotel audit writer contract drifted'; end if;
  if not exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid='public.hotels'::regclass and t.tgname='50_initialize_hotel_experience_layout') then raise exception '50 catalog: onboarding initializer missing'; end if;
  if exists(select 1 from public.hotels h where
      (select count(*) from public.hotel_experience_layout l where l.hotel_id=h.id)<>8
      or not public.is_hotel_module_enabled(h.id,'experience.navigation')) then raise exception '50 catalog: existing hotel defaults incomplete'; end if;
  if pg_catalog.pg_get_functiondef('public.calculate_hotel_readiness(uuid)'::regprocedure) ~* 'hotel_experience_layout' then raise exception '50 catalog: composition became a readiness blocker'; end if;
end;
$$;

rollback;
