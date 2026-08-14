-- Sprint 45B: authorization helper and declarative RLS/grant baseline.
-- PRECONDITION: compare pg_policies/grants from preview with the documented inventory.
-- This migration deliberately aborts if it finds an unversioned policy in scope.

do $$
declare
  unexpected_policies text;
begin
  if exists (
    select 1
    from unnest(array[
      'hotels', 'profiles', 'hotel_sections', 'hotel_departments', 'hotel_policies',
      'hotel_section_translations', 'hotel_department_translations', 'hotel_policy_translations',
      'hotel_announcements', 'hotel_announcement_translations',
      'hotel_promotional_banners', 'hotel_promotional_banner_translations'
    ]) as required_table(name)
    where to_regclass('public.' || required_table.name) is null
  ) then
    raise exception '45B preflight failed: an expected public table is missing';
  end if;

  if to_regclass('public.public_hotels') is not null then
    raise exception '45B preflight failed: public.public_hotels already exists and must be reviewed before applying';
  end if;

  if to_regprocedure('public.has_active_hotel_role(uuid,text)') is not null then
    raise exception '45B preflight failed: public.has_active_hotel_role(uuid,text) already exists and must be reviewed before applying';
  end if;

  if to_regprocedure('public.has_active_hotel_path_role(text,text)') is not null then
    raise exception '45B preflight failed: public.has_active_hotel_path_role(text,text) already exists and must be reviewed before applying';
  end if;

  select string_agg(format('%I.%I', schemaname, policyname), ', ' order by tablename, policyname)
    into unexpected_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = any (array[
      'hotels', 'profiles', 'hotel_sections', 'hotel_departments', 'hotel_policies',
      'hotel_section_translations', 'hotel_department_translations', 'hotel_policy_translations',
      'hotel_announcements', 'hotel_announcement_translations',
      'hotel_promotional_banners', 'hotel_promotional_banner_translations'
    ])
    and policyname <> all (array[
      'hotel_select_by_profile',
      'hotel_update_by_profile',
      'public_read_hotels',
      'profile_select_own',
      'profile_update_own',
      'public_read_enabled_sections',
      'sections_all_by_profile',
      'public_read_enabled_departments',
      'departments_all_by_profile',
      'public_read_enabled_policies',
      'policies_all_by_profile',
      'authenticated can delete own hotel_section_translations',
      'authenticated can insert own hotel_section_translations',
      'authenticated can update own hotel_section_translations',
      'public can read hotel_section_translations',
      'authenticated can delete own hotel_department_translations',
      'authenticated can insert own hotel_department_translations',
      'authenticated can update own hotel_department_translations',
      'public can read hotel_department_translations',
      'authenticated can delete own hotel_policy_translations',
      'authenticated can insert own hotel_policy_translations',
      'authenticated can update own hotel_policy_translations',
      'public can read hotel_policy_translations',
      'Public can read active hotel announcements',
      'Hotel users can read own announcements',
      'Hotel users can insert own announcements',
      'Hotel users can update own announcements',
      'Hotel users can delete own announcements',
      'Public can read translations for active hotel announcements',
      'Hotel users can read own announcement translations',
      'Hotel users can insert own announcement translations',
      'Hotel users can update own announcement translations',
      'Hotel users can delete own announcement translations',
      'Public can read active promotional banners',
      'Hotel users can read own promotional banners',
      'Hotel users can insert own promotional banners',
      'Hotel users can update own promotional banners',
      'Hotel users can delete own promotional banners',
      'Public can read translations for active promotional banners',
      'Hotel users can read own promotional banner translations',
      'Hotel users can insert own promotional banner translations',
      'Hotel users can update own promotional banner translations',
      'Hotel users can delete own promotional banner translations'
    ]);

  if unexpected_policies is not null then
    raise exception '45B preflight failed: review unexpected remote policies before applying: %', unexpected_policies;
  end if;
end;
$$;

