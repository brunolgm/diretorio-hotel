-- Sprint 47: transactional database side of platform-owned multi-hotel onboarding.
-- Auth invitation stays in the server action and is compensated if this RPC fails.

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
begin
  if to_regprocedure('public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)') is not null then
    raise exception '47 preflight failed: onboarding RPC already exists';
  end if;
  if to_regclass('public.hotels') is null or to_regclass('public.profiles') is null
    or to_regclass('public.platform_users') is null
    or to_regclass('public.hotel_module_entitlements') is null
    or to_regclass('public.platform_audit_log') is null then
    raise exception '47 preflight failed: required 46A-46.8 objects are missing';
  end if;

  if exists (
    select 1 from (values
      ('hotels','id','uuid','NO'),('hotels','name','text','NO'),('hotels','city','text','YES'),
      ('hotels','slug','text','NO'),('hotels','subdomain','text','YES'),
      ('hotels','brand_code','text','YES'),('hotels','theme_preset','text','YES'),
      ('hotels','platform_status','text','NO'),
      ('profiles','id','uuid','NO'),('profiles','email','text','YES'),
      ('profiles','full_name','text','YES'),('profiles','role','text','YES'),
      ('profiles','hotel_id','uuid','YES'),('profiles','is_active','boolean','NO')
    ) expected(table_name,column_name,data_type,is_nullable)
    left join information_schema.columns c
      on c.table_schema='public' and c.table_name=expected.table_name
      and c.column_name=expected.column_name and c.data_type=expected.data_type
      and c.is_nullable=expected.is_nullable
    where c.column_name is null
  ) then
    raise exception '47 preflight failed: hotels/profiles schema drifted';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid='public.hotels'::regclass and c.conname='hotels_brand_code_check'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'mercure'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'novotel'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'grand-mercure'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid='public.hotels'::regclass and c.conname='hotels_platform_status_check'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'draft'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'active'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'suspended'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'archived'
  ) then
    raise exception '47 preflight failed: hotel brand/lifecycle constraints drifted';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_index i
    join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
    where i.indrelid='public.hotels'::regclass and i.indisunique
      and i.indnkeyatts=1 and i.indpred is null and a.attname='slug'
  ) then
    raise exception '47 preflight failed: audited UNIQUE guarantee for hotels.slug is missing';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_index i
    join pg_catalog.pg_class x on x.oid=i.indexrelid
    join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
    where i.indrelid='public.hotels'::regclass and x.relname='hotels_subdomain_unique_idx'
      and i.indisunique and i.indnkeyatts=1 and a.attname='subdomain'
      and pg_catalog.pg_get_expr(i.indpred,i.indrelid) ~* 'subdomain[[:space:]]+is[[:space:]]+not[[:space:]]+null'
  ) then
    raise exception '47 preflight failed: audited UNIQUE guarantee for hotels.subdomain drifted';
  end if;
  if exists (
    select 1
    from public.hotels h
    where h.slug <> pg_catalog.lower(h.slug)
      or h.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      or pg_catalog.length(h.slug) not between 3 and 64
  ) then
    raise exception '47 preflight failed: existing hotels.slug values are not canonical';
  end if;

  if (select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename='hotel_module_entitlements') <> 0
    or has_table_privilege('authenticated','public.hotel_module_entitlements','INSERT,UPDATE,DELETE') then
    raise exception '47 preflight failed: entitlement protection drifted';
  end if;
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
    raise exception '47 preflight failed: canonical 19-module catalog drifted';
  end if;
  if exists (
    select 1
    from public.hotels h
    cross join (values
      ('core.directory'),('content.services'),('content.departments'),('content.policies'),
      ('content.announcements'),('content.banners'),('rooms.qr'),('content.languages'),
      ('experience.appearance'),('experience.preview'),('analytics.basic')
    ) baseline(module_key)
    where not exists (
      select 1 from public.hotel_module_entitlements e
      where e.hotel_id=h.id and e.module_key=baseline.module_key
    )
  ) then
    raise exception '47 preflight failed: 46.8 eleven-module baseline drifted';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)'::regprocedure
      and p.prosecdef and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'hotel\.brand_updated'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'hotel\.status_updated'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'hotel\.module_enabled'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'hotel\.module_disabled'
      and pg_catalog.pg_get_functiondef(p.oid) !~* 'hotel\.created'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'platform_audit_metadata_invalid'
  ) then
    raise exception '47 preflight failed: controlled 46.8 audit writer drifted';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.get_platform_hotel_modules(uuid)'::regprocedure
      and p.prosecdef and p.provolatile='s'
      and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'experience\.preview'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'audit\.access_logs'
  ) then
    raise exception '47 preflight failed: 46.8 module catalog contract drifted';
  end if;
