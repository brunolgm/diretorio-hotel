-- Local/disposable database only. All fixtures and mutations are rolled back.
begin;

do $$
declare
  nullable_instance boolean;
begin
  -- 1. Table and all required RPCs exist.
  if to_regclass('public.assistant_analytics_events') is null
    or to_regprocedure('public.record_assistant_analytics_event(smallint,timestamptz,uuid,text,text,text,text,text,text,text,text,text,text,smallint,smallint,smallint,integer,integer,integer)') is null
    or to_regprocedure('public.get_hotel_assistant_analytics_summary(uuid,timestamptz,timestamptz)') is null
    or to_regprocedure('public.get_platform_assistant_analytics_summary(timestamptz,timestamptz,uuid)') is null
    or to_regprocedure('public.purge_assistant_analytics_events(integer)') is null then
    raise exception 'assistant analytics matrix: migration missing';
  end if;
  -- 2. RLS and FORCE RLS are enabled.
  if not exists (
    select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'assistant_analytics_events'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'assistant analytics matrix: RLS is not forced'; end if;
  -- 14. No prohibited or arbitrary-payload column exists.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assistant_analytics_events'
      and (column_name in (
        'message','answer','prompt','context','metadata','context_id','ip','ip_hash',
        'user_agent','url','hotel_slug','room_token','room_number','reservation',
        'name','phone','email','cpf','error','stack_trace','remote_chat_id','authorization'
      ) or data_type in ('json', 'jsonb'))
  ) then raise exception 'assistant analytics matrix: prohibited storage surface exists'; end if;
  select is_nullable = 'YES' into strict nullable_instance
  from information_schema.columns
  where table_schema = 'auth' and table_name = 'users' and column_name = 'instance_id';
  if not nullable_instance and to_regclass('auth.instances') is null then
    raise exception 'assistant analytics matrix: auth.instances missing';
  end if;
  if exists (select 1 from auth.users where email like 'aap-%@example.invalid')
    or exists (select 1 from public.hotels where slug like 'aap-%') then
    raise exception 'assistant analytics matrix: fixture collision';
  end if;
end $$;

-- Control 22 uses an exact aggregate allowlist. Substring matching is unsafe because
-- legitimate metric names such as totalHandledMessages contain "message".
create function pg_temp.assistant_analytics_summary_is_closed(p_result jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  top_level_keys constant text[] := array[
    'totalHandledMessages', 'aiEligibleMessages', 'zeroUpstreamMessages',
    'classifierMessages', 'fullAiMessages', 'twoCallMessages',
    'classifierToCapability', 'classifierToAi', 'classifierFailuresToAi',
    'directAiMessages', 'privacyBlockedMessages', 'rateLimitedMessages',
    'assistantFailures', 'totalClassifierCalls', 'totalFullAiCalls',
    'totalUpstreamCalls', 'fullAiDeflectionRate', 'upstreamCallsAvoidedVsAllMaya',
    'upstreamCallReductionRate', 'averageLatencyMs', 'p95LatencyMs',
    'capabilities', 'tourismSources'
  ];
  capability_keys constant text[] := array[
    'human_handoff', 'reception_contact', 'housekeeping_contact', 'housekeeping_request'
  ];
  tourism_keys constant text[] := array['libguest_curated', 'general_ai', 'unavailable'];
begin
  if jsonb_typeof(p_result) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(p_result)) <> cardinality(top_level_keys)
    or exists (
      select 1 from jsonb_object_keys(p_result) key
      where not (key = any(top_level_keys))
    )
    or exists (
      select 1 from jsonb_each(p_result) entry
      where entry.key not in ('capabilities', 'tourismSources')
        and jsonb_typeof(entry.value) not in ('number', 'null')
    ) then return false; end if;

  if jsonb_typeof(p_result->'capabilities') <> 'object'
    or (select count(*) from jsonb_object_keys(p_result->'capabilities')) <> cardinality(capability_keys)
    or exists (
      select 1 from jsonb_each(p_result->'capabilities') entry
      where not (entry.key = any(capability_keys)) or jsonb_typeof(entry.value) <> 'number'
    ) then return false; end if;

  if jsonb_typeof(p_result->'tourismSources') <> 'object'
    or (select count(*) from jsonb_object_keys(p_result->'tourismSources')) <> cardinality(tourism_keys)
    or exists (
      select 1 from jsonb_each(p_result->'tourismSources') entry
      where not (entry.key = any(tourism_keys)) or jsonb_typeof(entry.value) <> 'number'
    ) then return false; end if;

  return true;
