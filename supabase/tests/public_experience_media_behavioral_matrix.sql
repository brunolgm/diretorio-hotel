-- Local disposable DB only. Runner provides migration + fixtures; always rollback.
-- Fixture identities are synthetic and shared with the Tourism matrix.
update public.profiles set role='editor' where id='52110000-0000-4000-8000-000000000002';
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at)
values ('52100000-0000-4000-8000-000000000001','experience.appearance',true,now()),
('52100000-0000-4000-8000-000000000002','experience.appearance',true,now())
on conflict(hotel_id,module_key) do update set is_enabled=true;
set local role anon;
select pg_temp.expect_error($s$select public.update_current_hotel_experience_media('hero',0,'{}')$s$,'42501');
reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.expect_error($s$select public.update_current_hotel_experience_media('hero',0,'{}')$s$,'42501');
reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.expect_error($s$select public.update_current_hotel_experience_media('hero',0,'{"hotel_id":"52100000-0000-4000-8000-000000000002"}')$s$,'22023');
select pg_temp.expect_error($s$select public.update_current_hotel_experience_media('hero',0,'{"image_path":"52100000-0000-4000-8000-000000000002/hero/hero/52130000-0000-4000-8000-000000000001.png","alt_text":"Photo"}')$s$,'23514');
select pg_temp.expect_error($s$select public.update_current_hotel_experience_media('hero',0,'{"focal_x":101}')$s$,'23514');
select pg_temp.expect_error($s$select public.update_current_hotel_experience_media('hero',0,'{"cta_url":"javascript:alert(1)"}')$s$,'23514');
select pg_temp.expect_error($s$select public.update_current_hotel_experience_media('hero',0,'{"title":"<script>"}')$s$,'23514');
select public.update_current_hotel_experience_media('hero',0,'{"title":"Synthetic hero","description":"Source PT","alt_text":"Synthetic photo","image_path":"52100000-0000-4000-8000-000000000001/hero/hero/52130000-0000-4000-8000-000000000001.png","focal_x":25,"mobile_focal_y":80}');
select public.update_current_hotel_experience_media('about',0,'{"title":"Unpublished source PT"}');
select pg_temp.expect_error($s$select public.update_current_hotel_experience_media('hero',0,'{}')$s$,'PT409');
select pg_temp.expect_error($s$delete from public.hotel_public_experience_media$s$,'42501');
do $$ declare r record; begin
  select * into r from public.update_current_hotel_experience_media('hero',1,'{"is_published":true,"image_path":null}');
  assert r.revision=2;
  assert r.previous_image_path='52100000-0000-4000-8000-000000000001/hero/hero/52130000-0000-4000-8000-000000000001.png';
end $$;
reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin assert (select count(*)=1 from public.hotel_public_experience_media where hotel_id='52100000-0000-4000-8000-000000000001'), 'published content can be read publicly'; end $$;
select pg_temp.expect_error($s$select public.update_current_hotel_experience_media('hero',0,'{}')$s$,'42501');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin assert (select count(*)=1 from public.hotel_public_experience_media), 'only published row visible'; end $$;
reset role;
update public.hotel_module_entitlements set is_enabled=false,enabled_at=null,enabled_by=null,disabled_at=now() where hotel_id='52100000-0000-4000-8000-000000000001' and module_key='experience.appearance';
set local role anon;
do $$ begin assert (select count(*)=0 from public.hotel_public_experience_media), 'entitlement OFF hides media'; end $$;
reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.expect_error($s$select public.update_current_hotel_experience_media('hero',2,'{}')$s$,'42501');
reset role;
rollback;
