-- Disposable local database only; all schema and fixture changes roll back.
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.expect_error($s$select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','test','{}')$s$,'42501');
reset role;
update public.profiles set role='administrador' where id='52110000-0000-4000-8000-000000000002';
update public.hotels set platform_status='suspended' where id='52100000-0000-4000-8000-000000000001';
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) values
('52100000-0000-4000-8000-000000000001','content.services',true,now()),
('52100000-0000-4000-8000-000000000001','content.departments',true,now()),
('52100000-0000-4000-8000-000000000001','content.policies',true,now()),
('52100000-0000-4000-8000-000000000001','experience.appearance',true,now()) on conflict(hotel_id,module_key) do update set is_enabled=true;
create temporary table bootstrap_before_profiles as select * from public.profiles;
create temporary table bootstrap_before_modules as select * from public.hotel_module_entitlements;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.expect_error($s$select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000002','test','{}')$s$,'42501');
select pg_temp.expect_error($s$select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','test','{"hotel":{"platform_status":"active"}}')$s$,'22023');
select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','test',
'{"slug":{"expected":"s521-a","value":"s521-new"},"hotel":{"wifi_name":"Source preserved"},"entries":[{"key":"service","domain":"service","values":{"title":"Synthetic service","content":"Test","icon":"Globe","service_action_type":"standard","enabled":true,"sort_order":0}},{"key":"tourism","domain":"tourism","values":{"name":"Tourism test","short_description":"Test","type":"PLACE","category_key":"sights","is_published":true}},{"key":"hero","domain":"media","values":{"title":"Hero","description":"Test","is_published":true}}]}');
select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','test',
'{"slug":{"expected":"s521-a","value":"s521-new"},"hotel":{"wifi_name":"Source preserved"},"entries":[{"key":"service","domain":"service","values":{"title":"Synthetic service","content":"Test","icon":"Globe","service_action_type":"standard","enabled":true,"sort_order":0}},{"key":"tourism","domain":"tourism","values":{"name":"Tourism test","short_description":"Test","type":"PLACE","category_key":"sights","is_published":true}},{"key":"hero","domain":"media","values":{"title":"Hero","description":"Test","is_published":true}}]}');
select pg_temp.expect_error($s$select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','test','{"entries":[{"key":"service","domain":"service","values":{"title":"Modified"}}]}')$s$,'PT409');
select pg_temp.expect_error($s$select public.update_current_hotel_slug('52100000-0000-4000-8000-000000000001','wrong','s521-other')$s$,'PT409');
reset role;
do $$ begin
 assert (select count(*) from public.hotel_sections where hotel_id='52100000-0000-4000-8000-000000000001')=1;
 assert (select count(*) from public.hotel_tourism_items where hotel_id='52100000-0000-4000-8000-000000000001')=1;
 assert (select count(*) from public.hotel_bootstrap_items)=3;
 assert (select wifi_name from public.hotels where id='52100000-0000-4000-8000-000000000001')='Source preserved';
 assert public.resolve_public_hotel_slug('s521-a') is null, 'suspended alias leaked';
 assert not exists((select * from bootstrap_before_profiles except select * from public.profiles) union all(select * from public.profiles except select * from bootstrap_before_profiles));
 assert not exists((select * from bootstrap_before_modules except select * from public.hotel_module_entitlements) union all(select * from public.hotel_module_entitlements except select * from bootstrap_before_modules));
end $$;
update public.hotels set platform_status='active' where id='52100000-0000-4000-8000-000000000001';
do $$ begin assert public.resolve_public_hotel_slug('s521-a')='s521-new'; end $$;
select pg_temp.expect_error($s$insert into public.hotels(name,slug) values('Hijack','s521-a')$s$,'23505');
update public.hotels set platform_status='suspended' where id='52100000-0000-4000-8000-000000000001';
update public.hotel_sections set content='Manual edit' where hotel_id='52100000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.expect_error($s$select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','test','{"entries":[{"key":"service","domain":"service","values":{"title":"Synthetic service","content":"Test","icon":"Globe","service_action_type":"standard","enabled":true,"sort_order":0}}]}')$s$,'PT409');
reset role;
set local role anon;
select pg_temp.expect_error($s$select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','test','{}')$s$,'42501');
select pg_temp.expect_error($s$select public.update_current_hotel_slug('52100000-0000-4000-8000-000000000001','s521-new','s521-next')$s$,'42501');
reset role;
set local role service_role;
select pg_temp.expect_error($s$select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','test','{}')$s$,'42501');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select pg_temp.expect_error($s$select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','test','{}')$s$,'42501');
reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000004',true);
set local role authenticated;
select pg_temp.expect_error($s$select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','test','{}')$s$,'42501');
reset role;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.expect_error($s$select public.apply_current_hotel_bootstrap('52100000-0000-4000-8000-000000000001','atomic','{"entries":[{"key":"first","domain":"service","values":{"title":"Must rollback","enabled":true}},{"key":"invalid","domain":"tourism","values":{"name":"Bad category","short_description":"Test","type":"PLACE","category_key":"tours"}}]}')$s$,'23514');
reset role;
do $$ begin
 assert not exists(select 1 from public.hotel_sections where title='Must rollback'),'partial batch leaked';
 assert not exists(select 1 from public.hotel_bootstrap_items where namespace='atomic'),'partial registry leaked';
end $$;

set local role authenticated;
select public.apply_current_hotel_bootstrap_translation('52100000-0000-4000-8000-000000000001','test','hero','en','{"title":"Welcome"}');
select public.save_current_hotel_experience_media_translation('hero','es',999,'{"title":"Stale"}');
reset role;
do $$ begin
 assert (select count(*) from public.hotel_public_experience_media_translations)=1,'media translation missing/duplicated/stale';
end $$;
set local role anon;
do $$ begin assert (select count(*) from public.hotel_public_experience_media_translations)=0,'suspended media translation exposed'; end $$;
reset role;
set local role authenticated;
select public.update_current_hotel_experience_media('hero',1,'{"title":"Changed PT"}');
reset role;
do $$ begin
 assert not exists(select 1 from public.hotel_public_experience_media_translations),'stale media translations retained';
 assert (select title from public.hotel_public_experience_media where slot='hero' and hotel_id='52100000-0000-4000-8000-000000000001')='Changed PT','PT was lost';
end $$;

rollback;