end;
$$;

do $$ declare nullable_instance boolean; begin
  select is_nullable = 'YES' into strict nullable_instance
  from information_schema.columns
  where table_schema = 'auth' and table_name = 'users' and column_name = 'instance_id';
  if not nullable_instance then
    insert into auth.instances select (jsonb_populate_record(null::auth.instances, jsonb_build_object(
      'id','92020000-0000-4000-8000-000000000001','uuid','92020000-0000-4000-8000-000000000001',
      'raw_base_config','{}','created_at',now(),'updated_at',now()))).*;
  end if;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
  ('92000000-0000-4000-8000-000000000001','AAP Hotel A','Recife','aap-hotel-a','aapa','active'),
  ('92000000-0000-4000-8000-000000000002','AAP Hotel B','Curitiba','aap-hotel-b','aapb','active'),
  ('92000000-0000-4000-8000-000000000003','AAP No Entitlement','Natal','aap-no-entitlement','aapc','active');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select case when (select is_nullable='YES' from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id')
    then null::uuid else '92020000-0000-4000-8000-000000000001'::uuid end,
  id,'authenticated','authenticated',email,'',now(),jsonb_build_object('provider','email','providers',jsonb_build_array('email')),'{}'::jsonb,now(),now()
from (values
  ('92010000-0000-4000-8000-000000000001'::uuid,'aap-viewer-a@example.invalid'),
  ('92010000-0000-4000-8000-000000000002'::uuid,'aap-admin-a@example.invalid'),
  ('92010000-0000-4000-8000-000000000003'::uuid,'aap-no-entitlement@example.invalid'),
  ('92010000-0000-4000-8000-000000000004'::uuid,'aap-platform@example.invalid')
) fixture(id,email);

delete from public.profiles where id = any(array[
  '92010000-0000-4000-8000-000000000001','92010000-0000-4000-8000-000000000002',
  '92010000-0000-4000-8000-000000000003','92010000-0000-4000-8000-000000000004']::uuid[]);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
  ('92010000-0000-4000-8000-000000000001','aap-viewer-a@example.invalid','AAP Viewer','visualizador','92000000-0000-4000-8000-000000000001',true),
  ('92010000-0000-4000-8000-000000000002','aap-admin-a@example.invalid','AAP Admin','administrador','92000000-0000-4000-8000-000000000001',true),
  ('92010000-0000-4000-8000-000000000003','aap-no-entitlement@example.invalid','AAP No Ent','visualizador','92000000-0000-4000-8000-000000000003',true);
insert into public.platform_users(user_id,role,is_active)
values('92010000-0000-4000-8000-000000000004','platform_admin',true);
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) values
  ('92000000-0000-4000-8000-000000000001','analytics.basic',true,now()),
  ('92000000-0000-4000-8000-000000000002','analytics.basic',true,now()),
  ('92000000-0000-4000-8000-000000000003','analytics.basic',false,null);