create function public.has_active_hotel_role(
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
    where p.id = auth.uid()
      and p.hotel_id = target_hotel_id
      and p.is_active = true
      and case lower(trim(coalesce(p.role, '')))
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

revoke all on function public.has_active_hotel_role(uuid, text) from public, anon;
grant execute on function public.has_active_hotel_role(uuid, text) to authenticated, service_role;
comment on function public.has_active_hotel_role(uuid, text) is
  '45B RLS helper. Resolves auth.uid() server-side and never trusts a client hotel id without profile matching.';

create function public.has_active_hotel_path_role(
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
    where p.id = auth.uid()
      and p.hotel_id::text = target_hotel_id
      and p.is_active = true
      and case lower(trim(coalesce(p.role, '')))
        when 'visualizador' then 1 when 'operador' then 2 when 'editor' then 3
        when 'administrador' then 4 when 'admin' then 4 when 'owner' then 4 else 0
      end >= case required_role
        when 'visualizador' then 1 when 'operador' then 2 when 'editor' then 3
        when 'administrador' then 4 else 99
      end
  );
$$;

revoke all on function public.has_active_hotel_path_role(text, text) from public, anon;
grant execute on function public.has_active_hotel_path_role(text, text) to authenticated, service_role;
comment on function public.has_active_hotel_path_role(text, text) is
  'Storage-safe 45B helper. Compares a path segment as text and avoids casts on hostile object names.';

alter table public.hotels enable row level security;
alter table public.profiles enable row level security;
alter table public.hotel_sections enable row level security;
alter table public.hotel_departments enable row level security;
alter table public.hotel_policies enable row level security;
alter table public.hotel_section_translations enable row level security;
alter table public.hotel_department_translations enable row level security;
alter table public.hotel_policy_translations enable row level security;
alter table public.hotel_announcements enable row level security;
alter table public.hotel_announcement_translations enable row level security;
alter table public.hotel_promotional_banners enable row level security;
alter table public.hotel_promotional_banner_translations enable row level security;

drop policy if exists "hotel_select_by_profile" on public.hotels;
drop policy if exists "hotel_update_by_profile" on public.hotels;
drop policy if exists "public_read_hotels" on public.hotels;
drop policy if exists "profile_select_own" on public.profiles;
drop policy if exists "profile_update_own" on public.profiles;
drop policy if exists "public_read_enabled_sections" on public.hotel_sections;
drop policy if exists "sections_all_by_profile" on public.hotel_sections;
drop policy if exists "public_read_enabled_departments" on public.hotel_departments;
drop policy if exists "departments_all_by_profile" on public.hotel_departments;
drop policy if exists "public_read_enabled_policies" on public.hotel_policies;
drop policy if exists "policies_all_by_profile" on public.hotel_policies;
drop policy if exists "authenticated can delete own hotel_section_translations" on public.hotel_section_translations;
drop policy if exists "authenticated can insert own hotel_section_translations" on public.hotel_section_translations;
drop policy if exists "authenticated can update own hotel_section_translations" on public.hotel_section_translations;
drop policy if exists "public can read hotel_section_translations" on public.hotel_section_translations;
drop policy if exists "authenticated can delete own hotel_department_translations" on public.hotel_department_translations;
drop policy if exists "authenticated can insert own hotel_department_translations" on public.hotel_department_translations;
drop policy if exists "authenticated can update own hotel_department_translations" on public.hotel_department_translations;
drop policy if exists "public can read hotel_department_translations" on public.hotel_department_translations;
drop policy if exists "authenticated can delete own hotel_policy_translations" on public.hotel_policy_translations;
drop policy if exists "authenticated can insert own hotel_policy_translations" on public.hotel_policy_translations;
drop policy if exists "authenticated can update own hotel_policy_translations" on public.hotel_policy_translations;
drop policy if exists "public can read hotel_policy_translations" on public.hotel_policy_translations;

drop policy if exists "Public can read active hotel announcements" on public.hotel_announcements;
drop policy if exists "Hotel users can read own announcements" on public.hotel_announcements;
drop policy if exists "Hotel users can insert own announcements" on public.hotel_announcements;
drop policy if exists "Hotel users can update own announcements" on public.hotel_announcements;
drop policy if exists "Hotel users can delete own announcements" on public.hotel_announcements;
drop policy if exists "Public can read translations for active hotel announcements" on public.hotel_announcement_translations;
drop policy if exists "Hotel users can read own announcement translations" on public.hotel_announcement_translations;
drop policy if exists "Hotel users can insert own announcement translations" on public.hotel_announcement_translations;
drop policy if exists "Hotel users can update own announcement translations" on public.hotel_announcement_translations;
drop policy if exists "Hotel users can delete own announcement translations" on public.hotel_announcement_translations;
drop policy if exists "Public can read active promotional banners" on public.hotel_promotional_banners;
drop policy if exists "Hotel users can read own promotional banners" on public.hotel_promotional_banners;
drop policy if exists "Hotel users can insert own promotional banners" on public.hotel_promotional_banners;
drop policy if exists "Hotel users can update own promotional banners" on public.hotel_promotional_banners;
drop policy if exists "Hotel users can delete own promotional banners" on public.hotel_promotional_banners;
drop policy if exists "Public can read translations for active promotional banners" on public.hotel_promotional_banner_translations;
drop policy if exists "Hotel users can read own promotional banner translations" on public.hotel_promotional_banner_translations;
drop policy if exists "Hotel users can insert own promotional banner translations" on public.hotel_promotional_banner_translations;
drop policy if exists "Hotel users can update own promotional banner translations" on public.hotel_promotional_banner_translations;
drop policy if exists "Hotel users can delete own promotional banner translations" on public.hotel_promotional_banner_translations;

create policy "45b_hotel_read_own_hotel" on public.hotels
  for select to authenticated using (public.has_active_hotel_role(id, 'visualizador'));

-- RLS cannot restrict columns. Guests read an explicit projection instead of public.hotels.
-- The default security-definer view is intentional: anon has no privilege on the base table,
-- while the view owner can expose only the reviewed public contract below.
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
from public.hotels;

revoke all on table public.public_hotels from public, anon, authenticated;
grant select on table public.public_hotels to anon, authenticated;
comment on view public.public_hotels is
  'Explicit guest-facing hotel projection. Platform/admin timestamps and future private columns are not inherited automatically.';

create policy "45b_read_own_profile_or_hotel_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_active_hotel_role(hotel_id, 'administrador'));

create policy "45b_public_read_enabled_sections" on public.hotel_sections
  for select to anon, authenticated using (enabled = true);
create policy "45b_hotel_read_sections" on public.hotel_sections
  for select to authenticated using (public.has_active_hotel_role(hotel_id, 'visualizador'));
create policy "45b_operator_manage_sections" on public.hotel_sections
  for all to authenticated
  using (public.has_active_hotel_role(hotel_id, 'operador'))
  with check (public.has_active_hotel_role(hotel_id, 'operador'));

create policy "45b_public_read_enabled_departments" on public.hotel_departments
  for select to anon, authenticated using (enabled = true);
create policy "45b_hotel_read_departments" on public.hotel_departments
  for select to authenticated using (public.has_active_hotel_role(hotel_id, 'visualizador'));
create policy "45b_operator_manage_departments" on public.hotel_departments
  for all to authenticated
  using (public.has_active_hotel_role(hotel_id, 'operador'))
  with check (public.has_active_hotel_role(hotel_id, 'operador'));

create policy "45b_public_read_enabled_policies" on public.hotel_policies
  for select to anon, authenticated using (enabled = true);
create policy "45b_hotel_read_policies" on public.hotel_policies
  for select to authenticated using (public.has_active_hotel_role(hotel_id, 'visualizador'));
create policy "45b_operator_manage_policies" on public.hotel_policies
  for all to authenticated
  using (public.has_active_hotel_role(hotel_id, 'operador'))
  with check (public.has_active_hotel_role(hotel_id, 'operador'));

create policy "45b_public_read_section_translations" on public.hotel_section_translations
  for select to anon, authenticated using (exists (
    select 1 from public.hotel_sections s where s.id = section_id and s.enabled = true
  ));
create policy "45b_hotel_read_section_translations" on public.hotel_section_translations
  for select to authenticated using (exists (
    select 1 from public.hotel_sections s
    where s.id = section_id and public.has_active_hotel_role(s.hotel_id, 'visualizador')
  ));
create policy "45b_operator_manage_section_translations" on public.hotel_section_translations
  for all to authenticated
  using (exists (
    select 1 from public.hotel_sections s
    where s.id = section_id and public.has_active_hotel_role(s.hotel_id, 'operador')
  ))
  with check (exists (
    select 1 from public.hotel_sections s
    where s.id = section_id and public.has_active_hotel_role(s.hotel_id, 'operador')
  ));

create policy "45b_public_read_department_translations" on public.hotel_department_translations
  for select to anon, authenticated using (exists (
    select 1 from public.hotel_departments d where d.id = department_id and d.enabled = true
  ));
create policy "45b_hotel_read_department_translations" on public.hotel_department_translations
  for select to authenticated using (exists (
    select 1 from public.hotel_departments d
    where d.id = department_id and public.has_active_hotel_role(d.hotel_id, 'visualizador')
  ));
create policy "45b_operator_manage_department_translations" on public.hotel_department_translations
  for all to authenticated
  using (exists (
    select 1 from public.hotel_departments d
    where d.id = department_id and public.has_active_hotel_role(d.hotel_id, 'operador')
  ))
  with check (exists (
    select 1 from public.hotel_departments d
    where d.id = department_id and public.has_active_hotel_role(d.hotel_id, 'operador')
  ));

create policy "45b_public_read_policy_translations" on public.hotel_policy_translations
  for select to anon, authenticated using (exists (
    select 1 from public.hotel_policies p where p.id = policy_id and p.enabled = true
  ));
create policy "45b_hotel_read_policy_translations" on public.hotel_policy_translations
  for select to authenticated using (exists (
    select 1 from public.hotel_policies p
    where p.id = policy_id and public.has_active_hotel_role(p.hotel_id, 'visualizador')
  ));
create policy "45b_operator_manage_policy_translations" on public.hotel_policy_translations
  for all to authenticated
  using (exists (
    select 1 from public.hotel_policies p
    where p.id = policy_id and public.has_active_hotel_role(p.hotel_id, 'operador')
  ))
  with check (exists (
    select 1 from public.hotel_policies p
    where p.id = policy_id and public.has_active_hotel_role(p.hotel_id, 'operador')
  ));

create policy "45b_public_read_active_announcements" on public.hotel_announcements
  for select to anon, authenticated using (
    is_active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())
  );
