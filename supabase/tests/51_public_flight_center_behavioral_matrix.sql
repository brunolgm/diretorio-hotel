-- Disposable/local database only. Every synthetic change rolls back.
begin;

do $$ begin
  if to_regprocedure('public.get_public_hotel_flight_center(uuid)') is null then
    raise exception '51 public flight center behavior: migration missing';
  end if;
  if exists(select 1 from public.hotels where slug like 's51p-%')
    or exists(select 1 from public.airports where iata_code like 'QR%') then
    raise exception '51 public flight center behavior: fixture collision';
  end if;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
  ('51400000-0000-4000-8000-000000000001','S51P Hotel A','Rio de Janeiro','s51p-hotel-a','s51pa','active'),
  ('51400000-0000-4000-8000-000000000002','S51P Hotel B','São Paulo','s51p-hotel-b','s51pb','active'),
  ('51400000-0000-4000-8000-000000000003','S51P Hotel No Module','Recife','s51p-hotel-c','s51pc','active'),
  ('51400000-0000-4000-8000-000000000004','S51P Hotel No Airport','Salvador','s51p-hotel-d','s51pd','active');

insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) values
  ('51400000-0000-4000-8000-000000000001','core.directory',true,now()),
  ('51400000-0000-4000-8000-000000000001','travel.flights',true,now()),
  ('51400000-0000-4000-8000-000000000002','core.directory',true,now()),
  ('51400000-0000-4000-8000-000000000002','travel.flights',true,now()),
  ('51400000-0000-4000-8000-000000000003','core.directory',true,now()),
  ('51400000-0000-4000-8000-000000000004','core.directory',true,now()),
  ('51400000-0000-4000-8000-000000000004','travel.flights',true,now());

insert into public.airports(
  id,iata_code,icao_code,name,city,country_code,timezone,latitude,longitude,
  official_departures_url,official_arrivals_url,is_active
) values
  ('51430000-0000-4000-8000-000000000001','QRA','SBR1','S51P Linked Airport','Rio de Janeiro','BR','America/Sao_Paulo',-22.8,-43.2,'https://airport-a.invalid/departures','https://airport-a.invalid/arrivals',true),
  ('51430000-0000-4000-8000-000000000002','QRB','SBR2','S51P Paused Association','Rio de Janeiro','BR','America/Sao_Paulo',-22.9,-43.3,'https://airport-paused.invalid/departures','https://airport-paused.invalid/arrivals',true),
  ('51430000-0000-4000-8000-000000000003','QRC','SBR3','S51P Inactive Airport','Rio de Janeiro','BR','America/Sao_Paulo',-23.0,-43.4,'https://airport-inactive.invalid/departures','https://airport-inactive.invalid/arrivals',false),
  ('51430000-0000-4000-8000-000000000004','QRD','SBR4','S51P Other Hotel Airport','São Paulo','BR','America/Sao_Paulo',-23.5,-46.6,'https://airport-b.invalid/departures','https://airport-b.invalid/arrivals',true);

insert into public.hotel_flight_settings(
  hotel_id,transfer_enabled,wake_up_enabled,breakfast_box_enabled,reception_enabled,
  official_links_enabled,departure_planning_enabled,departure_notice
) values
  ('51400000-0000-4000-8000-000000000001',true,false,true,false,true,true,'S51P planning notice'),
  ('51400000-0000-4000-8000-000000000002',false,true,false,true,true,false,null),
  ('51400000-0000-4000-8000-000000000003',true,true,true,true,true,true,'Must remain private'),
  ('51400000-0000-4000-8000-000000000004',true,true,true,true,true,true,'No active airport');

insert into public.hotel_airports(
  hotel_id,airport_id,sort_order,is_active,estimated_transfer_minutes,
  domestic_lead_minutes,international_lead_minutes,safety_margin_minutes
) values
  ('51400000-0000-4000-8000-000000000001','51430000-0000-4000-8000-000000000001',1,true,35,120,180,20),
  ('51400000-0000-4000-8000-000000000001','51430000-0000-4000-8000-000000000002',2,false,25,90,150,15),
  ('51400000-0000-4000-8000-000000000001','51430000-0000-4000-8000-000000000003',3,true,45,120,180,30),
  ('51400000-0000-4000-8000-000000000002','51430000-0000-4000-8000-000000000004',1,true,40,120,180,20),
  ('51400000-0000-4000-8000-000000000003','51430000-0000-4000-8000-000000000001',1,true,30,120,180,20);

set local role anon;

do $$ declare row_count integer; projected record; begin
  select count(*) into row_count
  from public.get_public_hotel_flight_center('51400000-0000-4000-8000-000000000001');
  if row_count<>1 then
    raise exception '51 public flight center behavior: inactive, unlinked or foreign airport leaked';
  end if;

  select * into projected
  from public.get_public_hotel_flight_center('51400000-0000-4000-8000-000000000001');
  if projected.airport_iata_code<>'QRA'
    or projected.official_departures_url<>'https://airport-a.invalid/departures'
    or projected.official_arrivals_url<>'https://airport-a.invalid/arrivals'
    or projected.estimated_transfer_minutes<>35
    or not projected.transfer_enabled
    or projected.wake_up_enabled
    or not projected.breakfast_box_enabled
    or projected.reception_enabled then
    raise exception '51 public flight center behavior: minimal projection or flags invalid';
  end if;

  if exists(select 1 from public.get_public_hotel_flight_center('51400000-0000-4000-8000-000000000003')) then
    raise exception '51 public flight center behavior: hotel without travel.flights accessed center';
  end if;
  if exists(select 1 from public.get_public_hotel_flight_center('51400000-0000-4000-8000-000000000004')) then
    raise exception '51 public flight center behavior: hotel without active airport accessed center';
  end if;

  begin perform * from public.airports; raise exception '51 public flight center behavior: anon read airports'; exception when insufficient_privilege then null; end;
  begin perform * from public.hotel_airports; raise exception '51 public flight center behavior: anon read hotel_airports'; exception when insufficient_privilege then null; end;
  begin perform * from public.hotel_flight_settings; raise exception '51 public flight center behavior: anon read hotel_flight_settings'; exception when insufficient_privilege then null; end;
end $$;

rollback;
