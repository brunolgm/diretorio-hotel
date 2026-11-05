-- Read-only metadata assertions; only temporary objects, rolled back in owned LAB.
begin;
do $$begin if current_database()<>'fb_s53_auth' then raise exception 'Requires owned disposable LAB';end if;end$$;
create temp table commissioning_assertions(label text);
create function pg_temp.commissioning_check(ok boolean,label text) returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'Commissioning metadata assertion: %',label;end if;
 insert into commissioning_assertions values(label);
end$$;
do $$declare t text;r text;f text;function_oid regprocedure;begin
 foreach t in array array['queue_catalog','physical_test_verifications'] loop
  perform pg_temp.commissioning_check((select c.relrowsecurity and c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='fb_print_private' and c.relname=t),'forced RLS '||t);
  foreach r in array array['anon','authenticated','service_role'] loop
   perform pg_temp.commissioning_check(not has_table_privilege(r,('fb_print_private.'||t)::regclass,'SELECT,INSERT,UPDATE,DELETE'),'no direct technical table access '||t||' '||r);
  end loop;
 end loop;
 foreach f in array array['public.get_current_hotel_fb_commissioning()','public.execute_current_hotel_fb_commissioning(text,jsonb,uuid)'] loop
  function_oid:=f::regprocedure;
  perform pg_temp.commissioning_check(has_function_privilege('authenticated',function_oid,'EXECUTE'),'normal authenticated commissioning '||f);
  foreach r in array array['anon','service_role'] loop perform pg_temp.commissioning_check(not has_function_privilege(r,function_oid,'EXECUTE'),'commissioning role separation '||r||' '||f);end loop;
  perform pg_temp.commissioning_check((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where pg_proc.oid=function_oid),'definer with empty search_path '||f);
 end loop;
 foreach f in array array['public.report_fb_print_queues(uuid,text,integer,jsonb)','public.get_fb_order_offer(text,text)'] loop
  function_oid:=f::regprocedure;
  perform pg_temp.commissioning_check(has_function_privilege('service_role',function_oid,'EXECUTE'),'scoped service boundary '||f);
  foreach r in array array['anon','authenticated'] loop perform pg_temp.commissioning_check(not has_function_privilege(r,function_oid,'EXECUTE'),'no browser/device direct RPC '||r||' '||f);end loop;
 end loop;
 foreach f in array array['fb_print_private.preflight(uuid)','fb_print_private.activate_raw(boolean,integer)','fb_order_private.save_config_before_commissioning(text,uuid,integer,jsonb)','fb_order_private.offer_before_commissioning(text,text)'] loop
  function_oid:=f::regprocedure;
  foreach r in array array['anon','authenticated','service_role'] loop perform pg_temp.commissioning_check(not has_function_privilege(r,function_oid,'EXECUTE'),'private delegated helper inaccessible '||r||' '||f);end loop;
 end loop;
end$$;
select json_build_object('suite','53_printing_commissioning_metadata','passed',(select count(*) from commissioning_assertions),'failed',0,'rollback',true);
rollback;
