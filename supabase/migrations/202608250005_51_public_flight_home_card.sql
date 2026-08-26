-- Sprint 51, stage 5: narrow public projection for the Flight Center home card.

do $$
begin
  if to_regclass('public.public_hotels') is null
    or to_regclass('public.airports') is null
    or to_regclass('public.hotel_airports') is null
    or to_regclass('public.hotel_flight_settings') is null
    or to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is null
    or to_regprocedure('public.get_public_hotel_flight_center(uuid)') is null
    or to_regprocedure('public.get_public_hotel_flight_home_card(uuid)') is not null then
    raise exception '51 public flight home card preflight failed';
  end if;
end;
$$;

create function public.get_public_hotel_flight_home_card(p_hotel_id uuid)
returns table(
  home_card_title text,
  home_card_description text
)
language sql stable security definer set search_path=''
as $$
  select
    nullif(pg_catalog.btrim(s.home_card_title),'') as home_card_title,
    nullif(pg_catalog.btrim(s.home_card_description),'') as home_card_description
  from public.public_hotels h
  join public.hotel_flight_settings s on s.hotel_id=h.id
  where h.id=p_hotel_id
    and s.home_card_enabled
    and public.is_hotel_module_enabled(h.id,'travel.flights')
    and exists(
      select 1
      from public.hotel_airports ha
      join public.airports a on a.id=ha.airport_id and a.is_active
      where ha.hotel_id=h.id and ha.is_active
    );
$$;

revoke all on function public.get_public_hotel_flight_home_card(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.get_public_hotel_flight_home_card(uuid) to anon,authenticated;

comment on function public.get_public_hotel_flight_home_card(uuid) is
  'Minimal public home-card projection for an operational, entitled Flight Center.';

do $$
begin
  if has_table_privilege('anon','public.airports','SELECT')
    or has_table_privilege('anon','public.hotel_airports','SELECT')
    or has_table_privilege('anon','public.hotel_flight_settings','SELECT') then
    raise exception '51 public flight home card verification failed: direct anonymous table access detected';
  end if;
end;
$$;
