-- Sprint 53 closure: allow explicit Platform Admin opt-in. No entitlement writes.
-- Preserve the deployed governance function, identity, ownership, ACL and every
-- other module rule. Abort rather than overwrite an unexpected definition.
do $$
declare definition text; marker text:='p_enabled and p_module_key in(''experience.seo'',''fb.menu'',';
begin
 if to_regclass('public.hotel_fb_outlets') is null
 or to_regprocedure('public.get_public_hotel_fb(uuid,text)') is null
 or to_regprocedure('public.save_current_hotel_fb(text,uuid,integer,jsonb)') is null
 or to_regprocedure('public.update_platform_hotel_module(uuid,text,boolean)') is null then
  raise exception '53 governance preflight: F&B/governance contracts missing';
 end if;
 if not has_function_privilege('authenticated','public.update_platform_hotel_module(uuid,text,boolean)','EXECUTE')
 or has_function_privilege('anon','public.update_platform_hotel_module(uuid,text,boolean)','EXECUTE')
 or has_function_privilege('service_role','public.update_platform_hotel_module(uuid,text,boolean)','EXECUTE') then
  raise exception '53 governance preflight: grants drifted';
 end if;
 if not exists(select 1 from pg_catalog.pg_proc p where p.oid='public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure
  and p.prosecdef and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))) then
  raise exception '53 governance preflight: function security drifted';
 end if;
 select pg_get_functiondef('public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure) into definition;
 if (length(definition)-length(replace(definition,marker,'')))/length(marker)<>1
 or definition not like '%active_platform_admin_required%'
 or definition not like '%record_platform_audit_event%' then
  raise exception '53 governance preflight: unexpected module governance definition';
 end if;
 execute replace(definition,marker,'p_enabled and p_module_key in(''experience.seo'',');
end $$;
