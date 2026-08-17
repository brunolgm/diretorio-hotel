-- Sprint 46.8: canonical hotel module entitlements.
-- Entitlement is independent from hotel lifecycle and never deletes operational data.

do $$
declare
  expected_policies constant text[] := array[
    'hotel_sections:45b_public_read_enabled_sections',
    'hotel_departments:45b_public_read_enabled_departments',
    'hotel_policies:45b_public_read_enabled_policies',
    'hotel_section_translations:45b_public_read_section_translations',
    'hotel_department_translations:45b_public_read_department_translations',
    'hotel_policy_translations:45b_public_read_policy_translations',
    'hotel_announcements:45b_public_read_active_announcements',
    'hotel_announcement_translations:45b_public_read_announcement_translations',
    'hotel_promotional_banners:45b_public_read_active_banners',
    'hotel_promotional_banner_translations:45b_public_read_banner_translations'
  ];
begin
  if to_regclass('public.hotel_module_entitlements') is not null then
    raise exception '46.8 preflight failed: hotel_module_entitlements already exists';
  end if;
  if to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is not null
    or to_regprocedure('public.get_platform_hotel_modules(uuid)') is not null
    or to_regprocedure('public.update_platform_hotel_module(uuid,text,boolean)') is not null
    or to_regprocedure('public.get_current_hotel_modules()') is not null then
    raise exception '46.8 preflight failed: a module RPC already exists';
  end if;
  if to_regclass('public.hotels') is null or to_regclass('public.profiles') is null
    or to_regclass('public.platform_users') is null or to_regclass('public.platform_audit_log') is null then
    raise exception '46.8 preflight failed: required 46A/46C objects are missing';
  end if;
  if to_regprocedure('public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)') is null
    or to_regprocedure('public.is_hotel_publicly_active(uuid)') is null then
    raise exception '46.8 preflight failed: known 46C contracts are missing';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.is_hotel_publicly_active(uuid)'::regprocedure
      and p.prosecdef and p.provolatile='s'
      and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'platform_status[[:space:]]*=[[:space:]]*''active'''
  ) or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)'::regprocedure
      and p.prosecdef and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'platform_audit_log'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'auth\.uid\(\)'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'from public\.platform_users'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'pu\.is_active[[:space:]]*=[[:space:]]*true'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'pu\.role[[:space:]]*=[[:space:]]*''platform_admin'''
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'platform_audit_metadata_invalid'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'hotel\.brand_updated'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'hotel\.status_updated'
      and pg_catalog.pg_get_functiondef(p.oid) !~* 'hotel\.module_enabled'
      and pg_catalog.pg_get_functiondef(p.oid) !~* 'hotel\.module_disabled'
  ) then
    raise exception '46.8 preflight failed: known 46C function definitions drifted';
  end if;
  if (select count(*) from pg_catalog.pg_policies p
      where p.schemaname = 'public' and p.cmd = 'SELECT'
        and (p.tablename || ':' || p.policyname) = any(expected_policies)) <> 10 then
    raise exception '46.8 preflight failed: known public content policies drifted';
  end if;
  if (select count(*) from pg_catalog.pg_policies p where p.schemaname='public' and
      (p.tablename || ':' || p.policyname) = any(array[
        'hotel_sections:45b_hotel_read_sections','hotel_sections:45b_operator_manage_sections',
        'hotel_departments:45b_hotel_read_departments','hotel_departments:45b_operator_manage_departments',
        'hotel_policies:45b_hotel_read_policies','hotel_policies:45b_operator_manage_policies',
        'hotel_announcements:45b_hotel_read_announcements','hotel_announcements:45b_operator_manage_announcements',
        'hotel_promotional_banners:45b_hotel_read_banners','hotel_promotional_banners:45b_operator_manage_banners',
        'hotel_room_links:45b_editor_read_room_links','hotel_room_links:45b_editor_insert_room_links',
        'hotel_room_links:45b_editor_update_room_links'
      ])) <> 13 then
    raise exception '46.8 preflight failed: known hotel operation policies drifted';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class c
    where c.oid = 'public.public_hotels'::regclass and c.relkind = 'v'
      and pg_catalog.pg_get_viewdef(c.oid, true) ~* 'platform_status[[:space:]]*=[[:space:]]*''active'''
      and pg_catalog.pg_get_viewdef(c.oid, true) ~* 'from (public\.)?hotels'
      and pg_catalog.pg_get_viewdef(c.oid, true) !~* 'module|entitlement'
  ) then
    raise exception '46.8 preflight failed: 46C public_hotels lifecycle contract drifted';
  end if;
  if (
    select array_agg(c.column_name::text order by c.ordinal_position)
    from information_schema.columns c
    where c.table_schema='public' and c.table_name='public_hotels'
  ) is distinct from array[
    'id','name','slug','subdomain','city','booking_url','website_url','instagram_url',
    'whatsapp_number','wifi_name','wifi_password','breakfast_hours','checkin_time',
    'checkout_time','logo_url','hero_image_url','brand_code','theme_preset','theme_primary_color'
  ]::text[] then
    raise exception '46.8 preflight failed: known 46C public_hotels projection drifted';
  end if;
