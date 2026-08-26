-- Sprint 51, stage 4: minimal anonymous projection for the public Flight Center.

do $$
begin
  if to_regclass('public.public_hotels') is null
    or to_regclass('public.airports') is null
    or to_regclass('public.hotel_airports') is null
    or to_regclass('public.hotel_flight_settings') is null
    or to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is null
    or to_regprocedure('public.get_public_hotel_flight_center(uuid)') is not null then
    raise exception '51 public flight center preflight failed';
  end if;

  if pg_catalog.pg_get_viewdef('public.public_hotels'::regclass,true) !~* 'platform_status.*active'
    or pg_catalog.pg_get_viewdef('public.public_hotels'::regclass,true) !~* 'core\.directory' then
    raise exception '51 public flight center preflight failed: public hotel contract drifted';
  end if;
end;
$$;

create function public.get_public_hotel_flight_center(p_hotel_id uuid)
returns table(
  airport_iata_code text,
  airport_name text,
  airport_city text,
  official_departures_url text,
  official_arrivals_url text,
  estimated_transfer_minutes smallint,
  domestic_lead_minutes smallint,
  international_lead_minutes smallint,
  safety_margin_minutes smallint,
  departure_planning_enabled boolean,
  transfer_enabled boolean,
  wake_up_enabled boolean,
  breakfast_box_enabled boolean,
  reception_enabled boolean,
  official_links_enabled boolean,
  departure_notice text
)
language sql stable security definer set search_path=''
as $$
  select
    a.iata_code as airport_iata_code,
    a.name as airport_name,
    a.city as airport_city,
    case when s.official_links_enabled then a.official_departures_url else null end,
    case when s.official_links_enabled then a.official_arrivals_url else null end,
    case when s.departure_planning_enabled then ha.estimated_transfer_minutes else null end,
    case when s.departure_planning_enabled then ha.domestic_lead_minutes else null end,
    case when s.departure_planning_enabled then ha.international_lead_minutes else null end,
    case when s.departure_planning_enabled then ha.safety_margin_minutes else null end,
    s.departure_planning_enabled,
    s.transfer_enabled,
    s.wake_up_enabled,
    s.breakfast_box_enabled,
    s.reception_enabled,
    s.official_links_enabled,
    s.departure_notice
  from public.public_hotels h
  join public.hotel_flight_settings s on s.hotel_id=h.id
  join public.hotel_airports ha on ha.hotel_id=h.id and ha.is_active
  join public.airports a on a.id=ha.airport_id and a.is_active
  where h.id=p_hotel_id
    and public.is_hotel_module_enabled(h.id,'travel.flights')
  order by ha.sort_order,a.iata_code;
$$;

revoke all on function public.get_public_hotel_flight_center(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.get_public_hotel_flight_center(uuid) to anon,authenticated;

comment on function public.get_public_hotel_flight_center(uuid) is
  'Minimal public Flight Center projection for one active, entitled hotel.';

do $$
begin
  if has_table_privilege('anon','public.airports','SELECT')
    or has_table_privilege('anon','public.hotel_airports','SELECT')
    or has_table_privilege('anon','public.hotel_flight_settings','SELECT') then
    raise exception '51 public flight center verification failed: direct anonymous table access detected';
  end if;
end;
$$;
