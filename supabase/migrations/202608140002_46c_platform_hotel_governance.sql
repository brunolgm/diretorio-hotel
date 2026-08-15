-- Sprint 46C: narrow platform hotel governance and separate global audit.
-- No browser policy or direct table grant on public.hotels is introduced here.

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.hotels'::regclass
      and a.attname = 'platform_status'
      and not a.attisdropped
  ) then
    raise exception '46C preflight failed: public.hotels.platform_status already exists and must be reviewed';
  end if;

  if to_regclass('public.platform_audit_log') is not null then
    raise exception '46C preflight failed: public.platform_audit_log already exists and must be reviewed';
  end if;

  if to_regprocedure('public.is_hotel_publicly_active(uuid)') is not null then
    raise exception '46C preflight failed: public.is_hotel_publicly_active(uuid) already exists and must be reviewed';
  end if;

  if to_regclass('public.public_hotels') is null
    or not exists (
      select 1 from pg_catalog.pg_class c
      where c.oid = 'public.public_hotels'::regclass and c.relkind = 'v'
    )
    or pg_catalog.pg_get_viewdef('public.public_hotels'::regclass, true) !~* 'from (public\.)?hotels'
    or pg_catalog.pg_get_viewdef('public.public_hotels'::regclass, true) ~* 'platform_status'
  then
    raise exception '46C preflight failed: known 45B public_hotels view is missing or drifted';
  end if;

  if (
    select array_agg(c.column_name::text order by c.ordinal_position)
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'public_hotels'
  ) is distinct from array[
    'id', 'name', 'slug', 'subdomain', 'city', 'booking_url', 'website_url',
    'instagram_url', 'whatsapp_number', 'wifi_name', 'wifi_password', 'breakfast_hours',
    'checkin_time', 'checkout_time', 'logo_url', 'hero_image_url', 'brand_code',
    'theme_preset', 'theme_primary_color'
  ]::text[] then
    raise exception '46C preflight failed: known 45B public_hotels projection drifted';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('public.has_active_hotel_role(uuid,text)')
      and p.prosecdef = true
      and p.provolatile = 's'
      and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'from public\.profiles'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'auth\.uid\(\)'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'p\.is_active[[:space:]]*=[[:space:]]*true'
      and pg_catalog.pg_get_functiondef(p.oid) !~* 'platform_status'
  ) or not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('public.has_active_hotel_path_role(text,text)')
      and p.prosecdef = true
      and p.provolatile = 's'
      and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'from public\.profiles'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'auth\.uid\(\)'
      and pg_catalog.pg_get_functiondef(p.oid) ~* 'p\.is_active[[:space:]]*=[[:space:]]*true'
      and pg_catalog.pg_get_functiondef(p.oid) !~* 'platform_status'
  ) then
    raise exception '46C preflight failed: known 45B hotel authorization helpers are missing or drifted';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.cmd = 'SELECT'
      and (p.tablename, p.policyname) in (
        ('hotel_sections', '45b_public_read_enabled_sections'),
        ('hotel_departments', '45b_public_read_enabled_departments'),
        ('hotel_policies', '45b_public_read_enabled_policies'),
        ('hotel_section_translations', '45b_public_read_section_translations'),
        ('hotel_department_translations', '45b_public_read_department_translations'),
        ('hotel_policy_translations', '45b_public_read_policy_translations'),
        ('hotel_announcements', '45b_public_read_active_announcements'),
        ('hotel_announcement_translations', '45b_public_read_announcement_translations'),
        ('hotel_promotional_banners', '45b_public_read_active_banners'),
        ('hotel_promotional_banner_translations', '45b_public_read_banner_translations')
      )
  ) <> 10 then
    raise exception '46C preflight failed: known 45B public content policies are missing or drifted';
  end if;

  if to_regprocedure('public.get_platform_hotel_metrics()') is null
    or to_regprocedure('public.list_platform_hotels(text,integer,integer)') is null
    or to_regclass('public.platform_users') is null
  then
    raise exception '46C preflight failed: required 46A/46B objects are missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('public.get_platform_hotel_metrics()')
      and p.prosecdef = true
      and p.provolatile = 's'
      and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
      and pg_catalog.pg_get_function_result(p.oid)
        ~* '^table\(total_hotels bigint, hotels_by_brand jsonb\)$'
  ) or not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('public.list_platform_hotels(text,integer,integer)')
      and p.prosecdef = true
      and p.provolatile = 's'
      and 'search_path=""' = any(coalesce(p.proconfig, array[]::text[]))
      and pg_catalog.pg_get_function_result(p.oid) ~*
        '^table\(total_count bigint, id uuid, name text, slug text, subdomain text, city text, brand_code text, theme_preset text, logo_url text\)$'
  ) then
    raise exception '46C preflight failed: known 46B RPC contracts drifted and must not be replaced';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.hotels'::regclass
      and c.conname = 'hotels_brand_code_check'
      and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'mercure'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'novotel'
      and pg_catalog.pg_get_constraintdef(c.oid) ~* 'grand-mercure'
  ) then
    raise exception '46C preflight failed: canonical hotels brand constraint is missing or drifted';
  end if;

  if to_regprocedure('public.get_platform_hotel_detail(uuid)') is not null
    or to_regprocedure('public.update_platform_hotel_brand(uuid,text)') is not null
    or to_regprocedure('public.update_platform_hotel_status(uuid,text)') is not null
    or to_regprocedure('public.record_platform_audit_event(uuid,text,text,uuid,jsonb,text)') is not null
  then
    raise exception '46C preflight failed: a new governance function already exists and must be reviewed';
  end if;
