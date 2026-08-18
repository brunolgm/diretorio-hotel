-- Disposable/local database only. Synthetic mutations are isolated by BEGIN/ROLLBACK.
begin;

do $$
declare nullable_instance boolean;
begin
  if to_regprocedure('public.get_current_hotel_analytics(text)') is null then
    raise exception '49 behavioral preflight: migration missing';
  end if;
  select is_nullable='YES' into strict nullable_instance from information_schema.columns
    where table_schema='auth' and table_name='users' and column_name='instance_id' and udt_name='uuid';
  if not nullable_instance and to_regclass('auth.instances') is null then
    raise exception '49 behavioral preflight: auth.instances missing';
  end if;
  if exists(select 1 from auth.users where email like 's49-%@example.invalid')
    or exists(select 1 from public.hotels where slug like 's49-%') then
    raise exception '49 behavioral preflight: fixture collision';
  end if;
end $$;

do $$ declare nullable_instance boolean; begin
  select is_nullable='YES' into strict nullable_instance from information_schema.columns
    where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance then
    insert into auth.instances select (jsonb_populate_record(null::auth.instances,jsonb_build_object(
      'id','49020000-0000-4000-8000-000000000001','uuid','49020000-0000-4000-8000-000000000001',
      'raw_base_config','{}','created_at',now(),'updated_at',now()))).*;
  end if;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
  ('49000000-0000-4000-8000-000000000001','S49 Hotel A','Recife','s49-hotel-a','s49a','active'),
  ('49000000-0000-4000-8000-000000000002','S49 Hotel B','Curitiba','s49-hotel-b','s49b','draft'),
  ('49000000-0000-4000-8000-000000000003','S49 Disabled','Sao Paulo','s49-disabled','s49disabled','suspended');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select case when (select is_nullable='YES' from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id')
    then null::uuid else '49020000-0000-4000-8000-000000000001'::uuid end,
  id,'authenticated','authenticated',email,'',now(),jsonb_build_object('provider','email','providers',jsonb_build_array('email')),'{}'::jsonb,now(),now()
from (values
  ('49010000-0000-4000-8000-000000000001'::uuid,'s49-admin-a@example.invalid'),
  ('49010000-0000-4000-8000-000000000002'::uuid,'s49-admin-b@example.invalid'),
  ('49010000-0000-4000-8000-000000000003'::uuid,'s49-admin-disabled@example.invalid')
) fixture(id,email);

delete from public.profiles where id=any(array[
  '49010000-0000-4000-8000-000000000001','49010000-0000-4000-8000-000000000002',
  '49010000-0000-4000-8000-000000000003']::uuid[]);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
  ('49010000-0000-4000-8000-000000000001','s49-admin-a@example.invalid','S49 Admin A','administrador','49000000-0000-4000-8000-000000000001',true),
  ('49010000-0000-4000-8000-000000000002','s49-admin-b@example.invalid','S49 Admin B','administrador','49000000-0000-4000-8000-000000000002',true),
  ('49010000-0000-4000-8000-000000000003','s49-admin-disabled@example.invalid','S49 Disabled','administrador','49000000-0000-4000-8000-000000000003',true);

insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,disabled_at) values
  ('49000000-0000-4000-8000-000000000001','analytics.basic',true,now(),null),
  ('49000000-0000-4000-8000-000000000002','analytics.basic',true,now(),null),
  ('49000000-0000-4000-8000-000000000003','analytics.basic',false,null,now());

insert into public.hotel_sections(id,hotel_id,title,content,enabled) values
  ('49030000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000001','Spa S49','Conteudo sintetico',true),
  ('49030000-0000-4000-8000-000000000002','49000000-0000-4000-8000-000000000002','Spa S49 B','Conteudo sintetico',true);
insert into public.hotel_departments(id,hotel_id,name,enabled) values
  ('49040000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000001','Recepcao S49',true);

