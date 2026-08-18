-- Sprint 50: structured hotel-scoped composition for the public home.

do $$
declare
  module_fn text;
  onboarding_fn text;
  onboarding_keys text[];
  admin_audit_fn text;
  platform_audit_fn text;
begin
  if to_regclass('public.hotel_experience_layout') is not null
    or to_regprocedure('public.initialize_hotel_experience_layout()') is not null
    or to_regprocedure('public.get_current_hotel_experience_layout()') is not null
    or to_regprocedure('public.get_public_hotel_experience_layout(uuid)') is not null
    or to_regprocedure('public.update_current_hotel_experience_block(text,boolean)') is not null
    or to_regprocedure('public.reorder_current_hotel_experience_blocks(text[])') is not null then
    raise exception '50 preflight failed: composition objects already exist';
  end if;
  if exists(select 1 from pg_catalog.pg_trigger t
      where t.tgrelid='public.hotels'::regclass and t.tgname='50_initialize_hotel_experience_layout') then
    raise exception '50 preflight failed: composition initializer trigger already exists';
  end if;
  if to_regclass('public.hotels') is null
    or to_regclass('public.profiles') is null
    or to_regclass('public.hotel_module_entitlements') is null
    or to_regclass('public.admin_audit_log') is null
    or to_regclass('public.public_hotels') is null
    or to_regclass('public.hotel_sections') is null
    or to_regclass('public.hotel_departments') is null
    or to_regclass('public.hotel_policies') is null
    or to_regclass('public.hotel_announcements') is null
    or to_regclass('public.hotel_promotional_banners') is null then
    raise exception '50 preflight failed: required public/content contracts are missing';
  end if;
  if to_regprocedure('public.get_current_hotel_analytics(text)') is null
    or to_regprocedure('public.calculate_hotel_readiness(uuid)') is null
    or to_regprocedure('public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)') is null
    or to_regprocedure('public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)') is null
    or to_regprocedure('public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)') is null
    or to_regprocedure('public.update_platform_hotel_module(uuid,text,boolean)') is null then
    raise exception '50 preflight failed: post-49 RPC contracts are missing';
  end if;
  if not exists(select 1 from pg_catalog.pg_class c where c.oid='public.hotel_module_entitlements'::regclass and c.relrowsecurity)
    or (select count(*) from pg_catalog.pg_policies p where p.schemaname='public' and p.tablename='hotel_module_entitlements')<>0
    or has_table_privilege('authenticated','public.hotel_module_entitlements','INSERT')
    or has_table_privilege('authenticated','public.hotel_module_entitlements','UPDATE')
    or has_table_privilege('authenticated','public.hotel_module_entitlements','DELETE') then
    raise exception '50 preflight failed: entitlement protection drifted';
  end if;
  if not exists(select 1 from pg_catalog.pg_constraint c
      where c.conrelid='public.hotel_module_entitlements'::regclass
        and c.conname='hotel_module_entitlements_module_key_check'
        and pg_catalog.pg_get_constraintdef(c.oid) ~* 'experience\.navigation'
        and pg_catalog.pg_get_constraintdef(c.oid) ~* 'audit\.access_logs') then
    raise exception '50 preflight failed: canonical module constraint drifted';
  end if;
  select pg_catalog.pg_get_functiondef('public.update_platform_hotel_module(uuid,text,boolean)'::regprocedure) into module_fn;
  if module_fn !~* 'platform_module_not_available'
    or module_fn !~* 'experience\.navigation.*experience\.seo'
    or module_fn !~* 'perform public\.record_platform_audit_event' then
    raise exception '50 preflight failed: reviewed 46.8 module mutation drifted';
  end if;
  select pg_catalog.pg_get_functiondef('public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)'::regprocedure) into onboarding_fn;
  select pg_catalog.array_agg(distinct m[1] order by m[1]) into onboarding_keys
  from pg_catalog.regexp_matches(onboarding_fn,'''((analytics|audit|content|core|experience|fb|integrations|rooms)\.[a-z0-9._-]+)''','g') m;
  if onboarding_keys is distinct from array[
      'analytics.basic','content.announcements','content.banners','content.departments',
      'content.languages','content.policies','content.services','core.directory',
      'experience.appearance','experience.preview','rooms.qr'
    ]::text[]
    or onboarding_fn !~* '''baseline_modules'', 11|''baseline_modules'',11'
    or onboarding_fn ~* 'hotel_experience_layout'
    or onboarding_fn !~* 'platform_status.*draft'
    or onboarding_fn !~* 'active_platform_admin_required.*platform_initial_admin_auth_missing.*hotel\.created'
    or not exists(select 1 from pg_catalog.pg_proc p
      where p.oid='public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)'::regprocedure
        and p.prosecdef and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[])))
    or not has_function_privilege('authenticated','public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)','EXECUTE')
    or has_function_privilege('anon','public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)','EXECUTE')
    or has_function_privilege('service_role','public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)','EXECUTE') then
    raise exception '50 preflight failed: reviewed Sprint 47 onboarding drifted';
  end if;
  if not exists(select 1 from pg_catalog.pg_proc p
      where p.oid='public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)'::regprocedure
        and p.prosecdef and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))) then
    raise exception '50 preflight failed: controlled hotel audit writer drifted';
  end if;
  select pg_catalog.pg_get_functiondef(
    'public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)'::regprocedure
  ) into admin_audit_fn;
  if admin_audit_fn !~* 'audit_actor_not_authorized'
    or admin_audit_fn !~* 'audit_metadata_invalid'
    or admin_audit_fn !~* 'jsonb_path_exists'
    or admin_audit_fn !~* 'insert into public\.admin_audit_log'
    or has_function_privilege('anon','public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)','EXECUTE')
    or has_function_privilege('authenticated','public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)','EXECUTE')
    or not has_function_privilege('service_role','public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)','EXECUTE') then
    raise exception '50 preflight failed: reviewed hotel audit validation/grants drifted';
  end if;
  select pg_catalog.pg_get_functiondef(
    'public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)'::regprocedure
  ) into platform_audit_fn;
  if platform_audit_fn !~* 'hotel\.created'
    or platform_audit_fn !~* 'platform_audit_metadata_invalid'
    or platform_audit_fn !~* 'insert into public\.platform_audit_log'
    or platform_audit_fn ~* 'effective_metadata'
    or has_function_privilege('anon','public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)','EXECUTE')
    or has_function_privilege('authenticated','public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)','EXECUTE')
    or has_function_privilege('service_role','public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)','EXECUTE') then
    raise exception '50 preflight failed: reviewed platform audit writer drifted';
  end if;
  if not exists(select 1 from pg_catalog.pg_class c where c.oid='public.public_hotels'::regclass and c.relkind='v')
    or pg_catalog.pg_get_viewdef('public.public_hotels'::regclass,true) !~* 'platform_status.*active'
    or pg_catalog.pg_get_viewdef('public.public_hotels'::regclass,true) !~* 'core\.directory'
    or pg_catalog.pg_get_viewdef('public.public_hotels'::regclass,true) ~* 'readiness' then
    raise exception '50 preflight failed: public hotel resolution drifted';
  end if;
end;
$$;

create table public.hotel_experience_layout (
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  block_key text not null,
  is_enabled boolean not null default true,
  position smallint not null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint hotel_experience_layout_pkey primary key(hotel_id,block_key),
  constraint hotel_experience_layout_position_key unique(hotel_id,position) deferrable initially deferred,
  constraint hotel_experience_layout_block_key_check check(block_key in(
    'hero','banners','announcements','quick_info','services','departments','policies','contact'
  )),
  constraint hotel_experience_layout_position_check check(position between 1 and 8),
  constraint hotel_experience_layout_hero_check check(block_key<>'hero' or is_enabled)
);

alter table public.hotel_experience_layout enable row level security;
revoke all on table public.hotel_experience_layout from public,anon,authenticated,service_role;

insert into public.hotel_experience_layout(hotel_id,block_key,is_enabled,position)
select h.id,b.block_key,true,
  (case when h.brand_code in('mercure','novotel','grand-mercure') then b.brand_position else b.default_position end)::smallint
from public.hotels h cross join (values
  ('hero',1,1),('banners',2,3),('announcements',3,4),('quick_info',4,2),
  ('services',5,5),('departments',6,6),('policies',7,7),('contact',8,8)
) b(block_key,default_position,brand_position);

insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,disabled_at,updated_at)
select h.id,'experience.navigation',true,now(),null,now() from public.hotels h
on conflict on constraint hotel_module_entitlements_pkey do update set
  is_enabled=true,enabled_at=coalesce(public.hotel_module_entitlements.enabled_at,excluded.enabled_at),
  disabled_at=null,disabled_by=null,updated_at=excluded.updated_at;

create function public.initialize_hotel_experience_layout()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,enabled_by)
  values(new.id,'experience.navigation',true,now(),auth.uid())
  on conflict on constraint hotel_module_entitlements_pkey do nothing;
  insert into public.hotel_experience_layout(hotel_id,block_key,is_enabled,position)
  select new.id,b.block_key,true,
    (case when new.brand_code in('mercure','novotel','grand-mercure') then b.brand_position else b.default_position end)::smallint
  from (values
    ('hero',1,1),('banners',2,3),('announcements',3,4),('quick_info',4,2),
    ('services',5,5),('departments',6,6),('policies',7,7),('contact',8,8)
  ) b(block_key,default_position,brand_position)
  on conflict on constraint hotel_experience_layout_pkey do nothing;
  return new;
end;
$$;
revoke all on function public.initialize_hotel_experience_layout() from public,anon,authenticated,service_role;
create trigger "50_initialize_hotel_experience_layout"
after insert on public.hotels for each row execute function public.initialize_hotel_experience_layout();

create function public.get_current_hotel_experience_layout()
returns table(block_key text,is_enabled boolean,block_position smallint)
language plpgsql stable security definer set search_path=''
as $$
declare current_hotel_id uuid;
begin
  select p.hotel_id into current_hotel_id from public.profiles p
  join public.hotels h on h.id=p.hotel_id
  where p.id=auth.uid() and p.is_active and h.platform_status<>'archived';
  if current_hotel_id is null or not public.has_active_hotel_role(current_hotel_id,'visualizador') then
    raise exception using errcode='42501',message='active_hotel_profile_required';
  end if;
  if not public.is_hotel_module_enabled(current_hotel_id,'experience.navigation') then
    raise exception using errcode='42501',message='experience_navigation_required';
  end if;
  return query
  select defaults.block_key,case when defaults.block_key='hero' then true else coalesce(l.is_enabled,true) end,
    coalesce(l.position,defaults.position)::smallint
  from (values ('hero',1),('banners',2),('announcements',3),('quick_info',4),
    ('services',5),('departments',6),('policies',7),('contact',8)) defaults(block_key,position)
  left join public.hotel_experience_layout l on l.hotel_id=current_hotel_id and l.block_key=defaults.block_key
  order by coalesce(l.position,defaults.position);
end;
$$;

create function public.get_public_hotel_experience_layout(p_hotel_id uuid)
returns table(block_key text,is_enabled boolean,block_position smallint)
language plpgsql stable security definer set search_path=''
as $$
begin
  if p_hotel_id is null or not public.is_hotel_publicly_active(p_hotel_id)
    or not public.is_hotel_module_enabled(p_hotel_id,'core.directory') then
    return;
  end if;
  return query
  select defaults.block_key,
    (case when defaults.block_key='hero' then true
      when public.is_hotel_module_enabled(p_hotel_id,'experience.navigation') then coalesce(l.is_enabled,true)
      else true end)
    and case defaults.block_key
      when 'banners' then public.is_hotel_module_enabled(p_hotel_id,'content.banners')
      when 'announcements' then public.is_hotel_module_enabled(p_hotel_id,'content.announcements')
      when 'services' then public.is_hotel_module_enabled(p_hotel_id,'content.services')
      when 'departments' then public.is_hotel_module_enabled(p_hotel_id,'content.departments')
      when 'policies' then public.is_hotel_module_enabled(p_hotel_id,'content.policies')
      else true end,
    coalesce(l.position,defaults.position)::smallint
  from (values ('hero',1),('banners',2),('announcements',3),('quick_info',4),
    ('services',5),('departments',6),('policies',7),('contact',8)) defaults(block_key,position)
  left join public.hotel_experience_layout l on l.hotel_id=p_hotel_id and l.block_key=defaults.block_key
    and public.is_hotel_module_enabled(p_hotel_id,'experience.navigation')
  order by coalesce(l.position,defaults.position);
end;
$$;

create function public.update_current_hotel_experience_block(p_block_key text,p_enabled boolean)
returns table(block_key text,is_enabled boolean,block_position smallint)
language plpgsql security definer set search_path=''
as $$
declare current_hotel_id uuid; current_position smallint; actor_id uuid:=auth.uid(); required_module text;
begin
  if p_block_key not in('hero','banners','announcements','quick_info','services','departments','policies','contact')
    or p_enabled is null then raise exception using errcode='22023',message='experience_block_invalid'; end if;
  if p_block_key='hero' and not p_enabled then raise exception using errcode='22023',message='experience_hero_required'; end if;
  select p.hotel_id into current_hotel_id from public.profiles p join public.hotels h on h.id=p.hotel_id
    where p.id=actor_id and p.is_active and h.platform_status<>'archived';
  if current_hotel_id is null or not public.has_active_hotel_role(current_hotel_id,'editor') then
    raise exception using errcode='42501',message='experience_editor_required';
  end if;
  if not public.is_hotel_module_enabled(current_hotel_id,'experience.navigation') then
    raise exception using errcode='42501',message='experience_navigation_required';
  end if;
  required_module:=case p_block_key when 'banners' then 'content.banners'
    when 'announcements' then 'content.announcements' when 'services' then 'content.services'
    when 'departments' then 'content.departments' when 'policies' then 'content.policies'
    else 'core.directory' end;
  if p_enabled and not public.is_hotel_module_enabled(current_hotel_id,required_module) then
    raise exception using errcode='55000',message='experience_block_entitlement_required';
  end if;
  select l.position into current_position from public.hotel_experience_layout l
    where l.hotel_id=current_hotel_id and l.block_key=p_block_key for update;
  if current_position is null then raise exception using errcode='P0002',message='experience_layout_missing'; end if;
  update public.hotel_experience_layout l set is_enabled=p_enabled,updated_at=now(),updated_by=actor_id
    where l.hotel_id=current_hotel_id and l.block_key=p_block_key;
  perform public.record_admin_audit_event(actor_id,current_hotel_id,
    case when p_enabled then 'experience.block_enabled' else 'experience.block_disabled' end,
    'experience_layout',null,pg_catalog.jsonb_build_object('block_key',p_block_key),null);
  return query select l.block_key,l.is_enabled,l.position from public.hotel_experience_layout l
    where l.hotel_id=current_hotel_id and l.block_key=p_block_key;
end;
$$;

create function public.reorder_current_hotel_experience_blocks(p_block_keys text[])
returns table(block_key text,is_enabled boolean,block_position smallint)
language plpgsql security definer set search_path=''
as $$
declare current_hotel_id uuid; actor_id uuid:=auth.uid(); actual_keys text[];
begin
  select pg_catalog.array_agg(k order by k) into actual_keys from pg_catalog.unnest(p_block_keys) k;
  if coalesce(pg_catalog.array_length(p_block_keys,1),0)<>8
    or (select count(distinct k) from pg_catalog.unnest(p_block_keys) k)<>8
    or actual_keys is distinct from array['announcements','banners','contact','departments','hero','policies','quick_info','services']::text[] then
    raise exception using errcode='22023',message='experience_layout_order_invalid';
  end if;
  select p.hotel_id into current_hotel_id from public.profiles p join public.hotels h on h.id=p.hotel_id
    where p.id=actor_id and p.is_active and h.platform_status<>'archived';
  if current_hotel_id is null or not public.has_active_hotel_role(current_hotel_id,'editor') then
    raise exception using errcode='42501',message='experience_editor_required';
  end if;
  if not public.is_hotel_module_enabled(current_hotel_id,'experience.navigation') then
    raise exception using errcode='42501',message='experience_navigation_required';
  end if;
  perform 1 from public.hotel_experience_layout l where l.hotel_id=current_hotel_id for update;
  set constraints public.hotel_experience_layout_position_key deferred;
  update public.hotel_experience_layout l set position=ordered.position,updated_at=now(),updated_by=actor_id
    from (select k.block_key,ordinality::smallint as position
      from pg_catalog.unnest(p_block_keys) with ordinality k(block_key,ordinality)) ordered
    where l.hotel_id=current_hotel_id and l.block_key=ordered.block_key;
  perform public.record_admin_audit_event(actor_id,current_hotel_id,'experience.layout_updated',
    'experience_layout',null,pg_catalog.jsonb_build_object('block_order',pg_catalog.array_to_string(p_block_keys,',')),null);
  return query select l.block_key,l.is_enabled,l.position from public.hotel_experience_layout l
    where l.hotel_id=current_hotel_id order by l.position;
end;
$$;

revoke all on function public.get_current_hotel_experience_layout() from public,anon,authenticated,service_role;
revoke all on function public.get_public_hotel_experience_layout(uuid) from public,anon,authenticated,service_role;
revoke all on function public.update_current_hotel_experience_block(text,boolean) from public,anon,authenticated,service_role;
revoke all on function public.reorder_current_hotel_experience_blocks(text[]) from public,anon,authenticated,service_role;
grant execute on function public.get_current_hotel_experience_layout() to authenticated;
grant execute on function public.get_public_hotel_experience_layout(uuid) to anon,authenticated;
grant execute on function public.update_current_hotel_experience_block(text,boolean) to authenticated;
grant execute on function public.reorder_current_hotel_experience_blocks(text[]) to authenticated;

-- experience.navigation is now operational; preserve every other availability rule.
create or replace function public.update_platform_hotel_module(p_hotel_id uuid,p_module_key text,p_enabled boolean)
returns table(module_key text,is_enabled boolean,enabled_at timestamptz,disabled_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); current_enabled boolean; changed_at timestamptz:=now();
begin
  if actor_id is null or not exists(select 1 from public.platform_users pu where pu.user_id=actor_id and pu.role='platform_admin' and pu.is_active) then raise exception using errcode='42501',message='active_platform_admin_required'; end if;
  if p_module_key not in('core.directory','content.services','content.departments','content.policies','content.announcements','content.banners','rooms.qr','content.languages','experience.appearance','experience.navigation','experience.preview','experience.seo','fb.menu','content.tourism','analytics.basic','analytics.advanced','integrations.thex','integrations.opera','audit.access_logs') then raise exception using errcode='22023',message='platform_module_invalid'; end if;
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

revoke all on function public.update_platform_hotel_module(uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.update_platform_hotel_module(uuid,text,boolean) to authenticated;

-- Evolve the reviewed Sprint 47 onboarding contract explicitly from eleven to twelve
-- baseline modules. The initializer remains only an idempotent structural safety net.
create or replace function public.create_platform_hotel_onboarding(
  p_name text,p_city text,p_slug text,p_subdomain text,p_brand_code text,p_theme_preset text,
  p_admin_user_id uuid,p_admin_email text,p_admin_full_name text
)
returns table(hotel_id uuid,platform_status text,admin_user_id uuid)
language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid();
  new_hotel_id uuid:=gen_random_uuid();
  normalized_name text:=pg_catalog.btrim(p_name);
  normalized_city text:=pg_catalog.btrim(p_city);
  normalized_slug text:=pg_catalog.lower(pg_catalog.btrim(p_slug));
  normalized_subdomain text:=pg_catalog.lower(pg_catalog.btrim(p_subdomain));
  normalized_email text:=pg_catalog.lower(pg_catalog.btrim(p_admin_email));
  normalized_full_name text:=pg_catalog.btrim(p_admin_full_name);
  existing_profile_hotel_id uuid;
  profile_exists boolean:=false;
begin
  if actor_id is null or not exists(select 1 from public.platform_users pu
      where pu.user_id=actor_id and pu.role='platform_admin' and pu.is_active) then
    raise exception using errcode='42501',message='active_platform_admin_required';
  end if;
  if normalized_name is null or length(normalized_name) not between 1 and 120
    or normalized_city is null or length(normalized_city) not between 1 and 100 then
    raise exception using errcode='22023',message='platform_hotel_identity_invalid';
  end if;
  if normalized_slug is null or length(normalized_slug) not between 3 and 64
    or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode='22023',message='platform_hotel_slug_invalid';
  end if;
  if normalized_subdomain is null or length(normalized_subdomain) not between 3 and 32
    or normalized_subdomain !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$'
    or normalized_subdomain ~ '--' or normalized_subdomain in('www','app','admin','api','guestdesk') then
    raise exception using errcode='22023',message='platform_hotel_subdomain_invalid';
  end if;
  if p_brand_code is not null and p_brand_code not in('mercure','novotel','grand-mercure') then
    raise exception using errcode='22023',message='platform_hotel_brand_invalid';
  end if;
  if p_theme_preset is not null and p_theme_preset not in('midnight-slate','ivory-noir','deep-ocean','graphite-gold','forest-ember') then
    raise exception using errcode='22023',message='platform_hotel_theme_invalid';
  end if;
  if p_admin_user_id is null or normalized_full_name is null or length(normalized_full_name) not between 1 and 120
    or normalized_email is null or length(normalized_email)>254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode='22023',message='platform_initial_admin_invalid';
  end if;
  if not exists(select 1 from auth.users u where u.id=p_admin_user_id and pg_catalog.lower(u.email)=normalized_email) then
    raise exception using errcode='P0002',message='platform_initial_admin_auth_missing';
  end if;
  if exists(select 1 from public.platform_users pu where pu.user_id=p_admin_user_id) then
    raise exception using errcode='55000',message='platform_initial_admin_incompatible';
  end if;
  select p.hotel_id into existing_profile_hotel_id from public.profiles p
    where p.id=p_admin_user_id for update;
  profile_exists:=found;
  if profile_exists and existing_profile_hotel_id is not null then
    raise exception using errcode='55000',message='platform_initial_admin_incompatible';
  end if;
  if exists(select 1 from public.hotels h where h.slug=normalized_slug) then
    raise exception using errcode='23505',message='platform_hotel_slug_conflict';
  end if;
  if exists(select 1 from public.hotels h where h.subdomain=normalized_subdomain) then
    raise exception using errcode='23505',message='platform_hotel_subdomain_conflict';
  end if;
  begin
    insert into public.hotels(id,name,city,slug,subdomain,brand_code,theme_preset,platform_status)
    values(new_hotel_id,normalized_name,normalized_city,normalized_slug,normalized_subdomain,p_brand_code,p_theme_preset,'draft');
  exception when unique_violation then
    if exists(select 1 from public.hotels h where h.slug=normalized_slug) then
      raise exception using errcode='23505',message='platform_hotel_slug_conflict';
    elsif exists(select 1 from public.hotels h where h.subdomain=normalized_subdomain) then
      raise exception using errcode='23505',message='platform_hotel_subdomain_conflict';
    else raise;
    end if;
  end;
  insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,enabled_by)
  select new_hotel_id,module_key,true,now(),actor_id from (values
    ('core.directory'),('content.services'),('content.departments'),('content.policies'),
    ('content.announcements'),('content.banners'),('rooms.qr'),('content.languages'),
    ('experience.appearance'),('experience.navigation'),('experience.preview'),('analytics.basic')
  ) baseline(module_key)
  on conflict on constraint hotel_module_entitlements_pkey do update set
    is_enabled=true,enabled_at=coalesce(public.hotel_module_entitlements.enabled_at,excluded.enabled_at),
    enabled_by=coalesce(public.hotel_module_entitlements.enabled_by,excluded.enabled_by),
    disabled_at=null,disabled_by=null,updated_at=now();
  if profile_exists then
    update public.profiles set email=normalized_email,full_name=normalized_full_name,
      role='administrador',hotel_id=new_hotel_id,is_active=true,updated_at=now()
    where id=p_admin_user_id;
  else
    insert into public.profiles(id,email,full_name,role,hotel_id,is_active)
    values(p_admin_user_id,normalized_email,normalized_full_name,'administrador',new_hotel_id,true);
  end if;
  perform public.record_platform_audit_event(actor_id,'hotel.created','hotel',new_hotel_id,
    pg_catalog.jsonb_build_object('brand_code',p_brand_code,'baseline_modules',12),null);
  return query select new_hotel_id,'draft'::text,p_admin_user_id;
end;
$$;

revoke all on function public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)
  to authenticated;
comment on function public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text) is
  'Creates one draft hotel, the canonical twelve-module baseline, initial active administrator profile and one platform audit event atomically.';

comment on table public.hotel_experience_layout is 'Closed per-block composition. Content, theme, lifecycle and entitlements remain independent contracts.';