end;
$$;

alter table public.hotels
  add column platform_status text not null default 'active',
  add constraint hotels_platform_status_check
    check (platform_status in ('draft', 'active', 'suspended', 'archived'));

comment on column public.hotels.platform_status is
  'Canonical platform lifecycle. Existing hotels start active; lifecycle is never inferred from content or brand.';

create function public.is_hotel_publicly_active(target_hotel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.hotels h
    where h.id = target_hotel_id
      and h.platform_status = 'active'
  );
$$;

revoke all on function public.is_hotel_publicly_active(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.is_hotel_publicly_active(uuid)
  to anon, authenticated;

-- Replace the reviewed 45B projection so inactive lifecycle states are not guest-facing.
drop view public.public_hotels;
create view public.public_hotels
with (security_barrier = true, security_invoker = false)
as
select
  id,
  name,
  slug,
  subdomain,
  city,
  booking_url,
  website_url,
  instagram_url,
  whatsapp_number,
  wifi_name,
  wifi_password,
  breakfast_hours,
  checkin_time,
  checkout_time,
  logo_url,
  hero_image_url,
  brand_code,
  theme_preset,
  theme_primary_color
from public.hotels
where platform_status = 'active';

revoke all on table public.public_hotels from public, anon, authenticated;
grant select on table public.public_hotels to anon, authenticated;
comment on view public.public_hotels is
  'Explicit guest-facing projection restricted to active hotels. Non-active and unknown hotels resolve identically.';

-- These are known 45B helpers verified in preflight. Archived blocks the hotel operational context;
-- draft and suspended remain available to hotel staff for preparation/correction.
create or replace function public.has_active_hotel_role(
  target_hotel_id uuid,
  required_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.hotels h on h.id = p.hotel_id
    where p.id = auth.uid()
      and p.hotel_id = target_hotel_id
      and p.is_active = true
      and h.platform_status <> 'archived'
      and case pg_catalog.lower(pg_catalog.btrim(coalesce(p.role, '')))
        when 'visualizador' then 1
        when 'operador' then 2
        when 'editor' then 3
        when 'administrador' then 4
        when 'admin' then 4
        when 'owner' then 4
        else 0
      end >= case required_role
        when 'visualizador' then 1
        when 'operador' then 2
        when 'editor' then 3
        when 'administrador' then 4
        else 99
      end
  );
$$;

create or replace function public.has_active_hotel_path_role(
  target_hotel_id text,
  required_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.hotels h on h.id = p.hotel_id
    where p.id = auth.uid()
      and p.hotel_id::text = target_hotel_id
      and p.is_active = true
      and h.platform_status <> 'archived'
      and case pg_catalog.lower(pg_catalog.btrim(coalesce(p.role, '')))
        when 'visualizador' then 1 when 'operador' then 2 when 'editor' then 3
        when 'administrador' then 4 when 'admin' then 4 when 'owner' then 4 else 0
      end >= case required_role
        when 'visualizador' then 1 when 'operador' then 2 when 'editor' then 3
        when 'administrador' then 4 else 99
      end
  );
$$;

revoke all on function public.has_active_hotel_role(uuid, text) from public, anon;
grant execute on function public.has_active_hotel_role(uuid, text) to authenticated, service_role;
revoke all on function public.has_active_hotel_path_role(text, text) from public, anon;
grant execute on function public.has_active_hotel_path_role(text, text) to authenticated, service_role;
comment on function public.has_active_hotel_role(uuid, text) is
  'Hotel-scoped RLS helper. Active profiles retain draft/suspended correction access; archived is operationally blocked.';
comment on function public.has_active_hotel_path_role(text, text) is
  'Storage-safe hotel path helper. Avoids hostile casts and blocks archived hotel context.';
comment on function public.is_hotel_publicly_active(uuid) is
  'Narrow lifecycle predicate for guest policies. Returns true only for active hotels without exposing hotel rows.';

drop policy "45b_public_read_enabled_sections" on public.hotel_sections;
create policy "45b_public_read_enabled_sections" on public.hotel_sections
  for select to anon, authenticated
  using (enabled = true and public.is_hotel_publicly_active(hotel_id));

drop policy "45b_public_read_enabled_departments" on public.hotel_departments;
create policy "45b_public_read_enabled_departments" on public.hotel_departments
  for select to anon, authenticated
  using (enabled = true and public.is_hotel_publicly_active(hotel_id));

drop policy "45b_public_read_enabled_policies" on public.hotel_policies;
create policy "45b_public_read_enabled_policies" on public.hotel_policies
  for select to anon, authenticated
  using (enabled = true and public.is_hotel_publicly_active(hotel_id));

drop policy "45b_public_read_section_translations" on public.hotel_section_translations;
create policy "45b_public_read_section_translations" on public.hotel_section_translations
  for select to anon, authenticated using (exists (
    select 1 from public.hotel_sections s
    where s.id = section_id and s.enabled = true
      and public.is_hotel_publicly_active(s.hotel_id)
  ));

drop policy "45b_public_read_department_translations" on public.hotel_department_translations;
create policy "45b_public_read_department_translations" on public.hotel_department_translations
  for select to anon, authenticated using (exists (
    select 1 from public.hotel_departments d
    where d.id = department_id and d.enabled = true
      and public.is_hotel_publicly_active(d.hotel_id)
  ));

drop policy "45b_public_read_policy_translations" on public.hotel_policy_translations;
create policy "45b_public_read_policy_translations" on public.hotel_policy_translations
  for select to anon, authenticated using (exists (
    select 1 from public.hotel_policies p
    where p.id = policy_id and p.enabled = true
      and public.is_hotel_publicly_active(p.hotel_id)
  ));

drop policy "45b_public_read_active_announcements" on public.hotel_announcements;
create policy "45b_public_read_active_announcements" on public.hotel_announcements
  for select to anon, authenticated using (
    is_active = true
    and public.is_hotel_publicly_active(hotel_id)
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy "45b_public_read_announcement_translations" on public.hotel_announcement_translations;
create policy "45b_public_read_announcement_translations" on public.hotel_announcement_translations
  for select to anon, authenticated using (exists (
    select 1 from public.hotel_announcements a
    where a.id = announcement_id and a.is_active = true
      and public.is_hotel_publicly_active(a.hotel_id)
      and (a.starts_at is null or a.starts_at <= now())
      and (a.ends_at is null or a.ends_at >= now())
  ));

drop policy "45b_public_read_active_banners" on public.hotel_promotional_banners;
create policy "45b_public_read_active_banners" on public.hotel_promotional_banners
  for select to anon, authenticated using (
    is_active = true
    and public.is_hotel_publicly_active(hotel_id)
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy "45b_public_read_banner_translations" on public.hotel_promotional_banner_translations;
create policy "45b_public_read_banner_translations" on public.hotel_promotional_banner_translations
  for select to anon, authenticated using (exists (
    select 1 from public.hotel_promotional_banners b
    where b.id = banner_id and b.is_active = true
      and public.is_hotel_publicly_active(b.hotel_id)
      and (b.starts_at is null or b.starts_at <= now())
      and (b.ends_at is null or b.ends_at >= now())
  ));

create table public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  request_id text null,
  constraint platform_audit_log_action_check
    check (length(action) between 1 and 80 and action ~ '^[a-z0-9._-]+$'),
  constraint platform_audit_log_entity_type_check
    check (length(entity_type) between 1 and 80 and entity_type ~ '^[a-z0-9._-]+$'),
  constraint platform_audit_log_request_id_check
    check (request_id is null or length(request_id) between 1 and 100),
  constraint platform_audit_log_metadata_check
    check (
      pg_catalog.jsonb_typeof(metadata) = 'object'
      and pg_catalog.octet_length(metadata::text) <= 2048
      and not pg_catalog.jsonb_path_exists(
        metadata,
        '$.* ? (@.type() == "object" || @.type() == "array")'::jsonpath
      )
    ),
  constraint platform_audit_log_metadata_sensitive_keys_check
    check (
      not pg_catalog.jsonb_path_exists(
        metadata,
        '$.keyvalue() ? (@.key like_regex "^(password|senha|roomtoken|room_token|token|jwt|service_role|payload|cookie|authorization)$" flag "i")'::jsonpath
      )
    )
);

create index platform_audit_log_created_at_idx
  on public.platform_audit_log(created_at desc);
create index platform_audit_log_actor_created_at_idx
  on public.platform_audit_log(actor_user_id, created_at desc);
create index platform_audit_log_entity_idx
  on public.platform_audit_log(entity_type, entity_id, created_at desc);

alter table public.platform_audit_log enable row level security;

-- No policy is intentional. Application roles cannot browse or mutate the global audit trail.
revoke all on table public.platform_audit_log from public, anon, authenticated, service_role;

create function public.record_platform_audit_event(
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
    select 1
    from public.platform_users pu
    where pu.user_id = auth.uid()
      and pu.is_active = true
      and pu.role = 'platform_admin'
  ) then
    raise exception using errcode = '42501', message = 'active_platform_admin_required';
  end if;

  if p_action not in ('hotel.brand_updated', 'hotel.status_updated')
    or p_entity_type <> 'hotel'
    or p_entity_id is null
  then
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

revoke all on function public.record_platform_audit_event(uuid, text, text, uuid, jsonb, text)
  from public, anon, authenticated, service_role;

-- Evolve the known 46B contracts by explicit drop/recreate after preflight.
drop function public.get_platform_hotel_metrics();
drop function public.list_platform_hotels(text, integer, integer);

create function public.get_platform_hotel_metrics()
returns table (
  total_hotels bigint,
  hotels_by_brand jsonb,
  hotels_by_status jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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

  return query
  select
    (select count(*) from public.hotels),
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(grouped.brand_key, grouped.hotel_count order by grouped.brand_key)
        from (
          select coalesce(h.brand_code, 'unassigned') as brand_key, count(*) as hotel_count
          from public.hotels h
          group by coalesce(h.brand_code, 'unassigned')
        ) grouped
      ),
      '{}'::jsonb
    ),
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(grouped.status_key, grouped.hotel_count order by grouped.status_key)
        from (
          select h.platform_status as status_key, count(*) as hotel_count
          from public.hotels h
          group by h.platform_status
        ) grouped
      ),
      '{}'::jsonb
    );