create policy "45b_hotel_read_announcements" on public.hotel_announcements
  for select to authenticated using (public.has_active_hotel_role(hotel_id, 'visualizador'));
create policy "45b_operator_manage_announcements" on public.hotel_announcements
  for all to authenticated
  using (public.has_active_hotel_role(hotel_id, 'operador'))
  with check (public.has_active_hotel_role(hotel_id, 'operador'));

create policy "45b_public_read_announcement_translations" on public.hotel_announcement_translations
  for select to anon, authenticated using (exists (
    select 1 from public.hotel_announcements a
    where a.id = announcement_id and a.is_active = true
      and (a.starts_at is null or a.starts_at <= now()) and (a.ends_at is null or a.ends_at >= now())
  ));
create policy "45b_hotel_read_announcement_translations" on public.hotel_announcement_translations
  for select to authenticated using (exists (
    select 1 from public.hotel_announcements a
    where a.id = announcement_id and public.has_active_hotel_role(a.hotel_id, 'visualizador')
  ));
create policy "45b_operator_manage_announcement_translations" on public.hotel_announcement_translations
  for all to authenticated
  using (exists (
    select 1 from public.hotel_announcements a
    where a.id = announcement_id and public.has_active_hotel_role(a.hotel_id, 'operador')
  ))
  with check (exists (
    select 1 from public.hotel_announcements a
    where a.id = announcement_id and public.has_active_hotel_role(a.hotel_id, 'operador')
  ));

