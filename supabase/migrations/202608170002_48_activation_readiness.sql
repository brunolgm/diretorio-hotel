-- Sprint 48: real-time activation readiness shared by hotel admin and platform governance.

do $$
declare
  status_source text;
  public_hotels_source text;
  expected_module_keys text[] := array[
    'analytics.advanced','analytics.basic','audit.access_logs','content.announcements',
    'content.banners','content.departments','content.languages','content.policies',
    'content.services','content.tourism','core.directory','experience.appearance',
    'experience.navigation','experience.preview','experience.seo','fb.menu',
    'integrations.opera','integrations.thex','rooms.qr'
  ];
  actual_module_keys text[];
begin
  if to_regprocedure('public.calculate_hotel_readiness(uuid)') is not null
    or to_regprocedure('public.get_platform_hotel_readiness(uuid)') is not null
    or to_regprocedure('public.get_current_hotel_readiness()') is not null then
    raise exception '48 preflight failed: readiness function already exists';
  end if;

  if to_regclass('public.hotels') is null or to_regclass('public.profiles') is null
    or to_regclass('public.platform_users') is null
    or to_regclass('public.hotel_module_entitlements') is null
    or to_regclass('public.hotel_sections') is null
    or to_regclass('public.hotel_departments') is null
    or to_regclass('public.hotel_policies') is null
    or to_regclass('public.hotel_promotional_banners') is null
    or to_regclass('public.hotel_announcements') is null
    or to_regclass('public.hotel_room_links') is null
    or to_regclass('public.hotel_section_translations') is null
    or to_regclass('public.hotel_department_translations') is null
    or to_regclass('public.hotel_policy_translations') is null
    or to_regclass('public.hotel_promotional_banner_translations') is null
    or to_regclass('public.hotel_announcement_translations') is null then
    raise exception '48 preflight failed: required hotel/readiness tables are missing';
  end if;

  if exists (
    select 1 from (values
      ('hotels','id','uuid','NO'),('hotels','name','text','NO'),('hotels','city','text','YES'),
      ('hotels','slug','text','NO'),('hotels','subdomain','text','YES'),
      ('hotels','brand_code','text','YES'),('hotels','platform_status','text','NO'),
      ('hotels','checkin_time','text','YES'),('hotels','checkout_time','text','YES'),
      ('hotels','breakfast_hours','text','YES'),('hotels','whatsapp_number','text','YES'),
      ('hotels','website_url','text','YES'),('hotels','booking_url','text','YES'),
      ('hotels','logo_url','text','YES'),('hotels','hero_image_url','text','YES'),
      ('profiles','id','uuid','NO'),('profiles','hotel_id','uuid','YES'),
      ('profiles','role','text','YES'),('profiles','is_active','boolean','NO'),
      ('hotel_sections','hotel_id','uuid','NO'),('hotel_sections','enabled','boolean','YES'),
      ('hotel_departments','hotel_id','uuid','NO'),('hotel_departments','enabled','boolean','YES'),
      ('hotel_policies','hotel_id','uuid','NO'),('hotel_policies','enabled','boolean','YES'),
      ('hotel_promotional_banners','hotel_id','uuid','NO'),('hotel_promotional_banners','is_active','boolean','NO'),
      ('hotel_promotional_banners','starts_at','timestamp with time zone','YES'),
      ('hotel_promotional_banners','ends_at','timestamp with time zone','YES'),
      ('hotel_announcements','hotel_id','uuid','NO'),
      ('hotel_room_links','hotel_id','uuid','NO'),('hotel_room_links','is_active','boolean','NO'),
      ('hotel_section_translations','section_id','uuid','NO'),
      ('hotel_department_translations','department_id','uuid','NO'),
      ('hotel_policy_translations','policy_id','uuid','NO'),
      ('hotel_promotional_banner_translations','banner_id','uuid','NO'),
      ('hotel_announcement_translations','announcement_id','uuid','NO')
    ) expected(table_name,column_name,data_type,is_nullable)
    left join information_schema.columns c
      on c.table_schema='public' and c.table_name=expected.table_name
      and c.column_name=expected.column_name and c.data_type=expected.data_type
      and c.is_nullable=expected.is_nullable
    where c.column_name is null
  ) then
    raise exception '48 preflight failed: a readiness source column drifted';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid='public.hotels'::regclass and c.conname='hotels_platform_status_check'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'draft'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'active'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'suspended'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'archived'
  ) or not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid='public.hotels'::regclass and c.conname='hotels_brand_code_check'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'mercure'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'novotel'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'grand-mercure'
  ) then
    raise exception '48 preflight failed: lifecycle/brand contract drifted';
  end if;

  select pg_catalog.array_agg(matches[1] order by matches[1]) into actual_module_keys
  from pg_catalog.pg_constraint c
  cross join lateral pg_catalog.regexp_matches(
    pg_catalog.pg_get_constraintdef(c.oid), '''([a-z0-9._-]+)''', 'g'
  ) matches
  where c.conrelid='public.hotel_module_entitlements'::regclass
    and c.conname='hotel_module_entitlements_module_key_check';
  if actual_module_keys is distinct from expected_module_keys then
    raise exception '48 preflight failed: canonical 46.8 module catalog drifted';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.is_hotel_module_enabled(uuid,text)'::regprocedure
      and p.prosecdef and p.provolatile='s'
      and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))
  ) or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.get_current_hotel_modules()'::regprocedure
      and p.prosecdef and p.provolatile='s'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'platform_status[[:space:]]*<>[[:space:]]*''archived'''
  ) or to_regprocedure('public.has_active_hotel_role(uuid,text)') is null then
    raise exception '48 preflight failed: 45B/46.8 helper contract drifted';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)'::regprocedure
      and p.prosecdef and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))
      and pg_catalog.pg_get_functiondef(p.oid) ~* '''draft'''
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'baseline_modules''[[:space:]]*,[[:space:]]*11'
  ) then
    raise exception '48 preflight failed: Sprint 47 onboarding contract drifted';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class c
    where c.oid='public.public_hotels'::regclass and c.relkind='v'
  ) then
    raise exception '48 preflight failed: public lifecycle/entitlement view drifted';
  end if;
  select pg_catalog.pg_get_viewdef('public.public_hotels'::regclass,true)
    into public_hotels_source;
  if public_hotels_source !~* '([a-z_][a-z0-9_]*\.)?platform_status[[:space:]]*=[[:space:]]*''active''(::text)?'
    or public_hotels_source !~* '(public\.)?is_hotel_module_enabled[[:space:]]*\([[:space:]]*([a-z_][a-z0-9_]*\.)?id[[:space:]]*,[[:space:]]*''core\.directory''(::text)?[[:space:]]*\)'
    or public_hotels_source ~* 'readiness' then
    raise exception '48 preflight failed: public lifecycle/entitlement view drifted';
  end if;

  if to_regprocedure('public.update_platform_hotel_status(uuid,text)') is null then
    raise exception '48 preflight failed: lifecycle RPC is missing';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid='public.update_platform_hotel_status(uuid,text)'::regprocedure
      and p.prosecdef and p.provolatile='v' and p.proretset
      and 'search_path=""'=any(coalesce(p.proconfig,array[]::text[]))
  ) or has_function_privilege('anon','public.update_platform_hotel_status(uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.update_platform_hotel_status(uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.update_platform_hotel_status(uuid,text)','EXECUTE') then
    raise exception '48 preflight failed: lifecycle RPC security/grant contract drifted';
  end if;
  select pg_catalog.pg_get_functiondef('public.update_platform_hotel_status(uuid,text)'::regprocedure)
    into status_source;
  if status_source !~* 'active_platform_admin_required'
    or status_source !~* 'for update'
    or status_source !~* 'previous_status[[:space:]]*=[[:space:]]*''draft''[[:space:]]+and[[:space:]]+p_status[[:space:]]+in[[:space:]]*\(''active'',[[:space:]]*''archived''\)'
    or status_source !~* 'previous_status[[:space:]]*=[[:space:]]*''active''[[:space:]]+and[[:space:]]+p_status[[:space:]]+in[[:space:]]*\(''suspended'',[[:space:]]*''archived''\)'
    or status_source !~* 'previous_status[[:space:]]*=[[:space:]]*''suspended''[[:space:]]+and[[:space:]]+p_status[[:space:]]+in[[:space:]]*\(''active'',[[:space:]]*''archived''\)'
    or status_source !~* 'record_platform_audit_event'
    or status_source !~* '''hotel\.status_updated'''
    or status_source !~* '''previous_status'''
    or status_source !~* '''new_status'''
    or status_source ~* 'readiness|platform_hotel_not_ready' then
    raise exception '48 preflight failed: known 46C lifecycle RPC drifted';
  end if;