end;
$$;

-- Validate each 45B/46C policy contract before replacing it. Presence/name alone is insufficient.
do $$
declare drifted_policy text;
begin
  with expected(tablename,policyname,cmd,roles,qual_pattern,check_pattern) as (values
    ('hotel_sections','45b_public_read_enabled_sections','SELECT','{anon,authenticated}','enabled.*is_hotel_publicly_active.*hotel_id',null),
    ('hotel_departments','45b_public_read_enabled_departments','SELECT','{anon,authenticated}','enabled.*is_hotel_publicly_active.*hotel_id',null),
    ('hotel_policies','45b_public_read_enabled_policies','SELECT','{anon,authenticated}','enabled.*is_hotel_publicly_active.*hotel_id',null),
    ('hotel_section_translations','45b_public_read_section_translations','SELECT','{anon,authenticated}','hotel_sections.*enabled.*is_hotel_publicly_active',null),
    ('hotel_department_translations','45b_public_read_department_translations','SELECT','{anon,authenticated}','hotel_departments.*enabled.*is_hotel_publicly_active',null),
    ('hotel_policy_translations','45b_public_read_policy_translations','SELECT','{anon,authenticated}','hotel_policies.*enabled.*is_hotel_publicly_active',null),
    ('hotel_announcements','45b_public_read_active_announcements','SELECT','{anon,authenticated}','is_active.*is_hotel_publicly_active.*starts_at.*ends_at',null),
    ('hotel_announcement_translations','45b_public_read_announcement_translations','SELECT','{anon,authenticated}','hotel_announcements.*is_active.*is_hotel_publicly_active.*starts_at.*ends_at',null),
    ('hotel_promotional_banners','45b_public_read_active_banners','SELECT','{anon,authenticated}','is_active.*is_hotel_publicly_active.*starts_at.*ends_at',null),
    ('hotel_promotional_banner_translations','45b_public_read_banner_translations','SELECT','{anon,authenticated}','hotel_promotional_banners.*is_active.*is_hotel_publicly_active.*starts_at.*ends_at',null),
    ('hotel_sections','45b_hotel_read_sections','SELECT','{authenticated}','has_active_hotel_role.*hotel_id.*visualizador',null),
    ('hotel_sections','45b_operator_manage_sections','ALL','{authenticated}','has_active_hotel_role.*hotel_id.*operador','has_active_hotel_role.*hotel_id.*operador'),
    ('hotel_departments','45b_hotel_read_departments','SELECT','{authenticated}','has_active_hotel_role.*hotel_id.*visualizador',null),
    ('hotel_departments','45b_operator_manage_departments','ALL','{authenticated}','has_active_hotel_role.*hotel_id.*operador','has_active_hotel_role.*hotel_id.*operador'),
    ('hotel_policies','45b_hotel_read_policies','SELECT','{authenticated}','has_active_hotel_role.*hotel_id.*visualizador',null),
    ('hotel_policies','45b_operator_manage_policies','ALL','{authenticated}','has_active_hotel_role.*hotel_id.*operador','has_active_hotel_role.*hotel_id.*operador'),
    ('hotel_announcements','45b_hotel_read_announcements','SELECT','{authenticated}','has_active_hotel_role.*hotel_id.*visualizador',null),
    ('hotel_announcements','45b_operator_manage_announcements','ALL','{authenticated}','has_active_hotel_role.*hotel_id.*operador','has_active_hotel_role.*hotel_id.*operador'),
    ('hotel_promotional_banners','45b_hotel_read_banners','SELECT','{authenticated}','has_active_hotel_role.*hotel_id.*visualizador',null),
    ('hotel_promotional_banners','45b_operator_manage_banners','ALL','{authenticated}','has_active_hotel_role.*hotel_id.*operador','has_active_hotel_role.*hotel_id.*operador'),
    ('hotel_room_links','45b_editor_read_room_links','SELECT','{authenticated}','has_active_hotel_role.*hotel_id.*editor',null),
    ('hotel_room_links','45b_editor_insert_room_links','INSERT','{authenticated}','^$','has_active_hotel_role.*hotel_id.*editor'),
    ('hotel_room_links','45b_editor_update_room_links','UPDATE','{authenticated}','has_active_hotel_role.*hotel_id.*editor','has_active_hotel_role.*hotel_id.*editor')
  )
  select e.tablename || '.' || e.policyname into drifted_policy
  from expected e
  left join pg_catalog.pg_policies p
    on p.schemaname='public' and p.tablename=e.tablename and p.policyname=e.policyname
  where p.policyname is null
    or p.cmd <> e.cmd
    or p.roles::text <> e.roles
    or coalesce(p.qual,'') !~* e.qual_pattern
    or (e.check_pattern is null and p.with_check is not null)
    or (e.check_pattern is not null and coalesce(p.with_check,'') !~* e.check_pattern)
    or coalesce(p.qual,'') ~* 'is_hotel_module_enabled'
    or coalesce(p.with_check,'') ~* 'is_hotel_module_enabled'
  limit 1;

  if drifted_policy is not null then
    raise exception '46.8 preflight failed: known policy definition drifted: %', drifted_policy;
  end if;