create policy "45b_public_read_active_banners" on public.hotel_promotional_banners
  for select to anon, authenticated using (
    is_active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())
  );
create policy "45b_hotel_read_banners" on public.hotel_promotional_banners
  for select to authenticated using (public.has_active_hotel_role(hotel_id, 'visualizador'));
create policy "45b_operator_manage_banners" on public.hotel_promotional_banners
  for all to authenticated
  using (public.has_active_hotel_role(hotel_id, 'operador'))
  with check (public.has_active_hotel_role(hotel_id, 'operador'));

create policy "45b_public_read_banner_translations" on public.hotel_promotional_banner_translations
  for select to anon, authenticated using (exists (
    select 1 from public.hotel_promotional_banners b
    where b.id = banner_id and b.is_active = true
      and (b.starts_at is null or b.starts_at <= now()) and (b.ends_at is null or b.ends_at >= now())
  ));
create policy "45b_hotel_read_banner_translations" on public.hotel_promotional_banner_translations
  for select to authenticated using (exists (
    select 1 from public.hotel_promotional_banners b
    where b.id = banner_id and public.has_active_hotel_role(b.hotel_id, 'visualizador')
  ));
create policy "45b_operator_manage_banner_translations" on public.hotel_promotional_banner_translations
  for all to authenticated
  using (exists (
    select 1 from public.hotel_promotional_banners b
    where b.id = banner_id and public.has_active_hotel_role(b.hotel_id, 'operador')
  ))
  with check (exists (
    select 1 from public.hotel_promotional_banners b
    where b.id = banner_id and public.has_active_hotel_role(b.hotel_id, 'operador')
  ));