end;
$$;

create function public.calculate_hotel_readiness(p_hotel_id uuid)
returns table(check_key text, severity text, passed boolean)
language plpgsql stable security definer set search_path='' as $$
declare
  hotel_row public.hotels%rowtype;
  core_enabled boolean;
  services_enabled boolean;
  departments_enabled boolean;
  policies_enabled boolean;
  banners_enabled boolean;
  rooms_enabled boolean;
  languages_enabled boolean;
  preview_enabled boolean;
begin
  select * into hotel_row from public.hotels h where h.id=p_hotel_id;
  if not found then return; end if;

  select
    coalesce(bool_or(e.module_key='core.directory' and e.is_enabled),false),
    coalesce(bool_or(e.module_key='content.services' and e.is_enabled),false),
    coalesce(bool_or(e.module_key='content.departments' and e.is_enabled),false),
    coalesce(bool_or(e.module_key='content.policies' and e.is_enabled),false),
    coalesce(bool_or(e.module_key='content.banners' and e.is_enabled),false),
    coalesce(bool_or(e.module_key='rooms.qr' and e.is_enabled),false),
    coalesce(bool_or(e.module_key='content.languages' and e.is_enabled),false),
    coalesce(bool_or(e.module_key='experience.preview' and e.is_enabled),false)
  into core_enabled,services_enabled,departments_enabled,policies_enabled,
    banners_enabled,rooms_enabled,languages_enabled,preview_enabled
  from public.hotel_module_entitlements e where e.hotel_id=p_hotel_id;

  return query values
    ('identity.name','blocking',nullif(pg_catalog.btrim(hotel_row.name),'') is not null),
    ('identity.city','blocking',nullif(pg_catalog.btrim(hotel_row.city),'') is not null),
    ('identity.slug','blocking',hotel_row.slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and pg_catalog.length(hotel_row.slug) between 3 and 64),
    ('identity.subdomain','blocking',hotel_row.subdomain is not null
      and hotel_row.subdomain ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$'
      and hotel_row.subdomain !~ '--' and pg_catalog.length(hotel_row.subdomain) between 3 and 32
      and hotel_row.subdomain not in ('www','app','admin','api','guestdesk')),
    ('admin.active','blocking',exists(select 1 from public.profiles p where p.hotel_id=p_hotel_id
      and p.is_active and pg_catalog.lower(pg_catalog.btrim(coalesce(p.role,''))) in ('administrador','admin','owner'))),
    ('module.core_directory','blocking',core_enabled),
    ('operation.checkin','warning',nullif(pg_catalog.btrim(hotel_row.checkin_time),'') is not null),
    ('operation.checkout','warning',nullif(pg_catalog.btrim(hotel_row.checkout_time),'') is not null),
    ('operation.breakfast','warning',nullif(pg_catalog.btrim(hotel_row.breakfast_hours),'') is not null),
    ('contact.primary','warning',coalesce(nullif(pg_catalog.btrim(hotel_row.whatsapp_number),''),
      nullif(pg_catalog.btrim(hotel_row.website_url),''),nullif(pg_catalog.btrim(hotel_row.booking_url),'')) is not null),
    ('visual.logo','warning',nullif(pg_catalog.btrim(hotel_row.logo_url),'') is not null),
    ('visual.hero','warning',nullif(pg_catalog.btrim(hotel_row.hero_image_url),'') is not null);

  if services_enabled then return query select 'content.services','warning',exists(
    select 1 from public.hotel_sections s where s.hotel_id=p_hotel_id and s.enabled); end if;
  if departments_enabled then return query select 'content.departments','warning',exists(
    select 1 from public.hotel_departments d where d.hotel_id=p_hotel_id and d.enabled); end if;
  if policies_enabled then return query select 'content.policies','warning',exists(
    select 1 from public.hotel_policies p where p.hotel_id=p_hotel_id and p.enabled); end if;
  if banners_enabled then return query select 'content.banners','warning',exists(
    select 1 from public.hotel_promotional_banners b where b.hotel_id=p_hotel_id and b.is_active
      and (b.starts_at is null or b.starts_at<=now()) and (b.ends_at is null or b.ends_at>=now())); end if;
  if rooms_enabled then return query select 'rooms.qr','warning',exists(
    select 1 from public.hotel_room_links r where r.hotel_id=p_hotel_id and r.is_active); end if;
  if languages_enabled then return query select 'languages.translations','warning',exists(
    select 1 from public.hotel_section_translations t join public.hotel_sections s on s.id=t.section_id where s.hotel_id=p_hotel_id
    union all select 1 from public.hotel_department_translations t join public.hotel_departments d on d.id=t.department_id where d.hotel_id=p_hotel_id
    union all select 1 from public.hotel_policy_translations t join public.hotel_policies p on p.id=t.policy_id where p.hotel_id=p_hotel_id
    union all select 1 from public.hotel_promotional_banner_translations t join public.hotel_promotional_banners b on b.id=t.banner_id where b.hotel_id=p_hotel_id
    union all select 1 from public.hotel_announcement_translations t join public.hotel_announcements a on a.id=t.announcement_id where a.hotel_id=p_hotel_id
  ); end if;
  if preview_enabled then return query select 'experience.preview','warning',(
    core_enabled and nullif(pg_catalog.btrim(hotel_row.name),'') is not null
    and hotel_row.slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and hotel_row.subdomain is not null
  ); end if;