-- 3-7. Browser roles cannot read/write raw rows or call the ingestion RPC.
set local role authenticated;
do $$ begin
  begin perform * from public.assistant_analytics_events; raise exception 'matrix 3: browser SELECT allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.assistant_analytics_events default values; raise exception 'matrix 4: browser INSERT allowed'; exception when insufficient_privilege then null; end;
  begin update public.assistant_analytics_events set total_latency_ms=0; raise exception 'matrix 5: browser UPDATE allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.assistant_analytics_events; raise exception 'matrix 6: browser DELETE allowed'; exception when insufficient_privilege then null; end;
  begin perform public.record_assistant_analytics_event(
    p_schema_version => 1::smallint,
    p_occurred_at => now()::timestamptz,
    p_hotel_id => '92000000-0000-4000-8000-000000000001'::uuid,
    p_language => null::text,
    p_assistant_route => 'deterministic'::text,
    p_resolution_path => 'deterministic'::text,
    p_outcome => 'success'::text,
    p_capability => null::text,
    p_housekeeping_request_type => null::text,
    p_action_type => null::text,
    p_tourism_source => null::text,
    p_classifier_intent => null::text,
    p_classifier_confidence_band => null::text,
    p_classifier_calls => 0::smallint,
    p_full_ai_calls => 0::smallint,
    p_total_upstream_calls => 0::smallint,
    p_total_latency_ms => 1::integer,
    p_classifier_latency_ms => null::integer,
    p_full_ai_latency_ms => null::integer
  ); raise exception 'matrix 7: authenticated ingestion allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role; set local role anon;
do $$ begin
  begin perform public.record_assistant_analytics_event(
    p_schema_version => 1::smallint,
    p_occurred_at => now()::timestamptz,
    p_hotel_id => '92000000-0000-4000-8000-000000000001'::uuid,
    p_language => null::text,
    p_assistant_route => 'deterministic'::text,
    p_resolution_path => 'deterministic'::text,
    p_outcome => 'success'::text,
    p_capability => null::text,
    p_housekeeping_request_type => null::text,
    p_action_type => null::text,
    p_tourism_source => null::text,
    p_classifier_intent => null::text,
    p_classifier_confidence_band => null::text,
    p_classifier_calls => 0::smallint,
    p_full_ai_calls => 0::smallint,
    p_total_upstream_calls => 0::smallint,
    p_total_latency_ms => 1::integer,
    p_classifier_latency_ms => null::integer,
    p_full_ai_latency_ms => null::integer
  ); raise exception 'matrix 7: anon ingestion allowed'; exception when insufficient_privilege then null; end;
end $$;

-- 8-9. service_role can execute exactly the narrow RPC and insert a valid event.
reset role; set local role service_role;
select public.record_assistant_analytics_event(
  p_schema_version => 1::smallint,
  p_occurred_at => (now() - interval '1 hour')::timestamptz,
  p_hotel_id => '92000000-0000-4000-8000-000000000001'::uuid,
  p_language => 'pt'::text,
  p_assistant_route => 'capability'::text,
  p_resolution_path => 'classifier_to_capability'::text,
  p_outcome => 'success'::text,
  p_capability => 'human_handoff'::text,
  p_housekeeping_request_type => null::text,
  p_action_type => 'open_url'::text,
  p_tourism_source => 'libguest_curated'::text,
  p_classifier_intent => 'human_handoff'::text,
  p_classifier_confidence_band => 'high'::text,
  p_classifier_calls => 1::smallint,
  p_full_ai_calls => 0::smallint,
  p_total_upstream_calls => 1::smallint,
  p_total_latency_ms => 1::integer,
  p_classifier_latency_ms => 1::integer,
  p_full_ai_latency_ms => null::integer
);
-- 15. Even service_role has no broad append/update/delete table privilege.
do $$ begin
  begin update public.assistant_analytics_events set total_latency_ms=2; raise exception 'matrix 15: broad mutation allowed'; exception when insufficient_privilege then null; end;
end $$;

