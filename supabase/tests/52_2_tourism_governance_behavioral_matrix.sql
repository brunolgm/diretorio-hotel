-- Current governance contract; disposable local database only. All changes roll back.
begin;
do $$ begin
  assert not exists(select 1 from public.hotels where slug like 's52-governance-%'), 'fixture collision';
  assert not exists(select 1 from auth.users where email like 's52-governance-%@example.invalid'), 'Auth fixture collision';
end $$;
insert into public.hotels(id,name,slug,platform_status) values
 ('52270000-0000-4000-8000-000000000001','Synthetic Tourism A','s52-governance-a','active'),
 ('52270000-0000-4000-8000-000000000002','Synthetic Tourism B','s52-governance-b','active');
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) values
 ('52270000-0000-4000-8000-000000000001','core.directory',true,now()),
 ('52270000-0000-4000-8000-000000000002','core.directory',true,now());
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'authenticated','authenticated',email,'',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()
from (values
 ('52271000-0000-4000-8000-000000000001'::uuid,'s52-governance-platform@example.invalid'),
 ('52271000-0000-4000-8000-000000000002'::uuid,'s52-governance-operator@example.invalid'),
 ('52271000-0000-4000-8000-000000000003'::uuid,'s52-governance-viewer@example.invalid'),
 ('52271000-0000-4000-8000-000000000004'::uuid,'s52-governance-inactive@example.invalid'),
 ('52271000-0000-4000-8000-000000000005'::uuid,'s52-governance-onboarding@example.invalid')
) u(id,email);
delete from public.profiles where id::text like '52271000-%';
insert into public.platform_users(user_id,role,is_active) values
 ('52271000-0000-4000-8000-000000000001','platform_admin',true),
 ('52271000-0000-4000-8000-000000000004','platform_admin',false);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
 ('52271000-0000-4000-8000-000000000002','s52-governance-operator@example.invalid','Operator','operador','52270000-0000-4000-8000-000000000001',true),
 ('52271000-0000-4000-8000-000000000003','s52-governance-viewer@example.invalid','Viewer','visualizador','52270000-0000-4000-8000-000000000001',true);
create temp table original_entitlements as select * from public.hotel_module_entitlements;
do $$ begin
  assert not exists(select 1 from public.hotel_module_entitlements where hotel_id::text like '52270000-%' and module_key='content.tourism'), 'auto provisioning';
  assert not has_function_privilege('anon','public.update_platform_hotel_module(uuid,text,boolean)','execute'), 'anon grant';
  assert not has_function_privilege('service_role','public.update_platform_hotel_module(uuid,text,boolean)','execute'), 'service grant';
end $$;
set local role authenticated;
do $$ declare actor text; begin
  foreach actor in array array['','52271000-0000-4000-8000-000000000002','52271000-0000-4000-8000-000000000003','52271000-0000-4000-8000-000000000004'] loop
    perform set_config('request.jwt.claim.sub',actor,true);
    begin
      perform * from public.update_platform_hotel_module('52270000-0000-4000-8000-000000000001','content.tourism',true);
      raise exception 'unauthorized enable';
    exception when insufficient_privilege then assert sqlerrm='active_platform_admin_required'; end;
  end loop;
end $$;
select set_config('request.jwt.claim.sub','52271000-0000-4000-8000-000000000001',true);
select * from public.update_platform_hotel_module('52270000-0000-4000-8000-000000000001','content.tourism',true);
select * from public.update_platform_hotel_module('52270000-0000-4000-8000-000000000001','content.tourism',true);
reset role;
do $$ begin
  assert public.is_hotel_module_enabled('52270000-0000-4000-8000-000000000001','content.tourism'), 'enable failed';
  assert not public.is_hotel_module_enabled('52270000-0000-4000-8000-000000000002','content.tourism'), 'cross tenant enable';
  assert not exists(select 1 from public.hotel_tourism_items where hotel_id::text like '52270000-%'), 'fake content created';
  assert not exists((select * from public.hotel_module_entitlements where module_key<>'content.tourism') except (select * from original_entitlements where module_key<>'content.tourism')), 'other module changed';
  assert (select count(*) from public.platform_audit_log where entity_id='52270000-0000-4000-8000-000000000001' and action='hotel.module_enabled' and metadata='{"module_key":"content.tourism"}')=1, 'enable audit/idempotence';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','52271000-0000-4000-8000-000000000002',true);
select * from public.save_current_hotel_tourism_item(null,'{"type":"PLACE","category_key":"sights","name":"Preserved","short_description":"PT","is_published":true}'::jsonb);
select set_config('request.jwt.claim.sub','52271000-0000-4000-8000-000000000001',true);
select * from public.update_platform_hotel_module('52270000-0000-4000-8000-000000000001','content.tourism',false);
set local role anon;
do $$ begin assert not exists(select 1 from public.hotel_tourism_items where hotel_id='52270000-0000-4000-8000-000000000001'), 'disabled public exposure'; end $$;
reset role;
do $$ begin
  assert exists(select 1 from public.hotel_tourism_items where hotel_id='52270000-0000-4000-8000-000000000001' and name='Preserved'), 'disable deleted content';
  assert (select count(*) from public.platform_audit_log where entity_id='52270000-0000-4000-8000-000000000001' and action='hotel.module_disabled' and metadata='{"module_key":"content.tourism"}')=1, 'disable audit';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','52271000-0000-4000-8000-000000000001',true);
do $$ declare created uuid; keys text[]; begin
  select hotel_id into created from public.create_platform_hotel_onboarding('Synthetic new hotel','Local','s52-governance-new','s52governancenew',null,null,'52271000-0000-4000-8000-000000000005','s52-governance-onboarding@example.invalid','Initial admin');
  select array_agg(module_key order by module_key) into keys from public.get_platform_hotel_modules(created) where is_enabled;
  assert keys=array['analytics.basic','content.announcements','content.banners','content.departments','content.languages','content.policies','content.services','core.directory','experience.appearance','experience.navigation','experience.preview','rooms.qr'], 'onboarding baseline changed';
end $$;
reset role;
create function pg_temp.reject_tourism_governance_audit() returns trigger language plpgsql as $$ begin raise exception 'synthetic audit failure'; end $$;
create trigger tourism_governance_audit_failure before insert on public.platform_audit_log for each row execute function pg_temp.reject_tourism_governance_audit();
set local role authenticated;
do $$ begin
  begin
    perform * from public.update_platform_hotel_module('52270000-0000-4000-8000-000000000001','content.tourism',true);
    raise exception 'audit failure ignored';
  exception when raise_exception then assert sqlerrm='synthetic audit failure'; end;
end $$;
reset role;
do $$ begin assert not public.is_hotel_module_enabled('52270000-0000-4000-8000-000000000001','content.tourism'), 'audit failure did not roll back'; end $$;
rollback;
select 'Tourism governance authorization/opt-in/audit/onboarding/isolation/rollback: PASS';
