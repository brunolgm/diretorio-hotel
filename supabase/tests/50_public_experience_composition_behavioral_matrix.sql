-- Disposable/local database only. All synthetic changes roll back.
begin;

do $$ declare nullable_instance boolean; begin
  if to_regprocedure('public.get_current_hotel_experience_layout()') is null then raise exception '50 behavior: migration missing'; end if;
  select is_nullable='YES' into strict nullable_instance from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance and to_regclass('auth.instances') is null then raise exception '50 behavior: auth.instances missing'; end if;
  if exists(select 1 from auth.users where email like 's50-%@example.invalid') or exists(select 1 from public.hotels where slug like 's50-%') then raise exception '50 behavior: fixture collision'; end if;
end $$;
do $$ declare nullable_instance boolean; begin
  select is_nullable='YES' into strict nullable_instance from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance then insert into auth.instances select (jsonb_populate_record(null::auth.instances,jsonb_build_object('id','50020000-0000-4000-8000-000000000001','uuid','50020000-0000-4000-8000-000000000001','raw_base_config','{}','created_at',now(),'updated_at',now()))).*; end if;
end $$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
 ('50000000-0000-4000-8000-000000000001','S50 Hotel A','Recife','s50-hotel-a','s50a','active'),
 ('50000000-0000-4000-8000-000000000002','S50 Hotel B','Recife','s50-hotel-b','s50b','active');
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,disabled_at) values
 ('50000000-0000-4000-8000-000000000001','core.directory',true,now(),null),
 ('50000000-0000-4000-8000-000000000001','content.banners',true,now(),null),
 ('50000000-0000-4000-8000-000000000001','content.services',false,null,now()),
 ('50000000-0000-4000-8000-000000000002','core.directory',true,now(),null)
