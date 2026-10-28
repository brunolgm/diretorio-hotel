-- Shared readiness: published, tenant-owned V3 hero or the existing legacy hero.
-- Preparation may remain suspended; public lifecycle/RLS gates are unchanged.
-- No data writes. A future migration can restore the previous evaluator without data loss.
begin;
create or replace function public.calculate_hotel_readiness(p_hotel_id uuid)
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
    ('visual.hero','warning',nullif(pg_catalog.btrim(hotel_row.hero_image_url),'') is not null
      or (core_enabled and public.is_hotel_module_enabled(p_hotel_id,'experience.appearance')
        and exists(select 1 from public.hotel_public_experience_media m
          where m.hotel_id=p_hotel_id and m.slot='hero' and m.is_published
            and nullif(pg_catalog.btrim(m.title),'') is not null
            and nullif(pg_catalog.btrim(m.alt_text),'') is not null
            and m.image_path ~ ('^'||p_hotel_id::text||'/hero/hero/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'))));

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


commit;
