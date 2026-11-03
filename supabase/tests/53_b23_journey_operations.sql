begin;
do $$ begin if current_database()<>'fb_s53_auth' then raise exception 'Owned disposable lab only';end if;end $$;
create temporary table b23_results(label text primary key);
create function pg_temp.b23_check(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'B23 SQL assertion: %',label;end if;insert into b23_results values(label);end$$;
select pg_temp.b23_check((select count(*)=29 and bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fb_order_private' and c.relkind='r'),'29 private RLS tables including B4 maintenance');
select pg_temp.b23_check(not exists(select 1 from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='fb_order_private'),'no permissive private policies');
do $$declare r text;f record;server_names text[]:=array['get_fb_order_offer','create_fb_order_quote','confirm_fb_order_from_quote','admit_fb_order_http','get_fb_order_cancellation_info'];begin
 foreach r in array array['anon','authenticated','service_role']loop
  perform pg_temp.b23_check(not has_schema_privilege(r,'fb_order_private','USAGE'),'no private schema access '||r);
  perform pg_temp.b23_check(not has_table_privilege(r,'fb_order_private.quotes','SELECT,INSERT,UPDATE,DELETE'),'no raw quote access '||r);
 end loop;
 for f in select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(
 'get_fb_order_offer','create_fb_order_quote','confirm_fb_order_from_quote','admit_fb_order_http','get_fb_order_cancellation_info',
 'get_current_hotel_fb_order_access','get_current_hotel_fb_order_panel_v2','get_current_hotel_fb_order_private_view','transition_current_hotel_fb_order_group_v2','decide_current_hotel_fb_order_cancellation_v2')loop
  perform pg_temp.b23_check(f.prosecdef and f.proconfig@>array['search_path=""'],'hardened '||f.proname);
  perform pg_temp.b23_check(not has_function_privilege('anon',f.oid,'EXECUTE'),'anon denied '||f.proname);
  perform pg_temp.b23_check(has_function_privilege('service_role',f.oid,'EXECUTE')=(f.proname=any(server_names)),'server scope '||f.proname);
  perform pg_temp.b23_check(has_function_privilege('authenticated',f.oid,'EXECUTE')=(f.proname<>all(server_names)),'actor scope '||f.proname);
  perform pg_temp.b23_check(not exists(select 1 from aclexplode(f.proacl) where grantee=0 and privilege_type='EXECUTE'),'PUBLIC denied '||f.proname);
 end loop;
end$$;
select pg_temp.b23_check((select count(*)=10 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('get_fb_order_offer','create_fb_order_quote','confirm_fb_order_from_quote','admit_fb_order_http','get_fb_order_cancellation_info','get_current_hotel_fb_order_access','get_current_hotel_fb_order_panel_v2','get_current_hotel_fb_order_private_view','transition_current_hotel_fb_order_group_v2','decide_current_hotel_fb_order_cancellation_v2')),'ten bounded entrypoints');
select pg_temp.b23_check(not exists(select 1 from information_schema.columns where table_schema='fb_order_private' and table_name='quotes' and column_name in('first_name','last_name','note','room_token','secret','intent')),'quotes retain no raw intent or guest identity');
select pg_temp.b23_check(position('fb_order_private.drain_actor()' in pg_get_functiondef('public.get_current_hotel_fb_order(uuid)'::regprocedure))>0,'operational reads drain');
select pg_temp.b23_check(position('fb_order_private.actor()' in pg_get_functiondef('public.get_current_hotel_fb_order_config()'::regprocedure))>0,'configuration retains lifecycle gate');
select pg_temp.b23_check(position('fb_order_private.quotes' in pg_get_functiondef('public.purge_expired_fb_order_data(integer)'::regprocedure))>0,'bounded GC includes quotes');
select json_build_object('suite','53_b23_journey_operations','passed',count(*),'failed',0,'rollback',true) from b23_results;
rollback;