end;
$$;

-- Extend only the writer contract proved above. Direct EXECUTE remains revoked.
create or replace function public.record_platform_audit_event(
  p_actor_user_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_request_id text default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare audit_id uuid;
begin
  if auth.uid() is null or p_actor_user_id is distinct from auth.uid() then
    raise exception using errcode='42501', message='platform_audit_actor_invalid';
  end if;
  if not exists (select 1 from public.platform_users pu where pu.user_id=auth.uid() and pu.is_active=true and pu.role='platform_admin') then
    raise exception using errcode='42501', message='active_platform_admin_required';
  end if;
  if p_action not in (
    'hotel.brand_updated','hotel.status_updated','hotel.module_enabled','hotel.module_disabled','hotel.created'
  ) or p_entity_type <> 'hotel' or p_entity_id is null then
    raise exception using errcode='22023', message='platform_audit_event_invalid';
  end if;
  if p_metadata is null or pg_catalog.jsonb_typeof(p_metadata)<>'object'
    or pg_catalog.octet_length(p_metadata::text)>2048
    or pg_catalog.jsonb_path_exists(p_metadata,'$.* ? (@.type() == "object" || @.type() == "array")'::jsonpath)
    or pg_catalog.jsonb_path_exists(p_metadata,'$.keyvalue() ? (@.key like_regex "^(password|senha|roomtoken|room_token|token|jwt|service_role|payload|cookie|authorization)$" flag "i")'::jsonpath) then
    raise exception using errcode='22023', message='platform_audit_metadata_invalid';
  end if;
  insert into public.platform_audit_log(actor_user_id,action,entity_type,entity_id,metadata,request_id)
  values(p_actor_user_id,p_action,p_entity_type,p_entity_id,p_metadata,nullif(pg_catalog.btrim(p_request_id),''))
  returning id into audit_id;
  return audit_id;
end;
$$;
revoke all on function public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)
  from public,anon,authenticated,service_role;

create function public.create_platform_hotel_onboarding(
  p_name text,
  p_city text,
  p_slug text,
  p_subdomain text,
  p_brand_code text,
  p_theme_preset text,
  p_admin_user_id uuid,
  p_admin_email text,
  p_admin_full_name text
)
returns table(hotel_id uuid, platform_status text, admin_user_id uuid)
language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid := auth.uid();
  new_hotel_id uuid := gen_random_uuid();
  normalized_name text := pg_catalog.btrim(p_name);
  normalized_city text := pg_catalog.btrim(p_city);
  normalized_slug text := pg_catalog.lower(pg_catalog.btrim(p_slug));
  normalized_subdomain text := pg_catalog.lower(pg_catalog.btrim(p_subdomain));
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_admin_email));
  normalized_full_name text := pg_catalog.btrim(p_admin_full_name);
  existing_profile_hotel_id uuid;
  profile_exists boolean := false;