-- 10-13. Closed catalogs, call totals, resolution mappings and latency coherence reject invalid events.
do $$ begin
  begin perform public.record_assistant_analytics_event(
    p_schema_version => 1::smallint,
    p_occurred_at => now()::timestamptz,
    p_hotel_id => '92000000-0000-4000-8000-000000000001'::uuid,
    p_language => null::text,
    p_assistant_route => 'unknown'::text,
    p_resolution_path => 'deterministic'::text,
    p_outcome => 'success'::text,
    p_capability => null::text,
    p_housekeeping_request_type => null::text,
    p_action_type => null::text,
    p_tourism_source => null::text,
    p_classifier_intent => null::text,
    p_classifier_confidence_band => null::text,
    p_classifier_calls => 0::smallint,
    p_full_ai_calls => 0::smallint,
    p_total_upstream_calls => 0::smallint,
    p_total_latency_ms => 1::integer,
    p_classifier_latency_ms => null::integer,
    p_full_ai_latency_ms => null::integer
  ); raise exception 'matrix 10: invalid catalog accepted'; exception when check_violation then null; end;
  begin perform public.record_assistant_analytics_event(
    p_schema_version => 1::smallint,
    p_occurred_at => now()::timestamptz,
    p_hotel_id => '92000000-0000-4000-8000-000000000001'::uuid,
    p_language => null::text,
    p_assistant_route => 'ai'::text,
    p_resolution_path => 'direct_ai'::text,
    p_outcome => 'success'::text,
    p_capability => null::text,
    p_housekeeping_request_type => null::text,
    p_action_type => null::text,
    p_tourism_source => null::text,
    p_classifier_intent => null::text,
    p_classifier_confidence_band => null::text,
    p_classifier_calls => 0::smallint,
    p_full_ai_calls => 1::smallint,
    p_total_upstream_calls => 2::smallint,
    p_total_latency_ms => 1::integer,
    p_classifier_latency_ms => null::integer,
    p_full_ai_latency_ms => 1::integer
  ); raise exception 'matrix 11: invalid call total accepted'; exception when check_violation then null; end;
  begin perform public.record_assistant_analytics_event(
    p_schema_version => 1::smallint,
    p_occurred_at => now()::timestamptz,
    p_hotel_id => '92000000-0000-4000-8000-000000000001'::uuid,
    p_language => null::text,
    p_assistant_route => 'ai'::text,
    p_resolution_path => 'classifier_to_ai'::text,
    p_outcome => 'success'::text,
    p_capability => null::text,
    p_housekeeping_request_type => null::text,
    p_action_type => null::text,
    p_tourism_source => null::text,
    p_classifier_intent => null::text,
    p_classifier_confidence_band => 'high'::text,
    p_classifier_calls => 0::smallint,
    p_full_ai_calls => 1::smallint,
    p_total_upstream_calls => 1::smallint,
    p_total_latency_ms => 1::integer,
    p_classifier_latency_ms => null::integer,
    p_full_ai_latency_ms => 1::integer
  ); raise exception 'matrix 12: incompatible resolution accepted'; exception when check_violation then null; end;
  begin perform public.record_assistant_analytics_event(
    p_schema_version => 1::smallint,
    p_occurred_at => now()::timestamptz,
    p_hotel_id => '92000000-0000-4000-8000-000000000001'::uuid,
    p_language => null::text,
    p_assistant_route => 'ai'::text,
    p_resolution_path => 'direct_ai'::text,
    p_outcome => 'success'::text,
    p_capability => null::text,
    p_housekeeping_request_type => null::text,
    p_action_type => null::text,
    p_tourism_source => null::text,
    p_classifier_intent => null::text,
    p_classifier_confidence_band => null::text,
    p_classifier_calls => 0::smallint,
    p_full_ai_calls => 1::smallint,
    p_total_upstream_calls => 1::smallint,
    p_total_latency_ms => 1::integer,
    p_classifier_latency_ms => 1::integer,
    p_full_ai_latency_ms => null::integer
  ); raise exception 'matrix 13: incoherent latency accepted'; exception when check_violation then null; end;
end $$;

-- Synthetic rows for aggregation parity: 20 latencies make percentile_disc(.95)=19.
reset role;
insert into public.assistant_analytics_events(
  schema_version,occurred_at,hotel_id,language,assistant_route,resolution_path,outcome,
  capability,tourism_source,classifier_calls,full_ai_calls,total_upstream_calls,
  total_latency_ms,classifier_latency_ms,full_ai_latency_ms
)
select 1,now()-interval '30 minutes','92000000-0000-4000-8000-000000000001','pt',
  'deterministic','deterministic','success',case when n=1 then 'housekeeping_contact' end,
  case when n=1 then 'general_ai' end,0,0,0,n,null,null
