-- Sprint 52: controlled opt-in availability for Tourism.
-- Only the canonical governance RPC changes. No entitlement/backfill/onboarding writes.
-- CREATE OR REPLACE preserves the existing function identity, owner and ACL.
do $$ begin
  if to_regprocedure('public.update_platform_hotel_module(uuid,text,boolean)') is null
    or to_regprocedure('public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)') is null
    or to_regclass('public.hotel_tourism_items') is null
    or to_regprocedure('public.update_current_hotel_tourism_image(uuid,text,timestamptz)') is null then
    raise exception '52 governance preflight: reviewed Tourism/governance contracts missing';
  end if;
  if not exists(select 1 from pg_catalog.pg_proc p
    where p.oid='public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure
      and p.prosecdef and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[])))
    or not has_function_privilege('authenticated','public.update_platform_hotel_module(uuid,text,boolean)','EXECUTE')
    or has_function_privilege('anon','public.update_platform_hotel_module(uuid,text,boolean)','EXECUTE')
    or has_function_privilege('service_role','public.update_platform_hotel_module(uuid,text,boolean)','EXECUTE') then
    raise exception '52 governance preflight: authorization/grants drifted';
  end if;
end $$;

create or replace function public.update_platform_hotel_module(p_hotel_id uuid,p_module_key text,p_enabled boolean)
returns table(module_key text,is_enabled boolean,enabled_at timestamptz,disabled_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); current_enabled boolean; changed_at timestamptz:=now();
begin
  if actor_id is null or not exists(select 1 from public.platform_users pu where pu.user_id=actor_id and pu.role='platform_admin' and pu.is_active) then raise exception using errcode='42501',message='active_platform_admin_required'; end if;
  if p_module_key not in('core.directory','content.services','content.departments','content.policies','content.announcements','content.banners','rooms.qr','content.languages','experience.appearance','experience.navigation','experience.preview','experience.seo','fb.menu','content.tourism','analytics.basic','analytics.advanced','travel.flights','integrations.thex','integrations.opera','audit.access_logs') then raise exception using errcode='22023',message='platform_module_invalid'; end if;
  if p_enabled is null then raise exception using errcode='22023',message='platform_module_state_invalid'; end if;
  if p_enabled and p_module_key in('experience.seo','fb.menu','analytics.advanced','integrations.thex','integrations.opera','audit.access_logs') then raise exception using errcode='55000',message='platform_module_not_available'; end if;
  if p_module_key='core.directory' and not p_enabled then raise exception using errcode='22023',message='platform_module_dependency_required'; end if;
  perform 1 from public.hotels h where h.id=p_hotel_id for update;
  if not found then raise exception using errcode='P0002',message='platform_hotel_not_found'; end if;
  if p_enabled and p_module_key<>'core.directory' and not public.is_hotel_module_enabled(p_hotel_id,'core.directory') then raise exception using errcode='55000',message='platform_module_dependency_required'; end if;
  select e.is_enabled into current_enabled from public.hotel_module_entitlements e where e.hotel_id=p_hotel_id and e.module_key=p_module_key for update;
  if found and current_enabled=p_enabled then return query select e.module_key,e.is_enabled,e.enabled_at,e.disabled_at from public.hotel_module_entitlements e where e.hotel_id=p_hotel_id and e.module_key=p_module_key; return; end if;
  insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,enabled_by,disabled_at,disabled_by,updated_at)
  values(p_hotel_id,p_module_key,p_enabled,case when p_enabled then changed_at end,case when p_enabled then actor_id end,case when not p_enabled then changed_at end,case when not p_enabled then actor_id end,changed_at)
  on conflict on constraint hotel_module_entitlements_pkey do update set is_enabled=excluded.is_enabled,enabled_at=excluded.enabled_at,enabled_by=excluded.enabled_by,disabled_at=excluded.disabled_at,disabled_by=excluded.disabled_by,updated_at=excluded.updated_at;
  perform public.record_platform_audit_event(actor_id,case when p_enabled then 'hotel.module_enabled' else 'hotel.module_disabled' end,'hotel',p_hotel_id,pg_catalog.jsonb_build_object('module_key',p_module_key),null);
  return query select e.module_key,e.is_enabled,e.enabled_at,e.disabled_at from public.hotel_module_entitlements e where e.hotel_id=p_hotel_id and e.module_key=p_module_key;
end;
$$;
