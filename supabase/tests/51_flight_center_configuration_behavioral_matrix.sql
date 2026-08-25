-- Disposable/local database only. Every synthetic change rolls back.
begin;

do $$ declare nullable_instance boolean; begin
  if to_regclass('public.airports') is null
    or to_regclass('public.hotel_airports') is null
    or to_regclass('public.hotel_flight_settings') is null then
    raise exception '51 configuration behavior: migration missing';
  end if;
  select is_nullable='YES' into strict nullable_instance
  from information_schema.columns
  where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance and to_regclass('auth.instances') is null then
    raise exception '51 configuration behavior: auth.instances missing';
  end if;
  if exists(select 1 from auth.users where email like 's51c-%@example.invalid')
    or exists(select 1 from public.hotels where slug like 's51c-%')
    or exists(select 1 from public.airports where iata_code like 'Q%') then
    raise exception '51 configuration behavior: fixture collision';
  end if;
end $$;

do $$ declare nullable_instance boolean; begin
  select is_nullable='YES' into strict nullable_instance
  from information_schema.columns
  where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance then
    insert into auth.instances
    select (jsonb_populate_record(null::auth.instances,jsonb_build_object(
      'id','51220000-0000-4000-8000-000000000001',
      'uuid','51220000-0000-4000-8000-000000000001',
      'raw_base_config','{}','created_at',now(),'updated_at',now()
    ))).*;
  end if;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
  ('51200000-0000-4000-8000-000000000001','S51C Hotel A','Recife','s51c-hotel-a','s51ca','active'),
  ('51200000-0000-4000-8000-000000000002','S51C Hotel B','Recife','s51c-hotel-b','s51cb','active'),
  ('51200000-0000-4000-8000-000000000003','S51C Hotel C','Recife','s51c-hotel-c','s51cc','active');

insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) values
  ('51200000-0000-4000-8000-000000000001','core.directory',true,now()),
  ('51200000-0000-4000-8000-000000000001','travel.flights',true,now()),
  ('51200000-0000-4000-8000-000000000002','core.directory',true,now()),
  ('51200000-0000-4000-8000-000000000002','travel.flights',true,now()),
  ('51200000-0000-4000-8000-000000000003','core.directory',true,now())
on conflict on constraint hotel_module_entitlements_pkey do update set
  is_enabled=true,enabled_at=excluded.enabled_at,disabled_at=null,disabled_by=null;

insert into public.airports(
  id,iata_code,icao_code,name,city,country_code,timezone,latitude,longitude,is_active
) values
  ('51230000-0000-4000-8000-000000000001','QAA','SBQA','S51C Airport A','Recife','BR','America/Recife',-8.100000,-34.900000,true),
  ('51230000-0000-4000-8000-000000000002','QAB','SBQB','S51C Airport B','Recife','BR','America/Recife',-8.200000,-34.800000,true),
  ('51230000-0000-4000-8000-000000000003','QAC','SBQC','S51C Airport Inactive','Recife','BR','America/Recife',-8.300000,-34.700000,false);

insert into public.hotel_airports(hotel_id,airport_id,sort_order,is_active) values
  ('51200000-0000-4000-8000-000000000002','51230000-0000-4000-8000-000000000001',1,true);
insert into public.hotel_flight_settings(hotel_id,home_card_enabled) values
  ('51200000-0000-4000-8000-000000000002',true);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select case when (
  select is_nullable='YES' from information_schema.columns
  where table_schema='auth' and table_name='users' and column_name='instance_id'
) then null::uuid else '51220000-0000-4000-8000-000000000001'::uuid end,
id,'authenticated','authenticated',email,'',now(),
'{"provider":"email","providers":["email"]}','{}',now(),now()
from (values
  ('51210000-0000-4000-8000-000000000001'::uuid,'s51c-editor-a@example.invalid'),
  ('51210000-0000-4000-8000-000000000002'::uuid,'s51c-editor-b@example.invalid'),
  ('51210000-0000-4000-8000-000000000003'::uuid,'s51c-editor-c@example.invalid')
) users(id,email);

delete from public.profiles where id=any(array[
  '51210000-0000-4000-8000-000000000001',
  '51210000-0000-4000-8000-000000000002',
  '51210000-0000-4000-8000-000000000003'
]::uuid[]);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
  ('51210000-0000-4000-8000-000000000001','s51c-editor-a@example.invalid','S51C Editor A','editor','51200000-0000-4000-8000-000000000001',true),
  ('51210000-0000-4000-8000-000000000002','s51c-editor-b@example.invalid','S51C Editor B','editor','51200000-0000-4000-8000-000000000002',true),
  ('51210000-0000-4000-8000-000000000003','s51c-editor-c@example.invalid','S51C Editor C','editor','51200000-0000-4000-8000-000000000003',true);

-- Global airport catalog mutation is server-only, not a browser privilege.
set local role service_role;
insert into public.airports(
  id,iata_code,name,city,country_code,timezone,latitude,longitude,is_active
) values(
  '51230000-0000-4000-8000-000000000004','QAD','S51C Server Airport','Recife','BR',
  'America/Recife',-8.400000,-34.600000,true
);
update public.airports set name='S51C Server Airport Updated',updated_at=now()
where id='51230000-0000-4000-8000-000000000004';
do $$ begin
  if (select name from public.airports where id='51230000-0000-4000-8000-000000000004')
      <>'S51C Server Airport Updated' then
    raise exception '51 configuration behavior: server could not manage global airport';
  end if;
