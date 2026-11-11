begin;
do $$begin if current_database()<>'fb_s53_auth' then raise exception 'C1 requires owned disposable lab';end if;end$$;
create temp table c1_assertions(label text);
create function pg_temp.c1_check(ok boolean,label text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'C1 SQL assertion failed: %',label;end if;insert into c1_assertions values(label);
end$$;
select pg_temp.c1_check((select count(*)=19 from pg_tables where schemaname='fb_print_private') and to_regclass('fb_print_private.deployment_reviews') is not null,'nineteen C-private tables including commissioning, outbox and V4 reviews');
do $$declare t record;r text;f record;expected text;begin
 for t in select c.oid,c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fb_print_private' and c.relkind='r' loop
  perform pg_temp.c1_check(t.relrowsecurity,'RLS '||t.relname);
  foreach r in array array['anon','authenticated','service_role'] loop
   perform pg_temp.c1_check(not has_table_privilege(r,t.oid,'SELECT,INSERT,UPDATE,DELETE'),'no direct table '||r||' '||t.relname);
  end loop;
 end loop;
 for f in select p.oid,p.proname,p.prosecdef,p.proconfig,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='fb_print_private' or (n.nspname='public' and p.proname like '%fb_print%') loop
  perform pg_temp.c1_check(f.proconfig @> array['search_path=""'],'empty search_path '||f.proname);
  perform pg_temp.c1_check(not has_function_privilege('anon',f.oid,'EXECUTE'),'anon cannot execute '||f.proname);
  if f.nspname='fb_print_private' then
   foreach r in array array['authenticated','service_role'] loop perform pg_temp.c1_check(not has_function_privilege(r,f.oid,'EXECUTE'),'private helper '||r||' '||f.proname);end loop;
  else
   expected:=case when f.proname like '%current_hotel%' then 'authenticated' else 'service_role' end;
   perform pg_temp.c1_check(f.prosecdef,'explicit privileged wrapper '||f.proname);
   perform pg_temp.c1_check(has_function_privilege(expected,f.oid,'EXECUTE'),'expected wrapper ACL '||f.proname);
   perform pg_temp.c1_check(not has_function_privilege(case when expected='authenticated' then 'service_role' else 'authenticated' end,f.oid,'EXECUTE'),'other role cannot execute wrapper '||f.proname);
  end if;
 end loop;
end$$;
select pg_temp.c1_check((select count(*)=0 from pg_policies where schemaname='fb_print_private'),'no open browser/device policies');
select pg_temp.c1_check((select count(*)=0 from information_schema.columns where table_schema='fb_print_private' and column_name in('secret','token','room_token','first_name','last_name','room_label','note','ip_address','password')),'no raw secret/contact/guest PII columns');
select pg_temp.c1_check(to_regclass('fb_print_private.c1_job_event_original') is not null,'source event/destination original uniqueness');
select pg_temp.c1_check(to_regclass('fb_print_private.c1_job_group_original') is not null,'group/destination original uniqueness');
select pg_temp.c1_check(to_regclass('fb_order_private.c1_registration_cancellation_source') is not null,'bounded registration/cancellation source lookup index');
select pg_temp.c1_check(not exists(select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='fb_print_private' and c.contype='f' and c.confrelid in('fb_order_private.orders'::regclass,'fb_order_private.order_groups'::regclass,'fb_order_private.order_lines'::regclass,'fb_order_private.order_events'::regclass) and (t.relname<>'registration_facts' or c.confdeltype<>'c')),'C never pins B retention; outbox follows source GC by cascade');
select pg_temp.c1_check((select count(*)=4 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='fb_print_private' and not t.tgisinternal),'C job/history/outbox guards installed');
select pg_temp.c1_check(fb_print_private.equal_digest(repeat('a',64),repeat('a',64)),'constant-work digest accepts same bytes');
select pg_temp.c1_check(not fb_print_private.equal_digest(repeat('a',64),repeat('a',63)||'b'),'constant-work digest rejects final byte');
select pg_temp.c1_check(not fb_print_private.equal_digest(null,repeat('a',64)),'missing digest fails closed');
select json_build_object('suite','53_c1_print_cloud_matrix','passed',(select count(*) from c1_assertions),'failed',0,'rollback',true);
rollback;
