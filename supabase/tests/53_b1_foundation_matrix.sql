-- Catalog/ACL matrix against real private B1 objects. No mocks or remote URL.
begin;
do $$ begin if current_database()<>'fb_s53_auth' then raise exception 'Owned local laboratory only'; end if; end $$;
create temporary table b1_check_results(label text primary key);
create function pg_temp.b1_check(ok boolean,label text) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'B1 matrix failed: %',label; end if;
 insert into b1_check_results values(label);
end $$;
select pg_temp.b1_check((select count(*)=29 from pg_tables where schemaname='fb_order_private'),'27 B1 tables plus B2 quotes and B4 maintenance');
select pg_temp.b1_check(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fb_order_private' and c.relkind='r' and not c.relrowsecurity),'RLS on every operational table');
select pg_temp.b1_check(not exists(select 1 from pg_policies where schemaname='fb_order_private'),'no generic table policy');
select pg_temp.b1_check(not has_schema_privilege(r,'fb_order_private','USAGE'),'private schema denied to '||r) from unnest(array['anon','authenticated','service_role']) r;
select pg_temp.b1_check(not has_table_privilege(r,c.oid,'SELECT,INSERT,UPDATE,DELETE'),'raw table denied '||r||' '||c.relname)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join unnest(array['anon','authenticated','service_role']) r where n.nspname='fb_order_private' and c.relkind='r';
select pg_temp.b1_check(not has_function_privilege(r,p.oid,'EXECUTE'),'helper denied '||r||' '||p.proname)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated','service_role']) r where n.nspname='fb_order_private';
select pg_temp.b1_check(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='fb_order_private' and not coalesce(p.proconfig@>array['search_path=""'],false)),'private helpers have empty search_path');
select pg_temp.b1_check(not exists(select 1 from information_schema.columns where table_schema='fb_order_private' and column_name in('room_token','ip_address','email','phone','cpf','visual_version','experience_version','brand_code','secret')),'no raw secrets/contact/visual operational columns');
select pg_temp.b1_check((select count(*)=3 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='fb_order_private' and t.tgname='b1_immutable'),'three immutable fact/history triggers');
select pg_temp.b1_check(not exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='fb_order_private' and c.relkind='r' and a.attname='hotel_id' and not a.attnotnull),'tenant key not null');
do $matrix$
declare f record;server_functions text[]:=array['begin_fb_order_session','admit_fb_order_attempt','quote_fb_order','confirm_fb_order','get_fb_order_status','request_fb_order_cancellation','purge_expired_fb_order_data'];
begin
 for f in select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(
 'save_current_hotel_fb_order_config','get_current_hotel_fb_order_config','begin_fb_order_session','admit_fb_order_attempt','quote_fb_order','confirm_fb_order',
 'get_current_hotel_fb_order','get_current_hotel_fb_order_pii','get_current_hotel_fb_order_panel','get_fb_order_status','transition_current_hotel_fb_order_group',
 'request_fb_order_cancellation','decide_current_hotel_fb_order_cancellation','get_current_hotel_fb_acceptance_events','purge_expired_fb_order_data') loop
  perform pg_temp.b1_check(f.prosecdef and coalesce(f.proconfig@>array['search_path=""'],false),'privileged function hardened '||f.proname);
  perform pg_temp.b1_check(not has_function_privilege('anon',f.oid,'EXECUTE'),'anon execute denied '||f.proname);
  perform pg_temp.b1_check(has_function_privilege('service_role',f.oid,'EXECUTE')=(f.proname=any(server_functions)),'server ACL exact '||f.proname);
  perform pg_temp.b1_check(has_function_privilege('authenticated',f.oid,'EXECUTE')=(f.proname<>all(server_functions)),'authenticated ACL exact '||f.proname);
 end loop;
end $matrix$;
select json_build_object('suite','53_b1_foundation_matrix','passed',count(*),'failed',0,'rollback',true) from b1_check_results;
rollback;