end $$;
reset role;

-- Settings may exist through server maintenance, but they never grant the module.
set local role service_role;
insert into public.hotel_flight_settings(hotel_id,home_card_enabled)
values('51200000-0000-4000-8000-000000000003',true);
reset role;
do $$ begin
  if public.is_hotel_module_enabled('51200000-0000-4000-8000-000000000003','travel.flights') then
    raise exception '51 configuration behavior: settings enabled travel.flights';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','51210000-0000-4000-8000-000000000001',true);
set constraints hotel_airports_sort_order_key immediate;

do $$ declare affected integer; begin
  if (select count(*) from public.airports)<>3 then
    raise exception '51 configuration behavior: active entitled hotel airport catalog invalid';
  end if;
  begin
    insert into public.airports(iata_code,name,city,country_code,timezone,latitude,longitude)
    values('QAE','Forbidden Airport','Recife','BR','America/Recife',-8.5,-34.5);
    raise exception '51 configuration behavior: hotel editor changed global airport';
  exception when insufficient_privilege then null;
  end;

  insert into public.hotel_airports(
    hotel_id,airport_id,sort_order,is_active,estimated_transfer_minutes,
    domestic_lead_minutes,international_lead_minutes,safety_margin_minutes
  ) values
    ('51200000-0000-4000-8000-000000000001','51230000-0000-4000-8000-000000000001',1,true,35,120,180,20),
    ('51200000-0000-4000-8000-000000000001','51230000-0000-4000-8000-000000000002',2,true,25,90,150,15);

  insert into public.hotel_flight_settings(
    hotel_id,home_card_enabled,transfer_enabled,wake_up_enabled,breakfast_box_enabled,
    reception_enabled,official_links_enabled,departure_planning_enabled,
    home_card_title,home_card_description,departure_notice
  ) values(
    '51200000-0000-4000-8000-000000000001',true,true,true,true,true,true,true,
    'Acompanhe seu voo','Organize sua saída com tranquilidade.','Status não verificado.'
  );
  update public.hotel_flight_settings set departure_notice='Consulte o canal oficial.',updated_at=now()
  where hotel_id='51200000-0000-4000-8000-000000000001';
  get diagnostics affected=row_count;
  if affected<>1 then raise exception '51 configuration behavior: own settings update failed'; end if;

  if exists(select 1 from public.hotel_airports where hotel_id='51200000-0000-4000-8000-000000000002')
    or exists(select 1 from public.hotel_flight_settings where hotel_id='51200000-0000-4000-8000-000000000002') then
    raise exception '51 configuration behavior: hotel A read hotel B configuration';
  end if;

  update public.hotel_flight_settings set home_card_enabled=false
  where hotel_id='51200000-0000-4000-8000-000000000002';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception '51 configuration behavior: hotel A wrote hotel B settings'; end if;

  begin
    insert into public.hotel_airports(hotel_id,airport_id,sort_order)
    values('51200000-0000-4000-8000-000000000002','51230000-0000-4000-8000-000000000002',2);
    raise exception '51 configuration behavior: hotel A inserted hotel B airport';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.hotel_airports(hotel_id,airport_id,sort_order)
    values('51200000-0000-4000-8000-000000000001','51230000-0000-4000-8000-000000000003',3);
    raise exception '51 configuration behavior: inactive airport was linked';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.hotel_airports(hotel_id,airport_id,sort_order)
    values('51200000-0000-4000-8000-000000000001','51230000-0000-4000-8000-000000000001',3);
    raise exception '51 configuration behavior: duplicate hotel airport accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.hotel_airports(hotel_id,airport_id,sort_order)
    values('51200000-0000-4000-8000-000000000001','51230000-0000-4000-8000-000000000004',2);
    raise exception '51 configuration behavior: duplicate sort order accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.hotel_flight_settings(hotel_id)
    values('51200000-0000-4000-8000-000000000001');
    raise exception '51 configuration behavior: duplicate 1:1 settings accepted';
  exception when unique_violation then null;
  end;
end $$;

-- A hotel without the entitlement cannot observe server-maintained settings.
select set_config('request.jwt.claim.sub','51210000-0000-4000-8000-000000000003',true);
do $$ declare affected integer; begin
  if exists(select 1 from public.hotel_flight_settings) then
    raise exception '51 configuration behavior: non-entitled hotel read settings';
  end if;
  update public.hotel_flight_settings set home_card_enabled=false
  where hotel_id='51200000-0000-4000-8000-000000000003';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception '51 configuration behavior: non-entitled hotel wrote settings'; end if;
end $$;

reset role;
set local role anon;
do $$ begin
  begin perform * from public.airports; raise exception '51 configuration behavior: anon read airports'; exception when insufficient_privilege then null; end;
  begin perform * from public.hotel_airports; raise exception '51 configuration behavior: anon read hotel_airports'; exception when insufficient_privilege then null; end;
  begin perform * from public.hotel_flight_settings; raise exception '51 configuration behavior: anon read hotel_flight_settings'; exception when insufficient_privilege then null; end;
end $$;

rollback;