end;
$$;

revoke all on function public.calculate_hotel_readiness(uuid) from public,anon,authenticated,service_role;

create function public.get_platform_hotel_readiness(p_hotel_id uuid)
returns table(hotel_id uuid,platform_status text,ready_to_activate boolean,blocking_count bigint,
  warning_count bigint,check_key text,severity text,passed boolean)
language plpgsql stable security definer set search_path='' as $$
declare current_status text;
begin
  if auth.uid() is null or not exists(select 1 from public.platform_users pu
    where pu.user_id=auth.uid() and pu.role='platform_admin' and pu.is_active) then
    raise exception using errcode='42501',message='active_platform_admin_required';
  end if;
  select h.platform_status into current_status from public.hotels h where h.id=p_hotel_id;
  if not found then raise exception using errcode='P0002',message='platform_hotel_not_found'; end if;
  return query with evaluated as materialized (
    select * from public.calculate_hotel_readiness(p_hotel_id)
  ), summary as (
    select count(*) filter(where e.severity='blocking' and not e.passed) as blockers,
      count(*) filter(where e.severity='warning' and not e.passed) as warnings from evaluated e
  ) select p_hotel_id,current_status,(s.blockers=0),s.blockers,s.warnings,
    e.check_key,e.severity,e.passed from evaluated e cross join summary s order by e.check_key;