end;
$$;

create function public.list_platform_hotels(
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  total_count bigint,
  id uuid,
  name text,
  slug text,
  subdomain text,
  city text,
  brand_code text,
  theme_preset text,
  logo_url text,
  platform_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_search text := nullif(pg_catalog.btrim(p_search), '');
  escaped_search text;
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

  if p_page is null or p_page < 1 or p_page > 100000 then
    raise exception using errcode = '22023', message = 'platform_directory_page_invalid';
  end if;

  if p_page_size is null or p_page_size < 1 or p_page_size > 50 then
    raise exception using errcode = '22023', message = 'platform_directory_page_size_invalid';
  end if;

  if normalized_search is not null and length(normalized_search) > 100 then
    raise exception using errcode = '22023', message = 'platform_directory_search_too_long';
  end if;

  escaped_search := replace(
    replace(replace(normalized_search, E'\\', E'\\\\'), '%', E'\\%'),
    '_',
    E'\\_'
  );

  return query
  with filtered_hotels as (
    select
      h.id, h.name, h.slug, h.subdomain, h.city, h.brand_code,
      h.theme_preset, h.logo_url, h.platform_status
    from public.hotels h
    where normalized_search is null
      or h.name ilike '%' || escaped_search || '%' escape E'\\'
      or h.slug ilike '%' || escaped_search || '%' escape E'\\'
      or coalesce(h.subdomain, '') ilike '%' || escaped_search || '%' escape E'\\'
      or coalesce(h.city, '') ilike '%' || escaped_search || '%' escape E'\\'
  )
  select
    count(*) over(), fh.id, fh.name, fh.slug, fh.subdomain, fh.city,
    fh.brand_code, fh.theme_preset, fh.logo_url, fh.platform_status
  from filtered_hotels fh
  order by lower(fh.name), fh.id
  limit p_page_size
  offset ((p_page::bigint - 1) * p_page_size::bigint);
end;
$$;

create function public.get_platform_hotel_detail(p_hotel_id uuid)
returns table (
  id uuid,
  name text,
  slug text,
  subdomain text,
  city text,
  brand_code text,
  theme_preset text,
  logo_url text,
  hero_image_url text,
  platform_status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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

  if p_hotel_id is null then
    raise exception using errcode = '22023', message = 'platform_hotel_id_required';
  end if;

  return query
  select
    h.id, h.name, h.slug, h.subdomain, h.city, h.brand_code,
    h.theme_preset, h.logo_url, h.hero_image_url, h.platform_status,
    h.created_at, h.updated_at
  from public.hotels h
  where h.id = p_hotel_id;
end;
$$;

create function public.update_platform_hotel_brand(
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
    or (p_brand_code is not null and p_brand_code not in ('mercure', 'novotel', 'grand-mercure'))
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

create function public.update_platform_hotel_status(
  p_hotel_id uuid,
  p_status text
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
  previous_status text;
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
    or p_status is null
    or p_status not in ('draft', 'active', 'suspended', 'archived')
  then
    raise exception using errcode = '22023', message = 'platform_hotel_status_invalid';
  end if;

  select h.platform_status
    into previous_status
  from public.hotels h
  where h.id = p_hotel_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'platform_hotel_not_found';
  end if;

  if previous_status = p_status then
    raise exception using errcode = '22023', message = 'platform_hotel_status_unchanged';
  end if;

  if not (
    (previous_status = 'draft' and p_status in ('active', 'archived'))
    or (previous_status = 'active' and p_status in ('suspended', 'archived'))
    or (previous_status = 'suspended' and p_status in ('active', 'archived'))
  ) then
    raise exception using errcode = '22023', message = 'platform_hotel_status_transition_invalid';
  end if;

  update public.hotels h
  set platform_status = p_status,
      updated_at = now()
  where h.id = p_hotel_id;

  perform public.record_platform_audit_event(
    auth.uid(),
    'hotel.status_updated',
    'hotel',
    p_hotel_id,
    pg_catalog.jsonb_build_object(
      'previous_status', previous_status,
      'new_status', p_status
    ),
    null
  );

  return query
  select h.id, h.brand_code, h.platform_status, h.updated_at
  from public.hotels h
  where h.id = p_hotel_id;
end;
$$;

revoke all on function public.get_platform_hotel_metrics()
  from public, anon, authenticated, service_role;
revoke all on function public.list_platform_hotels(text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.get_platform_hotel_detail(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.update_platform_hotel_brand(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.update_platform_hotel_status(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.get_platform_hotel_metrics() to authenticated;
grant execute on function public.list_platform_hotels(text, integer, integer) to authenticated;
grant execute on function public.get_platform_hotel_detail(uuid) to authenticated;
grant execute on function public.update_platform_hotel_brand(uuid, text) to authenticated;
grant execute on function public.update_platform_hotel_status(uuid, text) to authenticated;

comment on table public.platform_audit_log is
  'Append-only global governance audit. Historical actor and entity UUIDs intentionally have no destructive foreign keys.';
comment on function public.record_platform_audit_event(uuid, text, text, uuid, jsonb, text) is
  'Internal 46C audit writer. No application role has direct EXECUTE; governance RPCs call it in the same transaction.';
comment on function public.get_platform_hotel_detail(uuid) is
  'Minimal institutional/governance detail for an active platform_admin; operational fields and child data are excluded.';
comment on function public.update_platform_hotel_brand(uuid, text) is
  'Locks one hotel and updates only canonical platform brand identity with same-transaction global audit.';
comment on function public.update_platform_hotel_status(uuid, text) is
  'Locks one hotel and applies only canonical lifecycle transitions with same-transaction global audit.';
