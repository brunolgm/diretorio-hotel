-- Run only in the documented disposable local lab. Caller installs migration
-- inside this transaction, then includes fixtures and this file. Always rollback.
insert into flight_private.rate_policies values('test-only',3600,10000,10000,10000);
insert into flight_private.budgets(provider,account_scope,period_start,period_end,limit_total,used_total)
values('airlabs','test-only',now()-interval '1 hour',now()+interval '1 day',900,899);
insert into public.hotel_airports(hotel_id,airport_id,sort_order,is_active,estimated_transfer_minutes,domestic_lead_minutes,international_lead_minutes,safety_margin_minutes)
values('51900000-0000-4000-8000-000000000002','51930000-0000-4000-8000-000000000001',2,true,30,120,180,20);

do $$
declare
  h uuid:='51900000-0000-4000-8000-000000000001';
  q jsonb:='{"provider":"airlabs","contract_version":1,"query_type":"schedule","flight_iata":"G3123","departure_date":"2026-09-07","departure_airport":"QXA","arrival_airport":"AEP"}';
  result jsonb; second jsonb; key text; owner uuid; fresh timestamptz; role_name text; fn regprocedure; scope_name text;
  code text;
  data jsonb:='{"flightNumber":"123","airlineCode":"G3","departureAirport":"QXA","arrivalAirport":"AEP","scheduledDeparture":{"local":"2026-09-07T12:00:00","utc":null},"estimatedDeparture":null,"actualDeparture":null,"scheduledArrival":null,"estimatedArrival":null,"actualArrival":null,"departureTerminal":null,"departureGate":null,"arrivalTerminal":null,"arrivalGate":null,"scheduleStatus":"scheduled","delayedMinutes":{"departure":null,"arrival":null},"updatedAt":null,"fetchedAt":"2026-09-07T10:00:00.000Z"}';