end;
$$;

create function public.get_current_hotel_readiness()
returns table(hotel_id uuid,platform_status text,ready_to_activate boolean,blocking_count bigint,
  warning_count bigint,check_key text,severity text,passed boolean)
language plpgsql stable security definer set search_path='' as $$
declare current_hotel_id uuid; current_status text;
begin
  select p.hotel_id,h.platform_status into current_hotel_id,current_status
  from public.profiles p join public.hotels h on h.id=p.hotel_id
  where p.id=auth.uid() and p.is_active;
  if current_hotel_id is null or current_status='archived' then
    raise exception using errcode='42501',message='active_hotel_profile_required';
  end if;
  return query with evaluated as materialized (
    select * from public.calculate_hotel_readiness(current_hotel_id)
  ), summary as (
    select count(*) filter(where e.severity='blocking' and not e.passed) as blockers,
      count(*) filter(where e.severity='warning' and not e.passed) as warnings from evaluated e
  ) select current_hotel_id,current_status,(s.blockers=0),s.blockers,s.warnings,
    e.check_key,e.severity,e.passed from evaluated e cross join summary s order by e.check_key;
end;
$$;

revoke all on function public.get_platform_hotel_readiness(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_current_hotel_readiness() from public,anon,authenticated,service_role;
grant execute on function public.get_platform_hotel_readiness(uuid) to authenticated;
grant execute on function public.get_current_hotel_readiness() to authenticated;

drop function public.update_platform_hotel_status(uuid,text);

create function public.update_platform_hotel_status(p_hotel_id uuid,p_status text)
returns table(hotel_id uuid,brand_code text,platform_status text,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare previous_status text;
begin
  if auth.uid() is null or not exists(select 1 from public.platform_users pu
    where pu.user_id=auth.uid() and pu.is_active and pu.role='platform_admin') then
    raise exception using errcode='42501',message='active_platform_admin_required';
  end if;
  if p_hotel_id is null or p_status is null or p_status not in ('draft','active','suspended','archived') then
    raise exception using errcode='22023',message='platform_hotel_status_invalid';
  end if;
  select h.platform_status into previous_status from public.hotels h where h.id=p_hotel_id for update;
  if not found then raise exception using errcode='P0002',message='platform_hotel_not_found'; end if;
  if previous_status=p_status then raise exception using errcode='22023',message='platform_hotel_status_unchanged'; end if;
  if not ((previous_status='draft' and p_status in ('active','archived'))
    or (previous_status='active' and p_status in ('suspended','archived'))
    or (previous_status='suspended' and p_status in ('active','archived'))) then
    raise exception using errcode='22023',message='platform_hotel_status_transition_invalid';
  end if;
  if previous_status='draft' and p_status='active' and exists(
    select 1 from public.calculate_hotel_readiness(p_hotel_id) r
    where r.severity='blocking' and not r.passed
  ) then raise exception using errcode='55000',message='platform_hotel_not_ready'; end if;

  update public.hotels h set platform_status=p_status,updated_at=now() where h.id=p_hotel_id;
  perform public.record_platform_audit_event(auth.uid(),'hotel.status_updated','hotel',p_hotel_id,
    pg_catalog.jsonb_build_object('previous_status',previous_status,'new_status',p_status),null);
  return query select h.id,h.brand_code,h.platform_status,h.updated_at from public.hotels h where h.id=p_hotel_id;
end;
$$;

revoke all on function public.update_platform_hotel_status(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.update_platform_hotel_status(uuid,text) to authenticated;

comment on function public.calculate_hotel_readiness(uuid) is 'Internal fixed-key real-time readiness evaluator; no application role has direct EXECUTE.';
comment on function public.get_platform_hotel_readiness(uuid) is 'Platform-admin readiness projection without operational values or secrets.';
comment on function public.get_current_hotel_readiness() is 'Hotel-scoped readiness projection resolved exclusively from auth.uid().';
comment on function public.update_platform_hotel_status(uuid,text) is 'Canonical lifecycle mutation; only first draft-to-active transition is gated by blocking readiness checks.';
