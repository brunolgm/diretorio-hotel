-- Manual rollback plan for 20261112033049_sprint_53_kds_universal.sql.
-- Export KDS settings first. Drops only new KDS configuration/sessions; orders and printing survive.
-- Production execution requires separate review/authorization. Explicit opt-in in the same session:
-- SET libguest.kds_rollback = 'approved';
begin;
do $$ begin
 if current_setting('libguest.kds_rollback',true) is distinct from 'approved' then
  raise exception 'KDS rollback requires explicit reviewed opt-in';
 end if;
end $$;
drop function public.transition_current_hotel_fb_kds_group(text,uuid,integer,text);
drop function public.authorize_current_hotel_fb_kds(text,uuid);
drop function public.get_fb_kds_snapshot(text);
drop function public.redeem_fb_kds_pairing(text,text,text);
drop function public.rotate_current_hotel_fb_kds_access(uuid,integer,text);
drop function public.save_current_hotel_fb_kds_screen(uuid,integer,text,text,text,boolean,uuid[],jsonb);
drop function public.get_current_hotel_fb_kds_admin();
drop schema fb_kds_private cascade;
commit;