from generate_series(1,20) n;
insert into public.assistant_analytics_events(
  schema_version,occurred_at,hotel_id,language,assistant_route,resolution_path,outcome,
  tourism_source,classifier_intent,classifier_confidence_band,classifier_calls,full_ai_calls,
  total_upstream_calls,total_latency_ms,classifier_latency_ms,full_ai_latency_ms
) values (
  1,now()-interval '20 minutes','92000000-0000-4000-8000-000000000002','en','ai',
  'classifier_failed_to_ai','success','general_ai',null,'invalid',1,1,2,50,10,40
);

-- 16. Viewer gets only an aggregate summary for own entitled hotel.
set local role authenticated;
select set_config('request.jwt.claim.sub','92010000-0000-4000-8000-000000000001',true);
do $$ declare result jsonb; begin
  result := public.get_hotel_assistant_analytics_summary('92000000-0000-4000-8000-000000000001',now()-interval '1 day',now()+interval '1 minute');
  if (result->>'totalHandledMessages')::int <> 21 then raise exception 'matrix 16: own summary invalid'; end if;
  -- 22. Exact allowlist rejects raw rows/identifiers without matching legitimate *Messages metrics.
  if not pg_temp.assistant_analytics_summary_is_closed(result) then
    raise exception 'matrix 22: hotel summary exposed a non-aggregate shape';
  end if;
  if pg_temp.assistant_analytics_summary_is_closed(
    result || jsonb_build_object('id', 'synthetic-event-id', 'occurred_at', now())
  ) then
    raise exception 'matrix 22: synthetic raw event fields were not detected';
  end if;
  -- 25. percentile_disc(.95) equals nearest-rank over 21 values (20 here because extra latency=1): rank 20 => 19.
  if (result->>'p95LatencyMs')::int <> 19 then raise exception 'matrix 25: P95 invalid'; end if;
  -- 26. Closed capability and tourism breakdowns are present.
  if (result#>>'{capabilities,human_handoff}')::int <> 1
    or (result#>>'{capabilities,housekeeping_contact}')::int <> 1
    or (result#>>'{tourismSources,general_ai}')::int <> 1 then
    raise exception 'matrix 26: breakdown invalid';
  end if;
end $$;
-- 17. Cross-hotel summary is denied.
do $$ begin
  begin perform public.get_hotel_assistant_analytics_summary('92000000-0000-4000-8000-000000000002',now()-interval '1 day',now()); raise exception 'matrix 17: cross-hotel read allowed'; exception when insufficient_privilege then null; end;
end $$;
-- 23. Empty half-open period has null denominators and no NaN/Infinity.
do $$ declare result jsonb; begin
  result := public.get_hotel_assistant_analytics_summary('92000000-0000-4000-8000-000000000001',now()+interval '1 day',now()+interval '2 days');
  if result->'fullAiDeflectionRate' <> 'null'::jsonb or result->'upstreamCallReductionRate' <> 'null'::jsonb
    or result::text ~* 'nan|infinity' then raise exception 'matrix 23: zero denominator invalid'; end if;
end $$;
-- 18. Entitlement is mandatory.
select set_config('request.jwt.claim.sub','92010000-0000-4000-8000-000000000003',true);
do $$ begin
  begin perform public.get_hotel_assistant_analytics_summary('92000000-0000-4000-8000-000000000003',now()-interval '1 day',now()); raise exception 'matrix 18: disabled entitlement allowed'; exception when insufficient_privilege then null; end;
end $$;
-- 19. A hotel administrator is not a Platform administrator.
select set_config('request.jwt.claim.sub','92010000-0000-4000-8000-000000000002',true);
do $$ begin
  begin perform public.get_platform_assistant_analytics_summary(now()-interval '1 day',now(),null); raise exception 'matrix 19: hotel admin got platform summary'; exception when insufficient_privilege then null; end;
end $$;
-- 20-21. Active Platform admin can query global and filtered aggregates without a hotel profile.
select set_config('request.jwt.claim.sub','92010000-0000-4000-8000-000000000004',true);
do $$ declare global_result jsonb; filtered_result jsonb; begin
  global_result := public.get_platform_assistant_analytics_summary(now()-interval '1 day',now()+interval '1 minute',null);
  filtered_result := public.get_platform_assistant_analytics_summary(now()-interval '1 day',now()+interval '1 minute','92000000-0000-4000-8000-000000000002');
  if (global_result->>'totalHandledMessages')::int <> 22 then raise exception 'matrix 20: global summary invalid'; end if;
  if (filtered_result->>'totalHandledMessages')::int <> 1 then raise exception 'matrix 21: filtered summary invalid'; end if;
  if not pg_temp.assistant_analytics_summary_is_closed(global_result)
    or not pg_temp.assistant_analytics_summary_is_closed(filtered_result) then
    raise exception 'matrix 22: platform summary exposed a non-aggregate shape';
  end if;
  -- 24. classifier_failed_to_ai + success keeps two calls and a negative All Maya delta.
  if (filtered_result->>'upstreamCallsAvoidedVsAllMaya')::int <> -1
    or (filtered_result->>'assistantFailures')::int <> 0 then
    raise exception 'matrix 24: negative avoided calls/failure semantics invalid';
  end if;
end $$;

-- 27. Browser cannot purge.
do $$ begin
  begin perform public.purge_assistant_analytics_events(180); raise exception 'matrix 27: browser purge allowed'; exception when insufficient_privilege then null; end;
end $$;

-- Add old/recent retention fixtures only through the narrow service RPC.
reset role; set local role service_role;
select public.record_assistant_analytics_event(
  p_schema_version => 1::smallint,
  p_occurred_at => (now() - interval '181 days')::timestamptz,
  p_hotel_id => '92000000-0000-4000-8000-000000000003'::uuid,
  p_language => null::text,
  p_assistant_route => 'deterministic'::text,
  p_resolution_path => 'deterministic'::text,
  p_outcome => 'success'::text,
  p_capability => null::text,
  p_housekeeping_request_type => null::text,
  p_action_type => null::text,
  p_tourism_source => null::text,
  p_classifier_intent => null::text,
  p_classifier_confidence_band => null::text,
  p_classifier_calls => 0::smallint,
  p_full_ai_calls => 0::smallint,
  p_total_upstream_calls => 0::smallint,
  p_total_latency_ms => 1::integer,
  p_classifier_latency_ms => null::integer,
  p_full_ai_latency_ms => null::integer
);
select public.record_assistant_analytics_event(
  p_schema_version => 1::smallint,
  p_occurred_at => (now() - interval '179 days')::timestamptz,
  p_hotel_id => '92000000-0000-4000-8000-000000000003'::uuid,
  p_language => null::text,
  p_assistant_route => 'deterministic'::text,
  p_resolution_path => 'deterministic'::text,
  p_outcome => 'success'::text,
  p_capability => null::text,
  p_housekeeping_request_type => null::text,
  p_action_type => null::text,
  p_tourism_source => null::text,
  p_classifier_intent => null::text,
  p_classifier_confidence_band => null::text,
  p_classifier_calls => 0::smallint,
  p_full_ai_calls => 0::smallint,
  p_total_upstream_calls => 0::smallint,
  p_total_latency_ms => 1::integer,
  p_classifier_latency_ms => null::integer,
  p_full_ai_latency_ms => null::integer
);
-- 28. service_role can execute purge; 29 old is removed; 30 recent is preserved.
do $$ declare removed bigint; begin
  removed := public.purge_assistant_analytics_events(180);
  if removed <> 1 then raise exception 'matrix 28/29: purge count invalid'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.assistant_analytics_events where hotel_id='92000000-0000-4000-8000-000000000003' and occurred_at < now()-interval '180 days') then
    raise exception 'matrix 29: old event preserved';
  end if;
  if not exists(select 1 from public.assistant_analytics_events where hotel_id='92000000-0000-4000-8000-000000000003' and occurred_at >= now()-interval '180 days') then
    raise exception 'matrix 30: recent event removed';
  end if;
end $$;

-- 31. The complete behavioral matrix is rollback-only.
rollback;