end;
$$;

create table public.hotel_module_entitlements (
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  module_key text not null,
  is_enabled boolean not null default false,
  enabled_at timestamptz null,
  enabled_by uuid null,
  disabled_at timestamptz null,
  disabled_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (hotel_id, module_key),
  constraint hotel_module_entitlements_module_key_check check (module_key in (
    'core.directory', 'content.services', 'content.departments', 'content.policies',
    'content.announcements', 'content.banners', 'rooms.qr', 'content.languages',
    'experience.appearance', 'experience.navigation', 'experience.preview', 'experience.seo',
    'fb.menu', 'content.tourism', 'analytics.basic', 'analytics.advanced',
    'integrations.thex', 'integrations.opera', 'audit.access_logs'
  )),
  constraint hotel_module_entitlements_state_check check (
    (is_enabled and enabled_at is not null and disabled_at is null and disabled_by is null)
    or (not is_enabled and enabled_at is null and enabled_by is null
      and ((disabled_at is null and disabled_by is null) or disabled_at is not null))
  )
);

alter table public.hotel_module_entitlements enable row level security;
revoke all on table public.hotel_module_entitlements from public, anon, authenticated, service_role;

-- Existing hotels keep every capability already operational, including appearance and sandboxed preview.
insert into public.hotel_module_entitlements (hotel_id, module_key, is_enabled, enabled_at)
select h.id, baseline.module_key, true, now()
from public.hotels h
cross join (values
  ('core.directory'), ('content.services'), ('content.departments'), ('content.policies'),
  ('content.announcements'), ('content.banners'), ('rooms.qr'), ('content.languages'),
  ('experience.appearance'), ('experience.preview'), ('analytics.basic')
) as baseline(module_key);

do $$
begin
  if exists (select 1 from public.hotel_module_entitlements e where not e.is_enabled)
    or (select count(*) from public.hotel_module_entitlements) <> (select count(*) * 11 from public.hotels)
    or exists (select 1 from public.hotels h where (select count(*) from public.hotel_module_entitlements e where e.hotel_id = h.id) <> 11) then
    raise exception '46.8 backfill failed: deterministic eleven-module baseline was not preserved';
  end if;
end;
$$;