insert into public.hotel_analytics_events(id,hotel_id,hotel_slug,event_type,language,service_id,department_id,target_url,metadata,created_at) values
  ('49050000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000001','s49-hotel-a','page_view','pt',null,null,null,'{}',now()-interval '1 day'),
  ('49050000-0000-4000-8000-000000000002','49000000-0000-4000-8000-000000000001','s49-hotel-a','page_view','en',null,null,null,'{}',now()-interval '2 days'),
  ('49050000-0000-4000-8000-000000000003','49000000-0000-4000-8000-000000000001','s49-hotel-a','service_view','pt','49030000-0000-4000-8000-000000000001',null,null,'{}',now()-interval '1 day'),
  ('49050000-0000-4000-8000-000000000004','49000000-0000-4000-8000-000000000001','s49-hotel-a','department_click','pt',null,'49040000-0000-4000-8000-000000000001',null,'{}',now()-interval '1 day'),
  ('49050000-0000-4000-8000-000000000005','49000000-0000-4000-8000-000000000001','s49-hotel-a','whatsapp_click','pt',null,null,null,'{}',now()-interval '1 day'),
  ('49050000-0000-4000-8000-000000000006','49000000-0000-4000-8000-000000000001','s49-hotel-a','language_selected','en',null,null,null,'{}',now()-interval '1 day'),
  ('49050000-0000-4000-8000-000000000007','49000000-0000-4000-8000-000000000001','s49-hotel-a','website_click','pt',null,null,'https://example.invalid/legacy','{"label":"legacy"}',now()-interval '10 days'),
  ('49050000-0000-4000-8000-000000000008','49000000-0000-4000-8000-000000000002','s49-hotel-b','page_view','es',null,null,null,'{}',now()-interval '1 day'),
  ('49050000-0000-4000-8000-000000000009','49000000-0000-4000-8000-000000000001','s49-hotel-a','page_view','pt',null,null,null,'{}',now()-interval '100 days');

set local role anon;
do $$ begin
  begin perform public.get_current_hotel_analytics('7d'); raise exception '49: anon read analytics'; exception when insufficient_privilege then null; end;
end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','49010000-0000-4000-8000-000000000001',true);
do $$
declare
  result jsonb;
  requested_period text;
  expected_points integer;