revoke all on table
  public.hotels, public.profiles, public.hotel_sections, public.hotel_departments,
  public.hotel_policies, public.hotel_section_translations, public.hotel_department_translations,
  public.hotel_policy_translations, public.hotel_announcements, public.hotel_announcement_translations,
  public.hotel_promotional_banners, public.hotel_promotional_banner_translations
from anon, authenticated;

grant select on table
  public.hotel_sections, public.hotel_departments, public.hotel_policies,
  public.hotel_section_translations, public.hotel_department_translations, public.hotel_policy_translations,
  public.hotel_announcements, public.hotel_announcement_translations,
  public.hotel_promotional_banners, public.hotel_promotional_banner_translations
to anon;

grant select on table
  public.hotels, public.profiles, public.hotel_sections, public.hotel_departments, public.hotel_policies,
  public.hotel_section_translations, public.hotel_department_translations, public.hotel_policy_translations,
  public.hotel_announcements, public.hotel_announcement_translations,
  public.hotel_promotional_banners, public.hotel_promotional_banner_translations
to authenticated;

-- Hotel changes are server-only through validated editor actions using service_role. No UPDATE
-- privilege or policy is granted to anon/authenticated, so brand_code, slug and future platform
-- columns cannot be mutated directly from a browser.

grant insert (
  hotel_id, title, icon, content, cta, url, category, service_action_type, enabled, sort_order
) on table public.hotel_sections to authenticated;
grant update (
  title, icon, content, cta, url, category, service_action_type, enabled, sort_order
) on table public.hotel_sections to authenticated;
grant delete on table public.hotel_sections to authenticated;

grant insert (hotel_id, name, description, hours, action, url, enabled)
  on table public.hotel_departments to authenticated;
grant update (name, description, hours, action, url, enabled)
  on table public.hotel_departments to authenticated;
grant delete on table public.hotel_departments to authenticated;

grant insert (hotel_id, title, description, enabled)
  on table public.hotel_policies to authenticated;
grant update (title, description, enabled)
  on table public.hotel_policies to authenticated;
grant delete on table public.hotel_policies to authenticated;

grant insert (section_id, language, title, content, cta, category, updated_at)
  on table public.hotel_section_translations to authenticated;
grant update (section_id, language, title, content, cta, category, updated_at)
  on table public.hotel_section_translations to authenticated;

grant insert (department_id, language, name, description, action, updated_at)
  on table public.hotel_department_translations to authenticated;
grant update (department_id, language, name, description, action, updated_at)
  on table public.hotel_department_translations to authenticated;

grant insert (policy_id, language, title, description, updated_at)
  on table public.hotel_policy_translations to authenticated;
grant update (policy_id, language, title, description, updated_at)
  on table public.hotel_policy_translations to authenticated;

grant insert (hotel_id, title, body, category, starts_at, ends_at, is_active)
  on table public.hotel_announcements to authenticated;
grant update (title, body, category, starts_at, ends_at, is_active, updated_at)
  on table public.hotel_announcements to authenticated;
grant delete on table public.hotel_announcements to authenticated;

grant insert (announcement_id, language, title, body, updated_at)
  on table public.hotel_announcement_translations to authenticated;
grant update (announcement_id, language, title, body, updated_at)
  on table public.hotel_announcement_translations to authenticated;

grant insert (
  hotel_id, title, subtitle, image_url, cta_label, cta_url,
  starts_at, ends_at, is_active, display_order
) on table public.hotel_promotional_banners to authenticated;
grant update (
  title, subtitle, image_url, cta_label, cta_url,
  starts_at, ends_at, is_active, display_order, updated_at
) on table public.hotel_promotional_banners to authenticated;
grant delete on table public.hotel_promotional_banners to authenticated;

grant insert (banner_id, language, title, subtitle, cta_label, updated_at)
  on table public.hotel_promotional_banner_translations to authenticated;
grant update (banner_id, language, title, subtitle, cta_label, updated_at)
  on table public.hotel_promotional_banner_translations to authenticated;