begin
  foreach code in array array['G37656','AD4406','LA3582','3G1','AA0','A11234Z'] loop
    assert public.admit_airlabs_query('unconfigured',h,q||jsonb_build_object('flight_iata',code))->>'status'='coordinator_unavailable','valid IATA admitted';
    insert into flight_private.query_cache(canonical_key,provider,contract_version,query_type,flight_iata,departure_date,departure_airport,arrival_airport)
    values('validation:'||code,'airlabs',1,'schedule',code,'2026-09-07','QXA','AEP');
    assert flight_private.valid_projection(data||jsonb_build_object('airlineCode',left(code,2),'flightNumber',substr(code,3)),'schedule'),'valid projection';
  end loop;
  foreach code in array array['123456','G3/7656','G37656&x=1','','G3','G312345','G31234ZZ','AAA123',repeat('A',100)] loop
    begin
      perform public.admit_airlabs_query('unconfigured',h,q||jsonb_build_object('flight_iata',code));
      raise exception 'invalid IATA accepted: %',code;
    exception when invalid_parameter_value then assert sqlerrm='airlabs_query_invalid'; end;
    begin
      insert into flight_private.query_cache(canonical_key,provider,contract_version,query_type,flight_iata,departure_date,departure_airport,arrival_airport)
      values('invalid:'||code,'airlabs',1,'schedule',code,'2026-09-07','QXA','AEP');
      raise exception 'invalid IATA persisted: %',code;
    exception when check_violation then null; end;
    assert not flight_private.valid_projection(data||jsonb_build_object('airlineCode',left(code,2),'flightNumber',substr(code,3)),'schedule'),'invalid projection rejected';
  end loop;
  delete from flight_private.query_cache where canonical_key like 'validation:%';
  foreach code in array array['2026-02-30','2026-02-29','2026-13-01','2026-00-01','2026-01-00','0000-01-01'] loop
    begin
      perform public.admit_airlabs_query('unconfigured',h,q||jsonb_build_object('departure_date',code));
      raise exception 'invalid date accepted: %',code;
    exception when invalid_parameter_value then assert sqlerrm='airlabs_query_invalid'; end;
  end loop;
  assert public.admit_airlabs_query('unconfigured',h,q||'{"departure_date":"2028-02-29"}')->>'status'='coordinator_unavailable','valid leap day';
  result:=public.admit_airlabs_query('test-only',h,q);
  assert result->>'status'='fetch_allowed','899 permits final reservation';
  assert (select used_total=900 from flight_private.budgets where account_scope='test-only'),'reservation consumed';
  key:=result->>'canonical_key'; owner:=(result->>'owner_token')::uuid;
  assert position(h::text in key)=0,'hotel excluded from key';
  second:=public.admit_airlabs_query('test-only',h,q);
  assert second->>'status'='in_progress','duplicate does not reserve';
  assert (select used_total=900 from flight_private.budgets where account_scope='test-only');
  assert public.admit_airlabs_query('test-only',h,q||'{"flight_iata":"G3124"}') ->>'status'='quota_exhausted','900 blocks';
  assert not public.publish_airlabs_query(key,gen_random_uuid(),data,900),'wrong owner';
  assert public.publish_airlabs_query(key,owner,data,900),'winner publishes';
  select fresh_until into fresh from flight_private.query_cache where canonical_key=key;
  result:=public.admit_airlabs_query('test-only','51900000-0000-4000-8000-000000000002',q);
  assert result->>'status'='cache_hit' and result->'data'=data,'shared cache';
  assert (select fresh_until=fresh from flight_private.query_cache where canonical_key=key),'read never renews TTL';
  assert (select used_total=900 from flight_private.budgets where account_scope='test-only'),'cache uses zero quota';
  assert not public.publish_airlabs_query(key,owner,data,900),'consumed token cannot publish twice';
  assert public.admit_airlabs_query('test-only','51900000-0000-4000-8000-000000000003',q)->>'status'='forbidden','cached authorization';

  update flight_private.budgets set used_total=0 where account_scope='test-only';
  update flight_private.query_cache set fresh_until=now()-interval '1 minute' where canonical_key=key;
  result:=public.admit_airlabs_query('test-only',h,q); owner:=(result->>'owner_token')::uuid;
  update flight_private.query_cache set lease_until=now()-interval '1 second' where canonical_key=key;
  assert not public.publish_airlabs_query(key,owner,data,900),'expired owner';
  second:=public.admit_airlabs_query('test-only',h,q);
  assert second->>'status'='fetch_allowed' and second->>'owner_token'<>owner::text,'lease reclaimed';
  assert not public.publish_airlabs_query(key,owner,data,900),'old owner fenced';
  owner:=(second->>'owner_token')::uuid;
  begin
    perform public.publish_airlabs_query(key,owner,data||'{"api_key":"forbidden"}',900);
    raise exception 'raw field accepted';
  exception when invalid_parameter_value then null; end;
  assert public.close_airlabs_query(key,owner,'not_found'),'negative cache published';
  result:=public.admit_airlabs_query('test-only',h,q);
  assert result->>'status'='cache_hit' and result->>'error'='not_found';
  assert (select fresh_until-fetched_at=interval '10 minutes' from flight_private.query_cache where canonical_key=key),'negative TTL';
  result:=public.admit_airlabs_query('test-only',h,q||'{"query_type":"live"}');
  assert result->>'status'='fetch_allowed','live separately admitted';
  assert (select used_total=3 from flight_private.budgets where account_scope='test-only'),'schedule plus reclaimed schedule plus live share budget';
  assert public.close_airlabs_query(result->>'canonical_key',(result->>'owner_token')::uuid,'provider_error');
  assert (select cooldown_until-created_at=interval '60 seconds' from flight_private.query_cooldowns where canonical_key=result->>'canonical_key' and account_scope='test-only'),'cooldown';
  assert public.admit_airlabs_query('test-only',h,q||'{"query_type":"live"}')->>'status'='provider_cooldown';
  assert (select result_error is null and fresh_until is null from flight_private.query_cache where canonical_key=result->>'canonical_key'),'technical error is not aviation cache';
  assert (select used_total=3 from flight_private.budgets where account_scope='test-only'),'no refund';
  insert into flight_private.rate_policies values('account-b',3600,10000,10000,10000);
  insert into flight_private.budgets(provider,account_scope,period_start,period_end,limit_total)
  values('airlabs','account-b',now()-interval '1 hour',now()+interval '1 day',900);
  second:=public.admit_airlabs_query('account-b',h,q||'{"query_type":"live"}');
  assert second->>'status'='fetch_allowed','A technical failure cannot contaminate B';
  assert (select used_total=1 from flight_private.budgets where account_scope='account-b');
  assert public.close_airlabs_query(second->>'canonical_key',(second->>'owner_token')::uuid,'provider_error');
  assert (select count(*)=2 from flight_private.query_cooldowns where canonical_key=second->>'canonical_key'),'independent cooldowns';
  update flight_private.query_cooldowns set cooldown_until=now()-interval '1 second' where account_scope='account-b';
  second:=public.admit_airlabs_query('account-b',h,q||'{"query_type":"live"}');
  assert second->>'status'='fetch_allowed','expired cooldown permits reserved retry';
  assert public.admit_airlabs_query('test-only',h,q||'{"query_type":"live"}')->>'status'='provider_cooldown','B retry does not erase A cooldown';
  assert public.close_airlabs_query(second->>'canonical_key',(second->>'owner_token')::uuid,'not_found');
  assert public.admit_airlabs_query('test-only',h,q||'{"query_type":"live"}')->>'error'='not_found','eligible negative cache remains shared';
  assert public.admit_airlabs_query('account-b',h,q)->>'error'='not_found';
  assert (select used_total=2 from flight_private.budgets where account_scope='account-b'),'negative hit costs zero';
  -- Replace expired negative schedule with a positive result from B, then read A.
  update flight_private.query_cache set fresh_until=now()-interval '1 second' where canonical_key=key;
  second:=public.admit_airlabs_query('account-b',h,q);
  assert public.publish_airlabs_query(key,(second->>'owner_token')::uuid,data,900);
  assert public.admit_airlabs_query('test-only',h,q)->'data'=data,'positive cache shared across scopes';
  assert (select used_total=3 from flight_private.budgets where account_scope='test-only'),'A cache hit costs zero';

  foreach scope_name in array array['global','hotel','occurrence'] loop
    delete from flight_private.rate_buckets where account_scope='test-only';
    update flight_private.rate_policies set global_limit=case when scope_name='global' then 1 else 10000 end,
      hotel_limit=case when scope_name='hotel' then 1 else 10000 end,
      occurrence_limit=case when scope_name='occurrence' then 1 else 10000 end where account_scope='test-only';
    assert public.admit_airlabs_query('test-only',h,q)->>'status'='cache_hit';
    assert public.admit_airlabs_query('test-only',h,q)->>'status'='rate_limited',scope_name||' limits cache hits';
  end loop;
  update flight_private.rate_policies set global_limit=10000,hotel_limit=10000,occurrence_limit=10000;
  update flight_private.budgets set suspended=true;
  assert public.admit_airlabs_query('test-only',h,q||'{"flight_iata":"G3999"}')->>'status'='budget_unavailable';
  update flight_private.budgets set suspended=false,period_end=now()-interval '1 minute';
  assert public.admit_airlabs_query('test-only',h,q||'{"flight_iata":"G3999"}')->>'status'='budget_unavailable';
  assert public.admit_airlabs_query('unconfigured',h,q)->>'status'='coordinator_unavailable';
  update flight_private.budgets set period_end=now()+interval '1 day';
  insert into flight_private.budgets(provider,account_scope,period_start,period_end,limit_total)
    values('airlabs','test-only',now()-interval '30 minutes',now()+interval '2 days',900);
  assert public.admit_airlabs_query('test-only',h,q||'{"flight_iata":"G3999"}')->>'status'='budget_unavailable','overlapping periods fail closed';

  foreach role_name in array array['anon','authenticated','service_role'] loop
    assert not has_schema_privilege(role_name,'flight_private','USAGE'),'private schema';
    assert not has_table_privilege(role_name,'flight_private.query_cache','SELECT'),'no direct tables';
    assert not has_table_privilege(role_name,'flight_private.query_cooldowns','SELECT'),'no direct cooldown access';
    for fn in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
      and proname in ('admit_airlabs_query','publish_airlabs_query','close_airlabs_query','cleanup_airlabs_queries') loop
      assert has_function_privilege(role_name,fn,'EXECUTE')=(role_name='service_role'),'RPC grants';
    end loop;
  end loop;
  raise notice 'AirLabs rollback matrix passed';
end;
$$;
-- Exercise actual caller role, not only privilege introspection.
set local role service_role;
do $$ begin
  assert public.admit_airlabs_query('test-only','51900000-0000-4000-8000-000000000001',
    '{"provider":"airlabs","contract_version":1,"query_type":"schedule","flight_iata":"G3123","departure_date":"2026-09-07","departure_airport":"QXA","arrival_airport":"AEP"}')->>'status'='cache_hit';
  begin perform * from flight_private.budgets; raise exception 'direct service table access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
