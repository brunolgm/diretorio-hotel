-- Disposable local database only; synthetic fixtures are prepared by the runner and rolled back.
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at)
select h,k,true,now() from unnest(array['52100000-0000-4000-8000-000000000001'::uuid,'52100000-0000-4000-8000-000000000002'::uuid]) h cross join unnest(array['content.banners','content.announcements']) k
on conflict(hotel_id,module_key) do update set is_enabled=true;
insert into public.hotel_announcements(id,hotel_id,title,body,category,is_active) values
('52140000-0000-4000-8000-000000000001','52100000-0000-4000-8000-000000000001','Local fixture A','Synthetic local content','alerta',true),
('52140000-0000-4000-8000-000000000002','52100000-0000-4000-8000-000000000002','Local fixture B','Synthetic local content','informativo',true);
insert into public.hotel_promotional_banners(id,hotel_id,title,is_active) values
('52150000-0000-4000-8000-000000000001','52100000-0000-4000-8000-000000000001','Local fixture A',true),
('52150000-0000-4000-8000-000000000002','52100000-0000-4000-8000-000000000002','Local fixture B',true);
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$declare n int;begin
 update public.hotel_announcements set is_active=false where id='52140000-0000-4000-8000-000000000001';get diagnostics n=row_count;assert n=0,'viewer cannot mutate announcement';
 update public.hotel_promotional_banners set is_active=false where id='52150000-0000-4000-8000-000000000001';get diagnostics n=row_count;assert n=0,'viewer cannot mutate banner';
end $$;reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$declare n int;begin
 update public.hotel_announcements set is_active=false where id='52140000-0000-4000-8000-000000000002';get diagnostics n=row_count;assert n=0,'foreign announcement protected';
 update public.hotel_promotional_banners set is_active=false where id='52150000-0000-4000-8000-000000000002';get diagnostics n=row_count;assert n=0,'foreign banner protected';
 update public.hotel_announcements set is_active=false where id='52140000-0000-4000-8000-000000000001' and hotel_id='52100000-0000-4000-8000-000000000001';get diagnostics n=row_count;assert n=1;
 update public.hotel_promotional_banners set is_active=false where id='52150000-0000-4000-8000-000000000001' and hotel_id='52100000-0000-4000-8000-000000000001';get diagnostics n=row_count;assert n=1;
 update public.hotel_announcements set is_active=true where id='52140000-0000-4000-8000-000000000001' and updated_at='2000-01-01';get diagnostics n=row_count;assert n=0,'stale CAS must not overwrite';
 perform pg_temp.expect_error($q$update public.hotel_announcements set hotel_id='52100000-0000-4000-8000-000000000002' where id='52140000-0000-4000-8000-000000000001'$q$,'42501');
 perform pg_temp.expect_error($q$select public.record_admin_audit_event('52110000-0000-4000-8000-000000000002','52100000-0000-4000-8000-000000000001','announcement.deactivated','hotel_announcement','52140000-0000-4000-8000-000000000001','{}',null)$q$,'42501');
end $$;reset role;
do $$begin
 assert (select body='Synthetic local content' and not is_active from public.hotel_announcements where id='52140000-0000-4000-8000-000000000001');
 assert (select is_active from public.hotel_announcements where id='52140000-0000-4000-8000-000000000002');
 perform public.record_admin_audit_event('52110000-0000-4000-8000-000000000002','52100000-0000-4000-8000-000000000001','announcement.deactivated','hotel_announcement','52140000-0000-4000-8000-000000000001','{"is_active":false}',null);
 assert (select count(*)=1 from public.admin_audit_log where entity_id='52140000-0000-4000-8000-000000000001' and action='announcement.deactivated');
end $$;
rollback;
