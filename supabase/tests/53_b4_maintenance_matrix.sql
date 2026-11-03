begin;
do $$begin if current_database()<>'fb_s53_auth' then raise exception 'Owned disposable lab only';end if;end$$;
create temporary table b4_results(label text primary key);
create function pg_temp.b4_check(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'B4 SQL assertion: %',label;end if;insert into b4_results values(label);end$$;
select pg_temp.b4_check((select relrowsecurity from pg_class where oid='fb_order_private.maintenance_runs'::regclass),'maintenance RLS');
select pg_temp.b4_check(not exists(select 1 from pg_policies where schemaname='fb_order_private'),'no permissive private policies');
do $$declare r text;f record;begin
 foreach r in array array['anon','authenticated','service_role']loop
  perform pg_temp.b4_check(not has_table_privilege(r,'fb_order_private.maintenance_runs','SELECT,INSERT,UPDATE,DELETE'),'maintenance table denied '||r);
 end loop;
 for f in select p.oid,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('run_fb_order_maintenance','get_fb_order_maintenance_status')loop
  perform pg_temp.b4_check(f.prosecdef,f.proname||' security definer');
  perform pg_temp.b4_check('search_path=""'=any(f.proconfig),f.proname||' empty search path');
  foreach r in array array['anon','authenticated','service_role']loop
   perform pg_temp.b4_check(has_function_privilege(r,f.oid,'EXECUTE')=(r='service_role'),f.proname||' ACL '||r);
  end loop;
 end loop;
end$$;
select pg_temp.b4_check(position('get diagnostics tokens=row_count' in pg_get_functiondef('public.purge_expired_fb_order_data(integer)'::regprocedure))>0,'token counts from actual delete');
select pg_temp.b4_check(position('not exists(select 1 from fb_order_private.quotes' in pg_get_functiondef('public.purge_expired_fb_order_data(integer)'::regprocedure))>0,'B23 bounded quote/session collection preserved');
select pg_temp.b4_check(position('pg_try_advisory_xact_lock' in pg_get_functiondef('public.run_fb_order_maintenance(integer)'::regprocedure))>0,'concurrent maintenance serialized');
select pg_temp.b4_check(position('SQLERRM' in upper(pg_get_functiondef('public.run_fb_order_maintenance(integer)'::regprocedure)))=0,'no provider messages persisted');
select pg_temp.b4_check((select count(*)=29 and bool_and(relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fb_order_private' and c.relkind='r'),'all 29 private tables protected');
select json_build_object('suite','53_b4_maintenance_matrix','passed',(select count(*) from b4_results),'failed',0,'rollback',true);
rollback;
