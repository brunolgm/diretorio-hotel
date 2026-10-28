-- Bugan is a canonical brand; no hotel/entitlement backfill and no remote activation.
-- RPC bodies preserved from Sprint 46c / 50 except brand allowlists and Bugan insert default.
-- CREATE OR REPLACE preserves existing owners, ACLs and SECURITY DEFINER authorization.
-- Logical rollback: first migrate any Bugan tenants to NULL/another brand and legacy theme;
-- then restore the prior constraint and these three function bodies from Sprint 46c / 50.
-- Never delete tenant data as rollback. Existing persisted layouts are never updated here.
begin;
alter table public.hotels drop constraint if exists hotels_brand_code_check;
alter table public.hotels add constraint hotels_brand_code_check
  check (brand_code is null or brand_code in ('mercure','novotel','grand-mercure','bugan'));

create or replace function public.update_platform_hotel_brand(
  p_hotel_id uuid,
  p_brand_code text
)
returns table (
  hotel_id uuid,
  brand_code text,
  platform_status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_brand text;
  current_status text;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.platform_users pu
    where pu.user_id = auth.uid()
      and pu.is_active = true
      and pu.role = 'platform_admin'
  ) then
    raise exception using errcode = '42501', message = 'active_platform_admin_required';
  end if;

  if p_hotel_id is null
    or (p_brand_code is not null and p_brand_code not in ('mercure', 'novotel', 'grand-mercure', 'bugan'))
  then
    raise exception using errcode = '22023', message = 'platform_hotel_brand_invalid';
  end if;

  select h.brand_code, h.platform_status
    into previous_brand, current_status
  from public.hotels h
  where h.id = p_hotel_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'platform_hotel_not_found';
  end if;

  if current_status = 'archived' then
    raise exception using errcode = '55000', message = 'platform_hotel_archived';
  end if;

  if previous_brand is not distinct from p_brand_code then
    raise exception using errcode = '22023', message = 'platform_hotel_brand_unchanged';
  end if;

  update public.hotels h
  set brand_code = p_brand_code,
      updated_at = now()
  where h.id = p_hotel_id;

  perform public.record_platform_audit_event(
    auth.uid(),
    'hotel.brand_updated',
    'hotel',
    p_hotel_id,
    pg_catalog.jsonb_build_object(
      'previous_brand', previous_brand,
      'new_brand', p_brand_code
    ),
    null
  );

  return query
  select h.id, h.brand_code, h.platform_status, h.updated_at
  from public.hotels h
  where h.id = p_hotel_id;
end;
$$;

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
  if p_brand_code is not null and p_brand_code not in('mercure','novotel','grand-mercure','bugan') then
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
    values(new_hotel_id,normalized_name,normalized_city,normalized_slug,normalized_subdomain,p_brand_code,case when p_brand_code='bugan' then coalesce(p_theme_preset,'bugan') else p_theme_preset end,'draft');
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

create or replace function public.initialize_hotel_experience_layout()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,enabled_by)
  values(new.id,'experience.navigation',true,now(),auth.uid())
  on conflict on constraint hotel_module_entitlements_pkey do nothing;
  insert into public.hotel_experience_layout(hotel_id,block_key,is_enabled,position)
  select new.id,b.block_key,true,
    (case when new.brand_code='bugan' then b.bugan_position when new.brand_code in('mercure','novotel','grand-mercure') then b.brand_position else b.default_position end)::smallint
  from (values
    ('hero',1,1,1),('banners',2,3,8),('announcements',3,4,3),('quick_info',4,2,2),
    ('services',5,5,4),('departments',6,6,6),('policies',7,7,7),('contact',8,8,5)
  ) b(block_key,default_position,brand_position,bugan_position)
  on conflict on constraint hotel_experience_layout_pkey do nothing;
  return new;
end;
$$;
commit;
