-- Disposable/local database only. Every synthetic change rolls back.
begin;

do $$ begin
  if to_regprocedure('public.get_public_hotel_flight_home_card(uuid)') is null then
    raise exception '51 public flight home card behavior: migration missing';
  end if;
  if exists(select 1 from public.hotels where slug like 's51h-%')
    or exists(select 1 from public.airports where iata_code like 'QH%') then
    raise exception '51 public flight home card behavior: fixture collision';
  end if;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
  ('51500000-0000-4000-8000-000000000001','S51H Visible','Rio de Janeiro','s51h-visible','s51hvisible','active'),
  ('51500000-0000-4000-8000-000000000002','S51H Card Disabled','São Paulo','s51h-disabled','s51hdisabled','active'),
  ('51500000-0000-4000-8000-000000000003','S51H No Entitlement','Recife','s51h-no-entitlement','s51hnoentitlement','active'),
  ('51500000-0000-4000-8000-000000000004','S51H No Airport','Salvador','s51h-no-airport','s51hnoairport','active');

insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) values
  ('51500000-0000-4000-8000-000000000001','core.directory',true,now()),
  ('51500000-0000-4000-8000-000000000001','travel.flights',true,now()),
  ('51500000-0000-4000-8000-000000000002','core.directory',true,now()),
  ('51500000-0000-4000-8000-000000000002','travel.flights',true,now()),
  ('51500000-0000-4000-8000-000000000003','core.directory',true,now()),
  ('51500000-0000-4000-8000-000000000004','core.directory',true,now()),
  ('51500000-0000-4000-8000-000000000004','travel.flights',true,now());

insert into public.airports(
  id,iata_code,icao_code,name,city,country_code,timezone,latitude,longitude,is_active
) values
  ('51530000-0000-4000-8000-000000000001','QHA','SH01','S51H Operational Airport','Rio de Janeiro','BR','America/Sao_Paulo',-22.8,-43.2,true);

insert into public.hotel_flight_settings(
  hotel_id,home_card_enabled,home_card_title,home_card_description
) values
  ('51500000-0000-4000-8000-000000000001',true,'S51H configured title','S51H configured description'),
  ('51500000-0000-4000-8000-000000000002',false,'Must remain private','Must remain private'),
  ('51500000-0000-4000-8000-000000000003',true,'Must remain private','Must remain private'),
  ('51500000-0000-4000-8000-000000000004',true,'Must remain private','Must remain private');

insert into public.hotel_airports(hotel_id,airport_id,sort_order,is_active) values
  ('51500000-0000-4000-8000-000000000001','51530000-0000-4000-8000-000000000001',1,true),
  ('51500000-0000-4000-8000-000000000002','51530000-0000-4000-8000-000000000001',1,true),
  ('51500000-0000-4000-8000-000000000003','51530000-0000-4000-8000-000000000001',1,true);

set local role anon;

do $$ declare projected record; begin
  select * into projected
  from public.get_public_hotel_flight_home_card('51500000-0000-4000-8000-000000000001');
  if projected.home_card_title<>'S51H configured title'
    or projected.home_card_description<>'S51H configured description' then
    raise exception '51 public flight home card behavior: configured card missing';
  end if;

  if exists(select 1 from public.get_public_hotel_flight_home_card('51500000-0000-4000-8000-000000000002')) then
    raise exception '51 public flight home card behavior: disabled card leaked';
  end if;
  if exists(select 1 from public.get_public_hotel_flight_home_card('51500000-0000-4000-8000-000000000003')) then
    raise exception '51 public flight home card behavior: hotel without entitlement leaked';
  end if;
  if exists(select 1 from public.get_public_hotel_flight_home_card('51500000-0000-4000-8000-000000000004')) then
    raise exception '51 public flight home card behavior: non-operational center leaked';
  end if;

  begin perform * from public.airports; raise exception '51 public flight home card behavior: anon read airports'; exception when insufficient_privilege then null; end;
  begin perform * from public.hotel_airports; raise exception '51 public flight home card behavior: anon read hotel_airports'; exception when insufficient_privilege then null; end;
  begin perform * from public.hotel_flight_settings; raise exception '51 public flight home card behavior: anon read hotel_flight_settings'; exception when insufficient_privilege then null; end;
end $$;

rollback;
