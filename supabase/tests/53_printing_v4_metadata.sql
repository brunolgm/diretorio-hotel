-- Run only in the owned local LAB after the V4 additive migration.
do $$
declare r record;begin
 select c.relrowsecurity,c.relforcerowsecurity into r from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='fb_print_private' and c.relname='deployment_reviews';
 if not coalesce(r.relrowsecurity,false) or not coalesce(r.relforcerowsecurity,false) then raise exception 'V4 review RLS missing';end if;
 if has_table_privilege('authenticated','fb_print_private.deployment_reviews','select') or has_table_privilege('anon','fb_print_private.deployment_reviews','insert') then raise exception 'V4 private review exposed';end if;
 if has_function_privilege('anon','public.execute_current_hotel_fb_commissioning(text,jsonb,uuid)','execute') then raise exception 'V4 anonymous command exposed';end if;
 if has_function_privilege('authenticated','fb_print_private.execute_before_v4(text,jsonb,uuid)','execute') then raise exception 'V4 bypass exposed';end if;
 if not has_function_privilege('authenticated','public.execute_current_hotel_fb_commissioning(text,jsonb,uuid)','execute') then raise exception 'V4 canonical command unavailable';end if;
 if has_function_privilege('authenticated','fb_print_private.create_job_before_v4(text,uuid,uuid,uuid,text,uuid)','execute') then raise exception 'V4 pending gate bypass exposed';end if;
end $$;
