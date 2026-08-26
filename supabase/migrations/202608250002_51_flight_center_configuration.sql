-- Sprint 51, stage 2: hotel-scoped administrative configuration for the Flight Center.
-- No public projection, operational backfill or airline catalog is introduced here.

do $$
declare
  onboarding_fn text;
begin
  if to_regclass('public.airports') is not null
    or to_regclass('public.hotel_airports') is not null
    or to_regclass('public.hotel_flight_settings') is not null then
    raise exception '51 configuration preflight failed: a target table already exists';
  end if;

  if to_regclass('public.hotels') is null
    or to_regclass('public.profiles') is null
    or to_regclass('public.hotel_module_entitlements') is null
    or to_regprocedure('public.has_active_hotel_role(uuid,text)') is null
    or to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is null
    or to_regprocedure('public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)') is null
    or to_regprocedure('public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)') is null then
    raise exception '51 configuration preflight failed: required authorization contracts are missing';
  end if;

  if pg_catalog.pg_get_functiondef(
      'public.is_hotel_module_enabled(uuid,text)'::regprocedure
    ) !~* 'travel\.flights'
    or not exists (
      select 1 from pg_catalog.pg_constraint c
      where c.conrelid='public.hotel_module_entitlements'::regclass
        and c.conname='hotel_module_entitlements_module_key_check'
        and pg_catalog.pg_get_constraintdef(c.oid) ~* 'travel\.flights'
    ) then
    raise exception '51 configuration preflight failed: travel.flights entitlement is missing';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.create_platform_hotel_onboarding(text,text,text,text,text,text,uuid,text,text)'::regprocedure
  ) into onboarding_fn;
  if onboarding_fn !~* '''baseline_modules'',[[:space:]]*12'
    or onboarding_fn ~* 'travel\.flights' then
    raise exception '51 configuration preflight failed: onboarding baseline drifted';
  end if;
end;
$$;

create table public.airports (
  id uuid primary key default gen_random_uuid(),
  iata_code text not null,
  icao_code text null,
  name text not null,
  city text not null,
  country_code text not null,
  timezone text not null,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  official_departures_url text null,
  official_arrivals_url text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint airports_iata_code_key unique(iata_code),
  constraint airports_icao_code_key unique(icao_code),
  constraint airports_iata_code_check check(iata_code ~ '^[A-Z]{3}$'),
  constraint airports_icao_code_check check(icao_code is null or icao_code ~ '^[A-Z0-9]{4}$'),
  constraint airports_name_check check(char_length(pg_catalog.btrim(name)) between 2 and 160),
  constraint airports_city_check check(char_length(pg_catalog.btrim(city)) between 2 and 120),
  constraint airports_country_code_check check(country_code ~ '^[A-Z]{2}$'),
  constraint airports_timezone_check check(
    timezone='UTC' or timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+.-]+)+$'
  ),
  constraint airports_latitude_check check(latitude between -90 and 90),
  constraint airports_longitude_check check(longitude between -180 and 180),
  constraint airports_departures_url_check check(
    official_departures_url is null or official_departures_url ~ '^https://[^[:space:]]+$'
  ),
  constraint airports_arrivals_url_check check(
    official_arrivals_url is null or official_arrivals_url ~ '^https://[^[:space:]]+$'
  )
);

create table public.hotel_airports (
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  airport_id uuid not null references public.airports(id) on delete restrict,
  sort_order smallint not null,
  is_active boolean not null default true,
  estimated_transfer_minutes smallint null,
  domestic_lead_minutes smallint null,
  international_lead_minutes smallint null,
  safety_margin_minutes smallint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_airports_pkey primary key(hotel_id,airport_id),
  constraint hotel_airports_sort_order_key unique(hotel_id,sort_order) deferrable initially deferred,
  constraint hotel_airports_sort_order_check check(sort_order between 1 and 20),
  constraint hotel_airports_transfer_minutes_check check(
    estimated_transfer_minutes is null or estimated_transfer_minutes between 0 and 1440
  ),
  constraint hotel_airports_domestic_lead_check check(
    domestic_lead_minutes is null or domestic_lead_minutes between 0 and 2880
  ),
  constraint hotel_airports_international_lead_check check(
    international_lead_minutes is null or international_lead_minutes between 0 and 2880
  ),
  constraint hotel_airports_safety_margin_check check(
    safety_margin_minutes is null or safety_margin_minutes between 0 and 720
  )
);

create index hotel_airports_airport_id_idx on public.hotel_airports(airport_id);

create table public.hotel_flight_settings (
  hotel_id uuid primary key references public.hotels(id) on delete cascade,
  home_card_enabled boolean not null default false,
  transfer_enabled boolean not null default false,
  wake_up_enabled boolean not null default false,
  breakfast_box_enabled boolean not null default false,
  reception_enabled boolean not null default false,
  official_links_enabled boolean not null default false,
  departure_planning_enabled boolean not null default false,
  home_card_title text null,
  home_card_description text null,
  departure_notice text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_flight_settings_home_title_check check(
    home_card_title is null or char_length(pg_catalog.btrim(home_card_title)) between 1 and 120
  ),
  constraint hotel_flight_settings_home_description_check check(
    home_card_description is null or char_length(pg_catalog.btrim(home_card_description)) between 1 and 280
  ),
  constraint hotel_flight_settings_departure_notice_check check(
    departure_notice is null or char_length(pg_catalog.btrim(departure_notice)) between 1 and 500
  )
);

alter table public.airports enable row level security;
alter table public.hotel_airports enable row level security;
alter table public.hotel_flight_settings enable row level security;

revoke all on table public.airports from public,anon,authenticated,service_role;
revoke all on table public.hotel_airports from public,anon,authenticated,service_role;
revoke all on table public.hotel_flight_settings from public,anon,authenticated,service_role;

-- Global catalog writes stay server-only. A future Platform action must authorize the
-- platform actor and record the mutation in the existing platform audit log.
grant select,insert,update on table public.airports to service_role;

-- Hotel staff may read only active catalog entries when their hotel owns the module.
create policy "51_hotel_read_active_airports" on public.airports
for select to authenticated using(
  is_active
  and exists(
    select 1 from public.profiles p
    where p.id=auth.uid()
      and public.has_active_hotel_role(p.hotel_id,'visualizador')
      and public.is_hotel_module_enabled(p.hotel_id,'travel.flights')
  )
);
grant select on table public.airports to authenticated;

create policy "51_hotel_read_own_airports" on public.hotel_airports
for select to authenticated using(
  public.has_active_hotel_role(hotel_id,'visualizador')
  and public.is_hotel_module_enabled(hotel_id,'travel.flights')
);
create policy "51_editor_insert_own_airports" on public.hotel_airports
for insert to authenticated with check(
  public.has_active_hotel_role(hotel_id,'editor')
  and public.is_hotel_module_enabled(hotel_id,'travel.flights')
  and exists(select 1 from public.airports a where a.id=airport_id and a.is_active)
);
create policy "51_editor_update_own_airports" on public.hotel_airports
for update to authenticated using(
  public.has_active_hotel_role(hotel_id,'editor')
  and public.is_hotel_module_enabled(hotel_id,'travel.flights')
) with check(
  public.has_active_hotel_role(hotel_id,'editor')
  and public.is_hotel_module_enabled(hotel_id,'travel.flights')
  and exists(select 1 from public.airports a where a.id=airport_id and a.is_active)
);
create policy "51_editor_delete_own_airports" on public.hotel_airports
for delete to authenticated using(
  public.has_active_hotel_role(hotel_id,'editor')
  and public.is_hotel_module_enabled(hotel_id,'travel.flights')
);

grant select on table public.hotel_airports to authenticated;
grant insert(
  hotel_id,airport_id,sort_order,is_active,estimated_transfer_minutes,
  domestic_lead_minutes,international_lead_minutes,safety_margin_minutes
) on table public.hotel_airports to authenticated;
grant update(
  sort_order,is_active,estimated_transfer_minutes,domestic_lead_minutes,
  international_lead_minutes,safety_margin_minutes,updated_at
) on table public.hotel_airports to authenticated;
grant delete on table public.hotel_airports to authenticated;

create policy "51_hotel_read_own_flight_settings" on public.hotel_flight_settings
for select to authenticated using(
  public.has_active_hotel_role(hotel_id,'visualizador')
  and public.is_hotel_module_enabled(hotel_id,'travel.flights')
);
create policy "51_editor_insert_own_flight_settings" on public.hotel_flight_settings
for insert to authenticated with check(
  public.has_active_hotel_role(hotel_id,'editor')
  and public.is_hotel_module_enabled(hotel_id,'travel.flights')
);
create policy "51_editor_update_own_flight_settings" on public.hotel_flight_settings
for update to authenticated using(
  public.has_active_hotel_role(hotel_id,'editor')
  and public.is_hotel_module_enabled(hotel_id,'travel.flights')
) with check(
  public.has_active_hotel_role(hotel_id,'editor')
  and public.is_hotel_module_enabled(hotel_id,'travel.flights')
);
create policy "51_editor_delete_own_flight_settings" on public.hotel_flight_settings
for delete to authenticated using(
  public.has_active_hotel_role(hotel_id,'editor')
  and public.is_hotel_module_enabled(hotel_id,'travel.flights')
);

grant select on table public.hotel_flight_settings to authenticated;
grant insert(
  hotel_id,home_card_enabled,transfer_enabled,wake_up_enabled,breakfast_box_enabled,
  reception_enabled,official_links_enabled,departure_planning_enabled,
  home_card_title,home_card_description,departure_notice
) on table public.hotel_flight_settings to authenticated;
grant update(
  home_card_enabled,transfer_enabled,wake_up_enabled,breakfast_box_enabled,
  reception_enabled,official_links_enabled,departure_planning_enabled,
  home_card_title,home_card_description,departure_notice,updated_at
) on table public.hotel_flight_settings to authenticated;
grant delete on table public.hotel_flight_settings to authenticated;

-- Server-side maintenance and tests may use service_role; browser roles remain RLS-bound.
grant select,insert,update,delete on table public.hotel_airports to service_role;
grant select,insert,update,delete on table public.hotel_flight_settings to service_role;

comment on table public.airports is
  'Global server-controlled airport catalog. No anonymous access and no hotel-scoped writes.';
comment on table public.hotel_airports is
  'Hotel-scoped ordered airport configuration gated by the travel.flights entitlement.';
comment on table public.hotel_flight_settings is
  'Hotel-scoped Flight Center behavior. Settings never grant the travel.flights entitlement.';

do $$
begin
  if exists(
      select 1 from pg_catalog.pg_policies p
      where p.schemaname='public'
        and p.tablename in('airports','hotel_airports','hotel_flight_settings')
        and 'anon'=any(p.roles)
    )
    or has_table_privilege('anon','public.airports','SELECT')
    or has_table_privilege('anon','public.hotel_airports','SELECT')
    or has_table_privilege('anon','public.hotel_flight_settings','SELECT') then
    raise exception '51 configuration verification failed: anonymous access was exposed';
  end if;

  if exists(select 1 from public.airports)
    or exists(select 1 from public.hotel_airports)
    or exists(select 1 from public.hotel_flight_settings) then
    raise exception '51 configuration verification failed: migration inserted operational data';
  end if;

  if not exists(
      select 1 from pg_catalog.pg_class c
      where c.oid='public.airports'::regclass and c.relrowsecurity
    )
    or not exists(
      select 1 from pg_catalog.pg_class c
      where c.oid='public.hotel_airports'::regclass and c.relrowsecurity
    )
    or not exists(
      select 1 from pg_catalog.pg_class c
      where c.oid='public.hotel_flight_settings'::regclass and c.relrowsecurity
    ) then
    raise exception '51 configuration verification failed: RLS is not enabled';
  end if;
end;
$$;
