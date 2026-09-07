-- Disposable/local database only. Every synthetic change rolls back.
-- Caller owns the transaction.

do $$ begin
  if to_regprocedure('public.get_public_hotel_flight_center(uuid)') is null then
    raise exception '51 public flight center behavior: migration missing';
  end if;
  if exists(select 1 from public.hotels where slug like 's51c-%')
    or exists(select 1 from public.airports where iata_code like 'QX%') then
    raise exception '51 public flight center behavior: fixture collision';
  end if;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
  ('51900000-0000-4000-8000-000000000001','S51C Hotel A','Rio de Janeiro','s51c-hotel-a','s51ca','active'),
  ('51900000-0000-4000-8000-000000000002','S51C Hotel B','São Paulo','s51c-hotel-b','s51cb','active'),
  ('51900000-0000-4000-8000-000000000003','S51C Hotel No Module','Recife','s51c-hotel-c','s51cc','active'),
  ('51900000-0000-4000-8000-000000000004','S51C Hotel No Airport','Salvador','s51c-hotel-d','s51cd','active');

insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) values
  ('51900000-0000-4000-8000-000000000001','core.directory',true,now()),
  ('51900000-0000-4000-8000-000000000001','travel.flights',true,now()),
  ('51900000-0000-4000-8000-000000000002','core.directory',true,now()),
  ('51900000-0000-4000-8000-000000000002','travel.flights',true,now()),
  ('51900000-0000-4000-8000-000000000003','core.directory',true,now()),
  ('51900000-0000-4000-8000-000000000004','core.directory',true,now()),
  ('51900000-0000-4000-8000-000000000004','travel.flights',true,now());

insert into public.airports(
  id,iata_code,icao_code,name,city,country_code,timezone,latitude,longitude,
  official_departures_url,official_arrivals_url,is_active
) values
  ('51930000-0000-4000-8000-000000000001','QXA','SBR1','S51C Linked Airport','Rio de Janeiro','BR','America/Sao_Paulo',-22.8,-43.2,'https://airport-a.invalid/departures','https://airport-a.invalid/arrivals',true),
  ('51930000-0000-4000-8000-000000000002','QXB','SBR2','S51C Paused Association','Rio de Janeiro','BR','America/Sao_Paulo',-22.9,-43.3,'https://airport-paused.invalid/departures','https://airport-paused.invalid/arrivals',true),
  ('51930000-0000-4000-8000-000000000003','QXC','SBR3','S51C Inactive Airport','Rio de Janeiro','BR','America/Sao_Paulo',-23.0,-43.4,'https://airport-inactive.invalid/departures','https://airport-inactive.invalid/arrivals',false),
  ('51930000-0000-4000-8000-000000000004','QXD','SBR4','S51C Other Hotel Airport','São Paulo','BR','America/Sao_Paulo',-23.5,-46.6,'https://airport-b.invalid/departures','https://airport-b.invalid/arrivals',true);

insert into public.hotel_flight_settings(
  hotel_id,transfer_enabled,wake_up_enabled,breakfast_box_enabled,reception_enabled,
  official_links_enabled,departure_planning_enabled,departure_notice
) values
  ('51900000-0000-4000-8000-000000000001',true,false,true,false,true,true,'S51C planning notice'),
  ('51900000-0000-4000-8000-000000000002',false,true,false,true,true,false,null),
  ('51900000-0000-4000-8000-000000000003',true,true,true,true,true,true,'Must remain private'),
  ('51900000-0000-4000-8000-000000000004',true,true,true,true,true,true,'No active airport');

insert into public.hotel_airports(
  hotel_id,airport_id,sort_order,is_active,estimated_transfer_minutes,
  domestic_lead_minutes,international_lead_minutes,safety_margin_minutes
) values
  ('51900000-0000-4000-8000-000000000001','51930000-0000-4000-8000-000000000001',1,true,35,120,180,20),
  ('51900000-0000-4000-8000-000000000001','51930000-0000-4000-8000-000000000002',2,false,25,90,150,15),
  ('51900000-0000-4000-8000-000000000001','51930000-0000-4000-8000-000000000003',3,true,45,120,180,30),
  ('51900000-0000-4000-8000-000000000002','51930000-0000-4000-8000-000000000004',1,true,40,120,180,20),
  ('51900000-0000-4000-8000-000000000003','51930000-0000-4000-8000-000000000001',1,true,30,120,180,20);