begin
  for requested_period,expected_points in
    select * from (values ('today',1),('7d',7),('30d',30),('90d',90)) periods(period,points)
  loop
    result:=public.get_current_hotel_analytics(requested_period);
    if jsonb_array_length(result->'timeseries')<>expected_points then
      raise exception '49: % timeseries cardinality invalid',requested_period;
    end if;
    if (result->>'current_start')::timestamptz<>(result->>'previous_end')::timestamptz
      or (result->>'previous_start')::timestamptz
        +expected_points*interval '1 day'<>(result->>'previous_end')::timestamptz
      or (result->>'current_start')::timestamptz
        +expected_points*interval '1 day'<>(result->>'current_end')::timestamptz then
      raise exception '49: % windows overlap or have unequal duration',requested_period;
    end if;
  end loop;

  result:=public.get_current_hotel_analytics('7d');
  if (result#>>'{metrics,page_views,current}')::int<>2
    or (result#>>'{metrics,page_views,previous}')::int<>0
    or (result#>>'{metrics,engagements,current}')::int<>4
    or (result#>>'{metrics,engagements,previous}')::int<>1
    or (result#>>'{journey,external_clicks}')::int<>1 then
    raise exception '49: current/previous metrics invalid';
  end if;
  if result#>>'{services,0,name}'<>'Spa S49' or (result#>>'{services,0,count}')::int<>1
    or result#>>'{departments,0,name}'<>'Recepcao S49'
    or result#>>'{languages,0,language}' not in ('pt','en') then
    raise exception '49: rankings invalid';
  end if;
  if result::text~* 'legacy|example\.invalid|session_id|target_url|metadata' then
    raise exception '49: raw/sensitive values leaked';
  end if;
  begin perform public.get_current_hotel_analytics('365d'); raise exception '49: unbounded period accepted';
  exception when invalid_parameter_value then if sqlerrm<>'analytics_period_invalid' then raise; end if; end;
  begin perform * from public.hotel_analytics_events; raise exception '49: authenticated read raw events';
  exception when insufficient_privilege then null; end;
  result:=public.get_current_hotel_analytics('30d');
  if (result#>>'{metrics,booking_website_clicks,current}')::int<>1 then
    raise exception '49: period boundary did not include the 10-day historical event';
  end if;
  result:=public.get_current_hotel_analytics('90d');
  if (result#>>'{metrics,page_views,current}')::int<>2 then
    raise exception '49: event outside the 90-day calendar window entered current KPIs';
  end if;
end $$;

select set_config('request.jwt.claim.sub','49010000-0000-4000-8000-000000000002',true);
do $$ declare result jsonb; begin
  result:=public.get_current_hotel_analytics('7d');
  if (result#>>'{metrics,page_views,current}')::int<>1
    or jsonb_array_length(result->'services')<>0 then
    raise exception '49: hotel B saw hotel A analytics';
  end if;
end $$;

reset role;
update public.hotels set platform_status='archived' where id='49000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','49010000-0000-4000-8000-000000000002',true);
do $$ begin
  begin perform public.get_current_hotel_analytics('7d'); raise exception '49: archived hotel read analytics';
  exception when insufficient_privilege then if sqlerrm<>'active_hotel_profile_required' then raise; end if; end;
end $$;

select set_config('request.jwt.claim.sub','49010000-0000-4000-8000-000000000003',true);
do $$ begin
  begin perform public.get_current_hotel_analytics('7d'); raise exception '49: disabled entitlement read analytics';
  exception when insufficient_privilege then if sqlerrm<>'analytics_basic_required' then raise; end if; end;
end $$;

reset role;
do $$ begin
  begin
    insert into public.hotel_analytics_events(hotel_id,hotel_slug,event_type)
    values('49000000-0000-4000-8000-000000000001','s49-hotel-a','unknown_event');
    raise exception '49: unknown event accepted';
  exception when check_violation then null; end;
  if not exists(select 1 from public.hotel_analytics_events
      where id='49050000-0000-4000-8000-000000000007'
        and target_url='https://example.invalid/legacy' and metadata='{"label":"legacy"}'::jsonb) then
    raise exception '49: historical event content was rewritten';
  end if;
  begin
    insert into public.hotel_analytics_events(id,hotel_id,hotel_slug,event_type,language,service_id)
    values('49050000-0000-4000-8000-000000000010','49000000-0000-4000-8000-000000000001',
      's49-hotel-a','service_view','pt','49030000-0000-4000-8000-000000000002');
    raise exception '49: cross-hotel service association accepted';
  exception when foreign_key_violation then null; end;
  insert into public.hotel_analytics_events(id,hotel_id,hotel_slug,event_type,language,service_id)
  values('49050000-0000-4000-8000-000000000011','49000000-0000-4000-8000-000000000001',
    's49-hotel-a','service_view','pt','49030000-0000-4000-8000-000000000001');
  if not exists(select 1 from public.hotel_analytics_events
      where id='49050000-0000-4000-8000-000000000011'
        and hotel_id='49000000-0000-4000-8000-000000000001'
        and service_id='49030000-0000-4000-8000-000000000001') then
    raise exception '49: same-hotel service association rejected';
  end if;
  delete from public.hotel_sections
  where id='49030000-0000-4000-8000-000000000001';
  if not exists(select 1 from public.hotel_analytics_events
      where id='49050000-0000-4000-8000-000000000011'
        and hotel_id='49000000-0000-4000-8000-000000000001'
        and service_id is null) then
    raise exception '49: service delete did not preserve event and hotel while nulling service_id';
  end if;
end $$;

rollback;
