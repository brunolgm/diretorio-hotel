-- Explicit rollback for this infrastructure only. Stop callers first. Do not run
-- against a deployed database without reviewing loss of cache AND quota history.
begin;
drop function public.cleanup_airlabs_queries(integer);
drop function public.close_airlabs_query(text,uuid,text);
drop function public.publish_airlabs_query(text,uuid,jsonb,integer);
drop function public.admit_airlabs_query(text,uuid,jsonb);
drop function flight_private.valid_projection(jsonb,text);
drop table flight_private.query_cooldowns;
drop table flight_private.query_cache;
drop table flight_private.rate_buckets;
drop table flight_private.rate_policies;
drop table flight_private.budgets;
drop schema flight_private;
commit;