begin
  if actor_id is null or not exists (
    select 1 from public.platform_users pu
    where pu.user_id=actor_id and pu.role='platform_admin' and pu.is_active=true
  ) then raise exception using errcode='42501', message='active_platform_admin_required'; end if;

  if normalized_name is null or length(normalized_name) not between 1 and 120
    or normalized_city is null or length(normalized_city) not between 1 and 100 then
    raise exception using errcode='22023', message='platform_hotel_identity_invalid';
  end if;
  if normalized_slug is null or length(normalized_slug) not between 3 and 64
    or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode='22023', message='platform_hotel_slug_invalid';
  end if;
  if normalized_subdomain is null or length(normalized_subdomain) not between 3 and 32
    or normalized_subdomain !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$'
    or normalized_subdomain ~ '--' or normalized_subdomain in ('www','app','admin','api','guestdesk') then
    raise exception using errcode='22023', message='platform_hotel_subdomain_invalid';
  end if;
  if p_brand_code is not null and p_brand_code not in ('mercure','novotel','grand-mercure') then
    raise exception using errcode='22023', message='platform_hotel_brand_invalid';
  end if;
  if p_theme_preset is not null and p_theme_preset not in ('midnight-slate','ivory-noir','deep-ocean','graphite-gold','forest-ember') then
    raise exception using errcode='22023', message='platform_hotel_theme_invalid';
  end if;
  if p_admin_user_id is null or normalized_full_name is null or length(normalized_full_name) not between 1 and 120
    or normalized_email is null or length(normalized_email)>254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode='22023', message='platform_initial_admin_invalid';
  end if;
  if not exists (select 1 from auth.users u where u.id=p_admin_user_id and pg_catalog.lower(u.email)=normalized_email) then
    raise exception using errcode='P0002', message='platform_initial_admin_auth_missing';
  end if;
  if exists (select 1 from public.platform_users pu where pu.user_id=p_admin_user_id) then
    raise exception using errcode='55000', message='platform_initial_admin_incompatible';
  end if;

  select p.hotel_id into existing_profile_hotel_id
  from public.profiles p where p.id=p_admin_user_id for update;
  profile_exists := found;
  if profile_exists and existing_profile_hotel_id is not null then
    raise exception using errcode='55000', message='platform_initial_admin_incompatible';
  end if;
  if exists(select 1 from public.hotels h where h.slug=normalized_slug) then
    raise exception using errcode='23505', message='platform_hotel_slug_conflict';
  end if;
  if exists(select 1 from public.hotels h where h.subdomain=normalized_subdomain) then
    raise exception using errcode='23505', message='platform_hotel_subdomain_conflict';
  end if;

  begin
    insert into public.hotels(id,name,city,slug,subdomain,brand_code,theme_preset,platform_status)
    values(new_hotel_id,normalized_name,normalized_city,normalized_slug,normalized_subdomain,p_brand_code,p_theme_preset,'draft');
  exception when unique_violation then
    if exists(select 1 from public.hotels h where h.slug=normalized_slug) then
      raise exception using errcode='23505', message='platform_hotel_slug_conflict';
    elsif exists(select 1 from public.hotels h where h.subdomain=normalized_subdomain) then
      raise exception using errcode='23505', message='platform_hotel_subdomain_conflict';
    else raise;
    end if;
  end;

  insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,enabled_by)
  select new_hotel_id,module_key,true,now(),actor_id from (values
    ('core.directory'),('content.services'),('content.departments'),('content.policies'),
    ('content.announcements'),('content.banners'),('rooms.qr'),('content.languages'),
    ('experience.appearance'),('experience.preview'),('analytics.basic')
  ) baseline(module_key);

  if profile_exists then
    update public.profiles set email=normalized_email,full_name=normalized_full_name,
      role='administrador',hotel_id=new_hotel_id,is_active=true,updated_at=now()
    where id=p_admin_user_id;
  else
    insert into public.profiles(id,email,full_name,role,hotel_id,is_active)
    values(p_admin_user_id,normalized_email,normalized_full_name,'administrador',new_hotel_id,true);
  end if;

  perform public.record_platform_audit_event(
    actor_id,'hotel.created','hotel',new_hotel_id,
    pg_catalog.jsonb_build_object('brand_code',p_brand_code,'baseline_modules',11),null
  );

  return query select new_hotel_id,'draft'::text,p_admin_user_id;
end;
$$;

revoke all on function public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)
  to authenticated;

comment on function public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text) is
  'Creates one draft hotel, the canonical eleven-module baseline, initial active administrator profile and one platform audit event atomically.';
