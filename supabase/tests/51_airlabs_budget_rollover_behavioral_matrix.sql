-- Synthetic/local only. Caller supplies original coordinator, rollover migration,
-- and 51_airlabs_fixtures.sql inside a transaction. No provider or remote access.
insert into flight_private.rate_policies
select scope,60,10000,10000,10000 from unnest(array[
  'rollover-test','empty-test','suspended-test','future-test','overlap-test',
  'exhausted-test','active-test','cache-test']) scope;

insert into flight_private.budgets(provider,account_scope,period_start,period_end,limit_total,used_total,rollover_enabled)
values
 ('airlabs','rollover-test',now()-interval '60 days',now()-interval '30 days',900,17,false),
 ('airlabs','suspended-test',now()-interval '60 days',now()-interval '30 days',900,17,true),
 ('airlabs','future-test',now()-interval '60 days',now()-interval '30 days',900,17,true),
 ('airlabs','future-test',now()+interval '1 day',now()+interval '31 days',10,0,false),
 ('airlabs','overlap-test',now()-interval '2 days',now()+interval '1 day',900,17,true),
 ('airlabs','overlap-test',now()-interval '1 day',now()+interval '2 days',900,17,true),
 ('airlabs','exhausted-test',now()-interval '60 days',now()-interval '30 days',900,900,true),
 ('airlabs','active-test',now()-interval '1 day',now()+interval '1 day',900,17,false);
update flight_private.budgets set suspended=true where account_scope='suspended-test';

do $$
declare
 h uuid:='51900000-0000-4000-8000-000000000001';
 q jsonb:='{"provider":"airlabs","contract_version":1,"query_type":"schedule","flight_iata":"AD4277","departure_date":"2026-10-29","departure_airport":"QXA","arrival_airport":"AEP"}';
 result jsonb; original jsonb; child flight_private.budgets%rowtype;
 root_start timestamptz; key text; owner uuid;
begin
 assert public.admit_airlabs_query('empty-test',h,q)->>'status'='budget_unavailable';
 assert not exists(select 1 from flight_private.budgets where account_scope='empty-test'),'no implicit provisioning';
 assert public.admit_airlabs_query('rollover-test',h,q)->>'status'='budget_unavailable','legacy opt-out';
 assert (select count(*)=1 from flight_private.budgets where account_scope='rollover-test');
 update flight_private.budgets set rollover_enabled=true where account_scope='rollover-test';
 select to_jsonb(b),period_start into original,root_start from flight_private.budgets b where account_scope='rollover-test';
 assert public.admit_airlabs_query('rollover-test','51900000-0000-4000-8000-000000000003',q)->>'status'='forbidden';
 assert (select count(*)=1 from flight_private.budgets where account_scope='rollover-test'),'authorization before renewal';
 result:=public.admit_airlabs_query('rollover-test',h,q);
 assert result->>'status'='fetch_allowed','expired opt-in renews';
 key:=result->>'canonical_key'; owner:=(result->>'owner_token')::uuid;
 assert (select to_jsonb(b)=original from flight_private.budgets b where account_scope='rollover-test' and period_start=root_start),'entire historical row immutable';
 select * into child from flight_private.budgets where account_scope='rollover-test' and rolled_from=root_start;
 assert child.limit_total=883 and child.used_total=1 and child.rollover_enabled,'only unused capacity less one reservation';
 assert child.period_end-child.period_start=interval '720 hours','operational duration independent from billing';
 assert public.admit_airlabs_query('rollover-test',h,q)->>'status'='in_progress','lease/dedup retained';
 assert (select sum(used_total)=18 from flight_private.budgets where account_scope='rollover-test');
 assert public.close_airlabs_query(key,owner,'not_found'),'negative cache publication';
 assert public.admit_airlabs_query('rollover-test',h,q)->>'status'='cache_hit','cache retained';
 assert (select sum(used_total)=18 from flight_private.budgets where account_scope='rollover-test'),'cache costs zero';
 assert public.admit_airlabs_query('cache-test',h,q)->>'status'='cache_hit','cache independent of budget';
 assert not exists(select 1 from flight_private.budgets where account_scope='cache-test'),'cache does not renew';

 -- Time passage is modeled only by aging synthetic child dates; counters stay intact.
 update flight_private.budgets set period_start=now()-interval '20 days',period_end=now()-interval '10 days'
   where account_scope='rollover-test' and rolled_from=root_start;
 result:=public.admit_airlabs_query('rollover-test',h,q||'{"flight_iata":"AD4278"}');
 assert result->>'status'='fetch_allowed','subsequent validity renewal';
 select * into child from flight_private.budgets where account_scope='rollover-test' order by period_start desc limit 1;
 assert child.limit_total=882 and child.used_total=1,'no fresh credit on next period';
 assert (select sum(used_total)=19 from flight_private.budgets where account_scope='rollover-test');
 assert (select to_jsonb(b)=original from flight_private.budgets b where account_scope='rollover-test' and period_start=root_start);
 update flight_private.budgets set suspended=true where account_scope='rollover-test' and period_start=child.period_start;
 assert public.admit_airlabs_query('rollover-test',h,q||'{"flight_iata":"AD4279"}')->>'status'='budget_unavailable','current suspension preserved';

 assert public.admit_airlabs_query('suspended-test',h,q||'{"flight_iata":"AD4280"}')->>'status'='budget_unavailable','expired suspension blocks renewal';
 assert (select count(*)=1 from flight_private.budgets where account_scope='suspended-test');
 assert public.admit_airlabs_query('future-test',h,q||'{"flight_iata":"AD4281"}')->>'status'='budget_unavailable','future administrative period never bypassed';
 assert (select count(*)=2 from flight_private.budgets where account_scope='future-test');
 assert public.admit_airlabs_query('overlap-test',h,q||'{"flight_iata":"AD4282"}')->>'status'='budget_unavailable','overlap fail closed';
 assert (select count(*)=2 from flight_private.budgets where account_scope='overlap-test');
 assert public.admit_airlabs_query('exhausted-test',h,q||'{"flight_iata":"AD4283"}')->>'status'='quota_exhausted','expiry never replenishes exhausted credit';
 assert (select limit_total=0 and used_total=0 from flight_private.budgets where account_scope='exhausted-test' and rolled_from is not null);
 assert (select sum(used_total)=900 from flight_private.budgets where account_scope='exhausted-test');
 assert public.admit_airlabs_query('active-test',h,q||'{"flight_iata":"AD4284"}')->>'status'='fetch_allowed','manual active period unchanged';
 assert (select count(*)=1 and sum(used_total)=18 from flight_private.budgets where account_scope='active-test');

 assert (select prosecdef and proconfig=array['search_path=""'] from pg_proc where oid='public.admit_airlabs_query(text,uuid,jsonb)'::regprocedure);
 assert not has_function_privilege('anon','public.admit_airlabs_query(text,uuid,jsonb)','EXECUTE');
 assert not has_function_privilege('authenticated','public.admit_airlabs_query(text,uuid,jsonb)','EXECUTE');
 assert has_function_privilege('service_role','public.admit_airlabs_query(text,uuid,jsonb)','EXECUTE');
 assert not has_table_privilege('service_role','flight_private.budgets','UPDATE');
 assert not has_column_privilege('authenticated','flight_private.budgets','rollover_enabled','UPDATE');
 raise notice 'PASS rollover: opt-in, immutable history, carry capacity twice, exhaustion, suspension, future/overlap, cache, auth and ACL';
end $$;

set local role service_role;
do $$ begin
 begin update flight_private.budgets set rollover_enabled=true;
   raise exception 'direct budget mutation allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
