-- Sprint 51, stage 1: optional travel.flights entitlement only.
-- No hotel receives this module automatically; the twelve-module baseline is unchanged.

do $$
declare
  actual_keys text[];
  platform_catalog_fn text;
  platform_update_fn text;
  onboarding_fn text;
  onboarding_keys text[];
begin
  if to_regclass('public.hotel_module_entitlements') is null
    or to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is null
    or to_regprocedure('public.get_current_hotel_modules()') is null
    or to_regprocedure('public.get_platform_hotel_modules(uuid)') is null
    or to_regprocedure('public.update_platform_hotel_module(uuid,text,boolean)') is null
    or to_regprocedure('public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)') is null then
    raise exception '51 entitlement preflight failed: required module contracts are missing';
  end if;

  select array_agg(matches[1] order by matches[1]) into actual_keys
  from pg_catalog.pg_constraint c
  cross join lateral pg_catalog.regexp_matches(
    pg_catalog.pg_get_constraintdef(c.oid),
    '''([a-z0-9._-]+)''',
    'g'
  ) matches
  where c.conrelid = 'public.hotel_module_entitlements'::regclass
    and c.conname = 'hotel_module_entitlements_module_key_check';

  if actual_keys is distinct from array[
    'analytics.advanced','analytics.basic','audit.access_logs','content.announcements',
    'content.banners','content.departments','content.languages','content.policies',
    'content.services','content.tourism','core.directory','experience.appearance',
    'experience.navigation','experience.preview','experience.seo','fb.menu',
    'integrations.opera','integrations.thex','rooms.qr'
  ]::text[] then
    raise exception '51 entitlement preflight failed: canonical 19-module constraint drifted';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.get_platform_hotel_modules(uuid)'::regprocedure
  ) into platform_catalog_fn;
  select pg_catalog.pg_get_functiondef(
    'public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure
  ) into platform_update_fn;
  select pg_catalog.pg_get_functiondef(
    'public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)'::regprocedure
  ) into onboarding_fn;

  if platform_catalog_fn !~* 'audit\.access_logs'
    or platform_update_fn !~* 'platform_module_not_available'
    or platform_update_fn !~* 'perform public\.record_platform_audit_event' then
    raise exception '51 entitlement preflight failed: reviewed Platform module contract drifted';
  end if;

  select pg_catalog.array_agg(distinct matches[1] order by matches[1]) into onboarding_keys
  from pg_catalog.regexp_matches(
    onboarding_fn,
    '''((analytics|audit|content|core|experience|fb|integrations|rooms|travel)\.[a-z0-9._-]+)''',
    'g'
  ) matches;

  if onboarding_keys is distinct from array[
    'analytics.basic','content.announcements','content.banners','content.departments',
    'content.languages','content.policies','content.services','core.directory',
    'experience.appearance','experience.navigation','experience.preview','rooms.qr'
  ]::text[]
    or onboarding_fn !~* '''baseline_modules'',[[:space:]]*12' then
    raise exception '51 entitlement preflight failed: twelve-module onboarding baseline drifted';
  end if;
end;
$$;

alter table public.hotel_module_entitlements
  drop constraint hotel_module_entitlements_module_key_check;

alter table public.hotel_module_entitlements
  add constraint hotel_module_entitlements_module_key_check check (module_key in (
    'core.directory','content.services','content.departments','content.policies',
    'content.announcements','content.banners','rooms.qr','content.languages',
    'experience.appearance','experience.navigation','experience.preview','experience.seo',
    'fb.menu','content.tourism','analytics.basic','analytics.advanced','travel.flights',
    'integrations.thex','integrations.opera','audit.access_logs'
  ));

create or replace function public.is_hotel_module_enabled(p_hotel_id uuid,p_module_key text)
returns boolean language sql stable security definer set search_path='' as $$
  select case when p_module_key in (
    'core.directory','content.services','content.departments','content.policies','content.announcements',
    'content.banners','rooms.qr','content.languages','experience.appearance','experience.navigation',
    'experience.preview','experience.seo','fb.menu','content.tourism','analytics.basic',
    'analytics.advanced','travel.flights','integrations.thex','integrations.opera','audit.access_logs'
  ) then exists (
    select 1 from public.hotel_module_entitlements e
    where e.hotel_id=p_hotel_id and e.module_key=p_module_key and e.is_enabled
  ) else false end;
$$;

create or replace function public.get_platform_hotel_modules(p_hotel_id uuid)
returns table(module_key text,is_enabled boolean,enabled_at timestamptz,disabled_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.platform_users pu
    where pu.user_id=auth.uid() and pu.role='platform_admin' and pu.is_active
  ) then
    raise exception using errcode='42501',message='active_platform_admin_required';
  end if;
  if not exists(select 1 from public.hotels h where h.id=p_hotel_id) then
    raise exception using errcode='P0002',message='platform_hotel_not_found';
  end if;
  return query
  select catalog.module_key,coalesce(e.is_enabled,false),e.enabled_at,e.disabled_at
  from (values
    ('core.directory'),('content.services'),('content.departments'),('content.policies'),
    ('content.announcements'),('content.banners'),('rooms.qr'),('content.languages'),
    ('experience.appearance'),('experience.navigation'),('experience.preview'),('experience.seo'),
    ('fb.menu'),('content.tourism'),('analytics.basic'),('analytics.advanced'),('travel.flights'),
    ('integrations.thex'),('integrations.opera'),('audit.access_logs')
  ) catalog(module_key)
  left join public.hotel_module_entitlements e
    on e.hotel_id=p_hotel_id and e.module_key=catalog.module_key;
end;
$$;

create or replace function public.update_platform_hotel_module(p_hotel_id uuid,p_module_key text,p_enabled boolean)
returns table(module_key text,is_enabled boolean,enabled_at timestamptz,disabled_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); current_enabled boolean; changed_at timestamptz:=now();
begin
  if actor_id is null or not exists(select 1 from public.platform_users pu where pu.user_id=actor_id and pu.role='platform_admin' and pu.is_active) then raise exception using errcode='42501',message='active_platform_admin_required'; end if;
  if p_module_key not in('core.directory','content.services','content.departments','content.policies','content.announcements','content.banners','rooms.qr','content.languages','experience.appearance','experience.navigation','experience.preview','experience.seo','fb.menu','content.tourism','analytics.basic','analytics.advanced','travel.flights','integrations.thex','integrations.opera','audit.access_logs') then raise exception using errcode='22023',message='platform_module_invalid'; end if;
  if p_enabled is null then raise exception using errcode='22023',message='platform_module_state_invalid'; end if;
  if p_enabled and p_module_key in('experience.seo','fb.menu','content.tourism','analytics.advanced','integrations.thex','integrations.opera','audit.access_logs') then raise exception using errcode='55000',message='platform_module_not_available'; end if;
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

revoke all on function public.is_hotel_module_enabled(uuid,text) from public;
grant execute on function public.is_hotel_module_enabled(uuid,text) to anon,authenticated,service_role;
revoke all on function public.get_platform_hotel_modules(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_platform_hotel_modules(uuid) to authenticated;
revoke all on function public.update_platform_hotel_module(uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.update_platform_hotel_module(uuid,text,boolean) to authenticated;

do $$
declare
  canonical_keys text[];
begin
  select array_agg(matches[1] order by matches[1]) into canonical_keys
  from pg_catalog.pg_constraint c
  cross join lateral pg_catalog.regexp_matches(
    pg_catalog.pg_get_constraintdef(c.oid),
    '''([a-z0-9._-]+)''',
    'g'
  ) matches
  where c.conrelid='public.hotel_module_entitlements'::regclass
    and c.conname='hotel_module_entitlements_module_key_check';

  if canonical_keys is distinct from array[
    'analytics.advanced','analytics.basic','audit.access_logs','content.announcements',
    'content.banners','content.departments','content.languages','content.policies',
    'content.services','content.tourism','core.directory','experience.appearance',
    'experience.navigation','experience.preview','experience.seo','fb.menu',
    'integrations.opera','integrations.thex','rooms.qr','travel.flights'
  ]::text[] then
    raise exception '51 entitlement verification failed: canonical 20-module catalog invalid';
  end if;

  if exists(select 1 from public.hotel_module_entitlements where module_key='travel.flights') then
    raise exception '51 entitlement verification failed: travel.flights was enabled or provisioned automatically';
  end if;
end;
$$;