on conflict on constraint hotel_module_entitlements_pkey do update set is_enabled=excluded.is_enabled,enabled_at=excluded.enabled_at,disabled_at=excluded.disabled_at;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select case when (select is_nullable='YES' from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id') then null::uuid else '50020000-0000-4000-8000-000000000001'::uuid end,
 id,'authenticated','authenticated',email,'',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()
from (values
 ('50010000-0000-4000-8000-000000000001'::uuid,'s50-viewer-a@example.invalid'),
 ('50010000-0000-4000-8000-000000000002'::uuid,'s50-editor-a@example.invalid'),
 ('50010000-0000-4000-8000-000000000003'::uuid,'s50-admin-b@example.invalid'),
 ('50010000-0000-4000-8000-000000000004'::uuid,'s50-platform-admin@example.invalid'),
 ('50010000-0000-4000-8000-000000000005'::uuid,'s50-initial-admin@example.invalid')) u(id,email);
delete from public.profiles where id=any(array[
 '50010000-0000-4000-8000-000000000001','50010000-0000-4000-8000-000000000002',
 '50010000-0000-4000-8000-000000000003','50010000-0000-4000-8000-000000000004',
 '50010000-0000-4000-8000-000000000005']::uuid[]);
insert into public.platform_users(user_id,role,is_active) values
 ('50010000-0000-4000-8000-000000000004','platform_admin',true);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
 ('50010000-0000-4000-8000-000000000001','s50-viewer-a@example.invalid','S50 Viewer','visualizador','50000000-0000-4000-8000-000000000001',true),
 ('50010000-0000-4000-8000-000000000002','s50-editor-a@example.invalid','S50 Editor','editor','50000000-0000-4000-8000-000000000001',true),
 ('50010000-0000-4000-8000-000000000003','s50-admin-b@example.invalid','S50 Admin B','administrador','50000000-0000-4000-8000-000000000002',true);

-- Exercise the evolved Sprint 47 contract itself; the trigger is not accepted as a
-- substitute for an explicit twelve-module onboarding baseline.
set local role authenticated;
select set_config('request.jwt.claim.sub','50010000-0000-4000-8000-000000000004',true);
do $$ declare created record; begin
  select * into strict created from public.create_platform_hotel_onboarding(
    'S50 Onboarding Hotel','Recife','s50-onboarding-hotel','s50onboarding',
    'grand-mercure','graphite-gold','50010000-0000-4000-8000-000000000005',
    's50-initial-admin@example.invalid','S50 Initial Admin'
  );
  if created.platform_status<>'draft' or created.admin_user_id<>'50010000-0000-4000-8000-000000000005' then
    raise exception '50: onboarding return contract drifted';
  end if;
  perform set_config('test.s50_onboarding_hotel_id',created.hotel_id::text,true);
end $$;
reset role;
do $$ declare onboarding_hotel_id uuid:=current_setting('test.s50_onboarding_hotel_id')::uuid; enabled_keys text[]; begin
  if (select platform_status from public.hotels where id=onboarding_hotel_id)<>'draft' then
    raise exception '50: onboarded hotel is not draft';
  end if;
  select array_agg(module_key order by module_key) into enabled_keys
  from public.hotel_module_entitlements where hotel_id=onboarding_hotel_id and is_enabled;
  if enabled_keys is distinct from array[
    'analytics.basic','content.announcements','content.banners','content.departments',
    'content.languages','content.policies','content.services','core.directory',
    'experience.appearance','experience.navigation','experience.preview','rooms.qr'
  ]::text[] then raise exception '50: onboarding baseline is not exactly twelve'; end if;
  if (select count(*) from public.hotel_experience_layout where hotel_id=onboarding_hotel_id)<>8
    or (select count(distinct position) from public.hotel_experience_layout where hotel_id=onboarding_hotel_id)<>8
    or (select min(position) from public.hotel_experience_layout where hotel_id=onboarding_hotel_id)<>1
    or (select max(position) from public.hotel_experience_layout where hotel_id=onboarding_hotel_id)<>8
    or not (select is_enabled from public.hotel_experience_layout where hotel_id=onboarding_hotel_id and block_key='hero') then
    raise exception '50: onboarding layout baseline invalid';
  end if;
  if not exists(select 1 from public.profiles p where p.id='50010000-0000-4000-8000-000000000005'
      and p.hotel_id=onboarding_hotel_id and p.email='s50-initial-admin@example.invalid'
      and p.full_name='S50 Initial Admin' and p.role='administrador' and p.is_active) then
    raise exception '50: initial hotel administrator invalid';
  end if;
  if (select count(*) from public.platform_audit_log a where a.entity_id=onboarding_hotel_id and a.action='hotel.created')<>1
    or not exists(select 1 from public.platform_audit_log a where a.entity_id=onboarding_hotel_id
      and a.action='hotel.created' and a.metadata->>'baseline_modules'='12'
      and a.metadata->>'brand_code'='grand-mercure'
      and not (a.metadata ?| array['email','name','full_name','admin_email','admin_name'])
      and a.metadata::text !~* 'example\.invalid|S50 Initial Admin') then
    raise exception '50: onboarding audit is missing, duplicated or contains PII';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','50010000-0000-4000-8000-000000000001',true);
do $$ begin
  if (select count(*) from public.get_current_hotel_experience_layout())<>8 then raise exception '50: viewer cannot read own defaults'; end if;
  begin perform public.update_current_hotel_experience_block('banners',false); raise exception '50: viewer mutated layout'; exception when insufficient_privilege then null; end;
  begin perform * from public.hotel_experience_layout; raise exception '50: raw layout exposed'; exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','50010000-0000-4000-8000-000000000002',true);
do $$ declare original_order text[]; begin
  select array_agg(block_key order by block_position) into original_order from public.get_current_hotel_experience_layout();
  perform public.update_current_hotel_experience_block('banners',false);
  if (select is_enabled from public.get_current_hotel_experience_layout() where block_key='banners') then raise exception '50: editor toggle failed'; end if;
  perform public.update_current_hotel_experience_block('banners',true);
  if not (select is_enabled from public.get_current_hotel_experience_layout() where block_key='banners') then raise exception '50: editor enable failed'; end if;
  perform public.update_current_hotel_experience_block('banners',false);
  begin perform public.update_current_hotel_experience_block('unknown',true); raise exception '50: unknown block accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.update_current_hotel_experience_block('hero',false); raise exception '50: hero disabled'; exception when invalid_parameter_value then null; end;
  begin perform public.update_current_hotel_experience_block('services',true); raise exception '50: disabled entitlement bypassed'; exception when object_not_in_prerequisite_state then null; end;
  begin perform public.reorder_current_hotel_experience_blocks(array['hero','hero']); raise exception '50: duplicate order accepted'; exception when invalid_parameter_value then null; end;
  if original_order is distinct from (select array_agg(block_key order by block_position) from public.get_current_hotel_experience_layout()) then raise exception '50: invalid reorder was not atomic'; end if;
  perform public.reorder_current_hotel_experience_blocks(array['contact','policies','departments','services','quick_info','announcements','banners','hero']);
  if (select block_key from public.get_current_hotel_experience_layout() order by block_position limit 1)<>'contact' then raise exception '50: valid reorder failed'; end if;
end $$;

reset role; set local role anon;
do $$ begin
  if (select is_enabled from public.get_public_hotel_experience_layout('50000000-0000-4000-8000-000000000001') where block_key='banners') then raise exception '50: hidden banner rendered publicly'; end if;
  if (select is_enabled from public.get_public_hotel_experience_layout('50000000-0000-4000-8000-000000000001') where block_key='services') then raise exception '50: service entitlement bypassed'; end if;
end $$;

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','50010000-0000-4000-8000-000000000003',true);
do $$ begin perform public.update_current_hotel_experience_block('contact',false); end $$;
reset role;
do $$ begin
  if (select is_enabled from public.hotel_experience_layout where hotel_id='50000000-0000-4000-8000-000000000001' and block_key='contact')=false then raise exception '50: hotel B changed hotel A'; end if;
  if (select count(*) from public.admin_audit_log where hotel_id='50000000-0000-4000-8000-000000000001' and action='experience.block_disabled')<>2
    or (select count(*) from public.admin_audit_log where hotel_id='50000000-0000-4000-8000-000000000001' and action='experience.block_enabled')<>1
    or (select count(*) from public.admin_audit_log where hotel_id='50000000-0000-4000-8000-000000000001' and action='experience.layout_updated')<>1 then
    raise exception '50: controlled hotel audit actions missing';
  end if;
  insert into public.hotels(id,name,city,slug,subdomain,platform_status) values('50000000-0000-4000-8000-000000000003','S50 New Draft','Recife','s50-new-draft','s50new','draft');
  if (select count(*) from public.hotel_experience_layout where hotel_id='50000000-0000-4000-8000-000000000003')<>8
    or not public.is_hotel_module_enabled('50000000-0000-4000-8000-000000000003','experience.navigation') then raise exception '50: new hotel baseline missing'; end if;
end $$;

rollback;