create function public.is_hotel_module_enabled(p_hotel_id uuid, p_module_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when p_module_key in (
    'core.directory','content.services','content.departments','content.policies','content.announcements',
    'content.banners','rooms.qr','content.languages','experience.appearance','experience.navigation',
    'experience.preview','experience.seo','fb.menu','content.tourism','analytics.basic',
    'analytics.advanced','integrations.thex','integrations.opera','audit.access_logs'
  ) then exists (
    select 1 from public.hotel_module_entitlements e
    where e.hotel_id = p_hotel_id and e.module_key = p_module_key and e.is_enabled
  ) else false end;
$$;
revoke all on function public.is_hotel_module_enabled(uuid,text) from public;
grant execute on function public.is_hotel_module_enabled(uuid,text) to anon, authenticated, service_role;

create function public.get_platform_hotel_modules(p_hotel_id uuid)
returns table(module_key text, is_enabled boolean, enabled_at timestamptz, disabled_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.platform_users pu where pu.user_id = auth.uid() and pu.role = 'platform_admin' and pu.is_active) then
    raise exception using errcode = '42501', message = 'active_platform_admin_required';
  end if;
  if not exists (select 1 from public.hotels h where h.id = p_hotel_id) then
    raise exception using errcode = 'P0002', message = 'platform_hotel_not_found';
  end if;
  return query
  select catalog.module_key, coalesce(e.is_enabled, false), e.enabled_at, e.disabled_at
  from (values
    ('core.directory'),('content.services'),('content.departments'),('content.policies'),
    ('content.announcements'),('content.banners'),('rooms.qr'),('content.languages'),
    ('experience.appearance'),('experience.navigation'),('experience.preview'),('experience.seo'),
    ('fb.menu'),('content.tourism'),('analytics.basic'),('analytics.advanced'),
    ('integrations.thex'),('integrations.opera'),('audit.access_logs')
  ) catalog(module_key)
  left join public.hotel_module_entitlements e on e.hotel_id = p_hotel_id and e.module_key = catalog.module_key;
end;
$$;

create function public.get_current_hotel_modules()
returns table(module_key text, is_enabled boolean)
language plpgsql stable security definer set search_path = '' as $$
declare current_hotel_id uuid;
begin
  select p.hotel_id into current_hotel_id
  from public.profiles p join public.hotels h on h.id = p.hotel_id
  where p.id = auth.uid() and p.is_active and h.platform_status <> 'archived';
  if current_hotel_id is null then
    raise exception using errcode = '42501', message = 'active_hotel_profile_required';
  end if;
  return query select e.module_key, e.is_enabled from public.hotel_module_entitlements e where e.hotel_id = current_hotel_id;
end;
$$;

-- Evolve the reviewed 46C writer so all platform audit validation stays centralized.
create or replace function public.record_platform_audit_event(
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_request_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id uuid;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'platform_audit_actor_invalid';
  end if;

  if not exists (
    select 1 from public.platform_users pu
    where pu.user_id = auth.uid()
      and pu.is_active = true
      and pu.role = 'platform_admin'
  ) then
    raise exception using errcode = '42501', message = 'active_platform_admin_required';
  end if;

  if p_action not in (
    'hotel.brand_updated', 'hotel.status_updated',
    'hotel.module_enabled', 'hotel.module_disabled'
  ) or p_entity_type <> 'hotel' or p_entity_id is null then
    raise exception using errcode = '22023', message = 'platform_audit_event_invalid';
  end if;

  if p_metadata is null
    or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
    or pg_catalog.octet_length(p_metadata::text) > 2048
    or pg_catalog.jsonb_path_exists(
      p_metadata,
      '$.* ? (@.type() == "object" || @.type() == "array")'::jsonpath
    )
    or pg_catalog.jsonb_path_exists(
      p_metadata,
      '$.keyvalue() ? (@.key like_regex "^(password|senha|roomtoken|room_token|token|jwt|service_role|payload|cookie|authorization)$" flag "i")'::jsonpath
    )
  then
    raise exception using errcode = '22023', message = 'platform_audit_metadata_invalid';
  end if;

  insert into public.platform_audit_log (
    actor_user_id, action, entity_type, entity_id, metadata, request_id
  ) values (
    p_actor_user_id, p_action, p_entity_type, p_entity_id,
    p_metadata, nullif(pg_catalog.btrim(p_request_id), '')
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke all on function public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)
  from public,anon,authenticated,service_role;

create function public.update_platform_hotel_module(p_hotel_id uuid, p_module_key text, p_enabled boolean)
returns table(module_key text, is_enabled boolean, enabled_at timestamptz, disabled_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); current_enabled boolean; changed_at timestamptz := now();
begin
  if actor_id is null or not exists (select 1 from public.platform_users pu where pu.user_id = actor_id and pu.role = 'platform_admin' and pu.is_active) then
    raise exception using errcode = '42501', message = 'active_platform_admin_required';
  end if;
  if p_module_key not in (
    'core.directory','content.services','content.departments','content.policies','content.announcements',
    'content.banners','rooms.qr','content.languages','experience.appearance','experience.navigation',
    'experience.preview','experience.seo','fb.menu','content.tourism','analytics.basic',
    'analytics.advanced','integrations.thex','integrations.opera','audit.access_logs') then
    raise exception using errcode = '22023', message = 'platform_module_invalid';
  end if;
  if p_enabled is null then
    raise exception using errcode = '22023', message = 'platform_module_state_invalid';
  end if;
  if p_enabled and p_module_key in (
    'experience.navigation', 'experience.seo', 'fb.menu', 'content.tourism',
    'analytics.advanced', 'integrations.thex', 'integrations.opera', 'audit.access_logs'
  ) then
    raise exception using errcode = '55000', message = 'platform_module_not_available';
  end if;
  if p_module_key = 'core.directory' and not p_enabled then
    raise exception using errcode = '22023', message = 'platform_module_dependency_required';
  end if;
  perform 1 from public.hotels h where h.id = p_hotel_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'platform_hotel_not_found'; end if;
  if p_enabled and p_module_key <> 'core.directory'
    and not public.is_hotel_module_enabled(p_hotel_id, 'core.directory') then
    raise exception using errcode = '55000', message = 'platform_module_dependency_required';
  end if;
  select e.is_enabled into current_enabled from public.hotel_module_entitlements e
    where e.hotel_id = p_hotel_id and e.module_key = p_module_key for update;
  if found and current_enabled = p_enabled then
    return query select e.module_key,e.is_enabled,e.enabled_at,e.disabled_at from public.hotel_module_entitlements e where e.hotel_id=p_hotel_id and e.module_key=p_module_key;
    return;
  end if;
  insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,enabled_by,disabled_at,disabled_by,updated_at)
  values(p_hotel_id,p_module_key,p_enabled,case when p_enabled then changed_at end,case when p_enabled then actor_id end,case when not p_enabled then changed_at end,case when not p_enabled then actor_id end,changed_at)
  on conflict on constraint hotel_module_entitlements_pkey do update set
    is_enabled=excluded.is_enabled, enabled_at=excluded.enabled_at, enabled_by=excluded.enabled_by,
    disabled_at=excluded.disabled_at, disabled_by=excluded.disabled_by, updated_at=excluded.updated_at;
  perform public.record_platform_audit_event(
    actor_id,
    case when p_enabled then 'hotel.module_enabled' else 'hotel.module_disabled' end,
    'hotel',
    p_hotel_id,
    pg_catalog.jsonb_build_object('module_key', p_module_key),
    null
  );
  return query select e.module_key,e.is_enabled,e.enabled_at,e.disabled_at from public.hotel_module_entitlements e where e.hotel_id=p_hotel_id and e.module_key=p_module_key;
end;
$$;

revoke all on function public.get_platform_hotel_modules(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_current_hotel_modules() from public,anon,authenticated,service_role;
revoke all on function public.update_platform_hotel_module(uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.get_platform_hotel_modules(uuid) to authenticated;
grant execute on function public.get_current_hotel_modules() to authenticated;
grant execute on function public.update_platform_hotel_module(uuid,text,boolean) to authenticated;

-- Guest hotel resolution also requires the fundamental directory entitlement.
drop view public.public_hotels;
create view public.public_hotels with (security_barrier=true, security_invoker=false) as
select id,name,slug,subdomain,city,booking_url,website_url,instagram_url,whatsapp_number,
  wifi_name,wifi_password,breakfast_hours,checkin_time,checkout_time,logo_url,hero_image_url,
  brand_code,theme_preset,theme_primary_color
from public.hotels
where platform_status='active' and public.is_hotel_module_enabled(id,'core.directory');
revoke all on table public.public_hotels from public,anon,authenticated;
grant select on table public.public_hotels to anon,authenticated;

-- Replace only the ten reviewed public 45B/46C policies. Lifecycle and entitlement are cumulative.
drop policy "45b_public_read_enabled_sections" on public.hotel_sections;
create policy "45b_public_read_enabled_sections" on public.hotel_sections for select to anon,authenticated using(enabled and public.is_hotel_publicly_active(hotel_id) and public.is_hotel_module_enabled(hotel_id,'core.directory') and public.is_hotel_module_enabled(hotel_id,'content.services'));
drop policy "45b_public_read_enabled_departments" on public.hotel_departments;
create policy "45b_public_read_enabled_departments" on public.hotel_departments for select to anon,authenticated using(enabled and public.is_hotel_publicly_active(hotel_id) and public.is_hotel_module_enabled(hotel_id,'core.directory') and public.is_hotel_module_enabled(hotel_id,'content.departments'));
drop policy "45b_public_read_enabled_policies" on public.hotel_policies;
create policy "45b_public_read_enabled_policies" on public.hotel_policies for select to anon,authenticated using(enabled and public.is_hotel_publicly_active(hotel_id) and public.is_hotel_module_enabled(hotel_id,'core.directory') and public.is_hotel_module_enabled(hotel_id,'content.policies'));
drop policy "45b_public_read_section_translations" on public.hotel_section_translations;
create policy "45b_public_read_section_translations" on public.hotel_section_translations for select to anon,authenticated using(exists(select 1 from public.hotel_sections s where s.id=section_id and s.enabled and public.is_hotel_publicly_active(s.hotel_id) and public.is_hotel_module_enabled(s.hotel_id,'core.directory') and public.is_hotel_module_enabled(s.hotel_id,'content.services') and public.is_hotel_module_enabled(s.hotel_id,'content.languages')));
drop policy "45b_public_read_department_translations" on public.hotel_department_translations;
create policy "45b_public_read_department_translations" on public.hotel_department_translations for select to anon,authenticated using(exists(select 1 from public.hotel_departments d where d.id=department_id and d.enabled and public.is_hotel_publicly_active(d.hotel_id) and public.is_hotel_module_enabled(d.hotel_id,'core.directory') and public.is_hotel_module_enabled(d.hotel_id,'content.departments') and public.is_hotel_module_enabled(d.hotel_id,'content.languages')));
drop policy "45b_public_read_policy_translations" on public.hotel_policy_translations;
create policy "45b_public_read_policy_translations" on public.hotel_policy_translations for select to anon,authenticated using(exists(select 1 from public.hotel_policies p where p.id=policy_id and p.enabled and public.is_hotel_publicly_active(p.hotel_id) and public.is_hotel_module_enabled(p.hotel_id,'core.directory') and public.is_hotel_module_enabled(p.hotel_id,'content.policies') and public.is_hotel_module_enabled(p.hotel_id,'content.languages')));
drop policy "45b_public_read_active_announcements" on public.hotel_announcements;
create policy "45b_public_read_active_announcements" on public.hotel_announcements for select to anon,authenticated using(is_active and public.is_hotel_publicly_active(hotel_id) and public.is_hotel_module_enabled(hotel_id,'core.directory') and public.is_hotel_module_enabled(hotel_id,'content.announcements') and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()));
drop policy "45b_public_read_announcement_translations" on public.hotel_announcement_translations;
create policy "45b_public_read_announcement_translations" on public.hotel_announcement_translations for select to anon,authenticated using(exists(select 1 from public.hotel_announcements a where a.id=announcement_id and a.is_active and public.is_hotel_publicly_active(a.hotel_id) and public.is_hotel_module_enabled(a.hotel_id,'core.directory') and public.is_hotel_module_enabled(a.hotel_id,'content.announcements') and public.is_hotel_module_enabled(a.hotel_id,'content.languages') and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>=now())));
drop policy "45b_public_read_active_banners" on public.hotel_promotional_banners;
create policy "45b_public_read_active_banners" on public.hotel_promotional_banners for select to anon,authenticated using(is_active and public.is_hotel_publicly_active(hotel_id) and public.is_hotel_module_enabled(hotel_id,'core.directory') and public.is_hotel_module_enabled(hotel_id,'content.banners') and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()));
drop policy "45b_public_read_banner_translations" on public.hotel_promotional_banner_translations;
create policy "45b_public_read_banner_translations" on public.hotel_promotional_banner_translations for select to anon,authenticated using(exists(select 1 from public.hotel_promotional_banners b where b.id=banner_id and b.is_active and public.is_hotel_publicly_active(b.hotel_id) and public.is_hotel_module_enabled(b.hotel_id,'core.directory') and public.is_hotel_module_enabled(b.hotel_id,'content.banners') and public.is_hotel_module_enabled(b.hotel_id,'content.languages') and (b.starts_at is null or b.starts_at<=now()) and (b.ends_at is null or b.ends_at>=now())));

-- Browser RLS remains hotel-scoped and now also enforces the matching entitlement.
drop policy "45b_hotel_read_sections" on public.hotel_sections;
drop policy "45b_operator_manage_sections" on public.hotel_sections;
create policy "45b_hotel_read_sections" on public.hotel_sections for select to authenticated using(public.has_active_hotel_role(hotel_id,'visualizador') and public.is_hotel_module_enabled(hotel_id,'content.services'));
create policy "45b_operator_manage_sections" on public.hotel_sections for all to authenticated using(public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.services')) with check(public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.services'));
drop policy "45b_hotel_read_departments" on public.hotel_departments;
drop policy "45b_operator_manage_departments" on public.hotel_departments;
create policy "45b_hotel_read_departments" on public.hotel_departments for select to authenticated using(public.has_active_hotel_role(hotel_id,'visualizador') and public.is_hotel_module_enabled(hotel_id,'content.departments'));
create policy "45b_operator_manage_departments" on public.hotel_departments for all to authenticated using(public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.departments')) with check(public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.departments'));
drop policy "45b_hotel_read_policies" on public.hotel_policies;
drop policy "45b_operator_manage_policies" on public.hotel_policies;
create policy "45b_hotel_read_policies" on public.hotel_policies for select to authenticated using(public.has_active_hotel_role(hotel_id,'visualizador') and public.is_hotel_module_enabled(hotel_id,'content.policies'));
create policy "45b_operator_manage_policies" on public.hotel_policies for all to authenticated using(public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.policies')) with check(public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.policies'));
drop policy "45b_hotel_read_announcements" on public.hotel_announcements;
drop policy "45b_operator_manage_announcements" on public.hotel_announcements;
create policy "45b_hotel_read_announcements" on public.hotel_announcements for select to authenticated using(public.has_active_hotel_role(hotel_id,'visualizador') and public.is_hotel_module_enabled(hotel_id,'content.announcements'));
create policy "45b_operator_manage_announcements" on public.hotel_announcements for all to authenticated using(public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.announcements')) with check(public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.announcements'));
drop policy "45b_hotel_read_banners" on public.hotel_promotional_banners;
drop policy "45b_operator_manage_banners" on public.hotel_promotional_banners;
create policy "45b_hotel_read_banners" on public.hotel_promotional_banners for select to authenticated using(public.has_active_hotel_role(hotel_id,'visualizador') and public.is_hotel_module_enabled(hotel_id,'content.banners'));
create policy "45b_operator_manage_banners" on public.hotel_promotional_banners for all to authenticated using(public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.banners')) with check(public.has_active_hotel_role(hotel_id,'operador') and public.is_hotel_module_enabled(hotel_id,'content.banners'));

drop policy "45b_editor_read_room_links" on public.hotel_room_links;
drop policy "45b_editor_insert_room_links" on public.hotel_room_links;
drop policy "45b_editor_update_room_links" on public.hotel_room_links;
create policy "45b_editor_read_room_links" on public.hotel_room_links for select to authenticated using(public.has_active_hotel_role(hotel_id,'editor') and public.is_hotel_module_enabled(hotel_id,'rooms.qr'));
create policy "45b_editor_insert_room_links" on public.hotel_room_links for insert to authenticated with check(public.has_active_hotel_role(hotel_id,'editor') and public.is_hotel_module_enabled(hotel_id,'rooms.qr'));
create policy "45b_editor_update_room_links" on public.hotel_room_links for update to authenticated using(public.has_active_hotel_role(hotel_id,'editor') and public.is_hotel_module_enabled(hotel_id,'rooms.qr')) with check(public.has_active_hotel_role(hotel_id,'editor') and public.is_hotel_module_enabled(hotel_id,'rooms.qr'));

comment on table public.hotel_module_entitlements is 'Platform-governed module rights. Disabling preserves all module data.';
