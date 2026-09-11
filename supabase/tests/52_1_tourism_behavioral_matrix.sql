-- Run after the new migration in the SAME transaction, only in a disposable local DB.
-- The local runner opens BEGIN; this matrix always ends in ROLLBACK.
create function pg_temp.expect_error(statement text, expected_state text, expected_message text default null) returns void
language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate=expected_state and (expected_message is null or sqlerrm=expected_message) then return; end if;
    raise exception 'Expected %, got %: % (SQL: %)',expected_state,sqlstate,sqlerrm,statement;
  end;
  raise exception 'Expected failure %: %',expected_state,statement;
end $$;

do $$ begin
  if exists(select 1 from public.hotels where slug like 's521-%')
    or exists(select 1 from auth.users where email like 's521-%@example.invalid') then
    raise exception '52.1 fixture collision'; end if;
end $$;
insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
 ('52100000-0000-4000-8000-000000000001','S521 A','Recife','s521-a','s521a','active'),
 ('52100000-0000-4000-8000-000000000002','S521 B','Recife','s521-b','s521b','active');
do $$ begin
  assert not exists(select 1 from public.hotel_module_entitlements where hotel_id in
    ('52100000-0000-4000-8000-000000000001','52100000-0000-4000-8000-000000000002') and module_key='content.tourism'),
    'new hotels must not receive tourism';
end $$;
-- Synthetic opt-in solely for testing: never in the migration or a remote database.
insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at,disabled_at)
select h.id,m.key,true,now(),null from public.hotels h cross join
 (values('core.directory'),('content.tourism'),('content.languages')) m(key)
where h.slug in ('s521-a','s521-b')
on conflict(hotel_id,module_key) do update set is_enabled=true,enabled_at=now(),disabled_at=null;

do $$ begin
  if (select is_nullable='NO' from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id') then
    insert into auth.instances select (jsonb_populate_record(null::auth.instances,jsonb_build_object(
      'id','52120000-0000-4000-8000-000000000001','uuid','52120000-0000-4000-8000-000000000001',
      'raw_base_config','{}','created_at',now(),'updated_at',now()))).*;
  end if;
end $$;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select case when (select is_nullable='YES' from information_schema.columns where table_schema='auth' and table_name='users' and column_name='instance_id')
 then null::uuid else '52120000-0000-4000-8000-000000000001'::uuid end,
 id,'authenticated','authenticated',email,'',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()
from (values
 ('52110000-0000-4000-8000-000000000001'::uuid,'s521-viewer@example.invalid'),
 ('52110000-0000-4000-8000-000000000002'::uuid,'s521-operator@example.invalid'),
 ('52110000-0000-4000-8000-000000000003'::uuid,'s521-other@example.invalid'),
 ('52110000-0000-4000-8000-000000000004'::uuid,'s521-global@example.invalid')) u(id,email);
delete from public.profiles where id in ('52110000-0000-4000-8000-000000000001','52110000-0000-4000-8000-000000000002',
 '52110000-0000-4000-8000-000000000003','52110000-0000-4000-8000-000000000004');
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
 ('52110000-0000-4000-8000-000000000001','s521-viewer@example.invalid','Viewer','visualizador','52100000-0000-4000-8000-000000000001',true),
 ('52110000-0000-4000-8000-000000000002','s521-operator@example.invalid','Operator','operador','52100000-0000-4000-8000-000000000001',true),
 ('52110000-0000-4000-8000-000000000003','s521-other@example.invalid','Other','operador','52100000-0000-4000-8000-000000000002',true);
insert into public.platform_users(user_id,role,is_active) values ('52110000-0000-4000-8000-000000000004','platform_admin',true);

-- Constraints are exercised independently of RPC validation.
do $$ declare typ text; cat text; n integer:=0; begin
  for typ,cat in select * from (values
    ('PLACE','sights'),('PLACE','beaches_and_nature'),('PLACE','culture_and_history'),('PLACE','neighborhoods_and_regions'),('PLACE','shopping'),
    ('EXPERIENCE','tours'),('EXPERIENCE','local_culture'),('EXPERIENCE','nature_and_adventure'),('EXPERIENCE','nightlife'),('EXPERIENCE','wellness'),
    ('GASTRONOMY','restaurants'),('GASTRONOMY','bars'),('GASTRONOMY','cafes_and_bakeries'),('GASTRONOMY','local_cuisine'),('GASTRONOMY','markets_and_fairs')) p(t,c) loop
    n:=n+1;
    insert into public.hotel_tourism_items(hotel_id,slug,name,type,category_key,short_description)
      values('52100000-0000-4000-8000-000000000001','pair-'||n,'Pair',typ,cat,'Description');
  end loop;
  assert n=15;
  delete from public.hotel_tourism_items where slug like 'pair-%';
  perform pg_temp.expect_error($s$insert into public.hotel_tourism_items(hotel_id,slug,name,type,category_key,short_description)
    values('52100000-0000-4000-8000-000000000001','../bad','X','PLACE','sights','D')$s$,'23514');
end $$;
insert into public.hotel_tourism_items(id,hotel_id,slug,name,type,category_key,short_description) values
 ('52130000-0000-4000-8000-000000000001','52100000-0000-4000-8000-000000000001','same-slug','A','PLACE','sights','Description'),
 ('52130000-0000-4000-8000-000000000002','52100000-0000-4000-8000-000000000002','same-slug','B','PLACE','sights','Description');
do $$ declare col text; lim integer; begin
  assert (select not is_published from public.hotel_tourism_items where id='52130000-0000-4000-8000-000000000001');
  perform pg_temp.expect_error($s$insert into public.hotel_tourism_items(hotel_id,slug,name,type,category_key,short_description)
    values('52100000-0000-4000-8000-000000000001','same-slug','C','PLACE','sights','D')$s$,'23505');
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set slug='changed'$s$,'22023');
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set hotel_id='52100000-0000-4000-8000-000000000002'$s$,'22023');
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set category_key='restaurants' where type='PLACE'$s$,'23514');
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set category_key='free'$s$,'23514');
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set type='FREE'$s$,'23514');
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set sort_order=-1$s$,'23514');
  for col,lim in select * from (values('name',160),('short_description',500),('full_description',10000),('address',500),
    ('opening_hours',1000),('price_info',300),('duration_info',200)) v(c,l) loop
    perform pg_temp.expect_error(format('update public.hotel_tourism_items set %I=%L',col,''),'23514');
    perform pg_temp.expect_error(format('update public.hotel_tourism_items set %I=%L',col,repeat('x',lim+1)),'23514');
    execute format('update public.hotel_tourism_items set %I=%L where id=%L',col,repeat('x',lim),'52130000-0000-4000-8000-000000000001');
  end loop;
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set name=null$s$,'23502');
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set short_description=null$s$,'23502');
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set name='<script>alert(1)</script>'$s$,'23514');
  foreach col in array array['phone','whatsapp_number'] loop
    perform pg_temp.expect_error(format('update public.hotel_tourism_items set %I=%L',col,'+0123'),'23514');
    perform pg_temp.expect_error(format('update public.hotel_tourism_items set %I=%L',col,'+1234567890123456'),'23514');
    execute format('update public.hotel_tourism_items set %I=%L',col,'+5511999999999');
  end loop;
  foreach col in array array['map_url','official_website_url'] loop
    perform pg_temp.expect_error(format('update public.hotel_tourism_items set %I=%L',col,'javascript:alert(1)'),'23514');
    perform pg_temp.expect_error(format('update public.hotel_tourism_items set %I=%L',col,'https://user:pass@example.com'),'23514');
    perform pg_temp.expect_error(format('update public.hotel_tourism_items set %I=%L',col,E'https://example.com/\nx'),'23514');
    perform pg_temp.expect_error(format('update public.hotel_tourism_items set %I=%L',col,'https://example.com/'||repeat('x',2048)),'23514');
    execute format('update public.hotel_tourism_items set %I=%L',col,'https://example.com/path?q=test');
  end loop;
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set main_image_path='other/tourism/a.png'$s$,'23514');
  update public.hotel_tourism_items set main_image_path=hotel_id::text||'/tourism/'||id::text||'/52140000-0000-4000-8000-000000000001.webp';
  update public.hotel_tourism_items set main_image_path=null;
  update public.hotel_tourism_items set featured=true,recommended_by_hotel=true;
  assert (select count(*)=2 from public.hotel_tourism_items where featured and recommended_by_hotel and sort_order=0);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
do $$ declare a public.hotel_tourism_items; b public.hotel_tourism_items; original_revision timestamptz; n integer; begin
  select * into strict a from public.save_current_hotel_tourism_item(null,'{"name":"Pão de Açúcar","type":"PLACE","category_key":"sights","short_description":"Descrição","full_description":"Completa","address":"  "}');
  assert a.slug='pao-de-acucar' and a.sort_order=1 and a.address is null and not a.is_published;
  perform set_config('test.s521_id',a.id::text,true);
  select * into strict b from public.save_current_hotel_tourism_item(null,'{"name":"Pão de Açúcar","type":"PLACE","category_key":"sights","short_description":"Descrição"}');
  assert b.slug<>a.slug and length(b.slug)<=100 and b.sort_order=2;
  perform pg_temp.expect_error($s$select public.save_current_hotel_tourism_item(null,'{"hotel_id":"52100000-0000-4000-8000-000000000002"}')$s$,'22023');
  perform pg_temp.expect_error(format('select public.save_current_hotel_tourism_item(%L,%L,%L)',a.id,'{"slug":"bad"}',a.updated_at),'22023');
  perform pg_temp.expect_error(format('select public.save_current_hotel_tourism_item(%L,%L,%L)',a.id,'{"main_image_path":"bad"}',a.updated_at),'22023');
  perform pg_temp.expect_error($s$select public.save_current_hotel_tourism_item('52130000-0000-4000-8000-000000000002','{"name":"Other"}',now())$s$,'P0002');
  assert public.save_current_hotel_tourism_translation(a.id,'en',a.updated_at,'{"name":"Sugarloaf","short_description":"Description","full_description":"Full"}');
  original_revision:=a.updated_at;
  select * into strict a from public.save_current_hotel_tourism_item(a.id,'{"name":"Nome novo","featured":true,"recommended_by_hotel":true,"is_published":true}',a.updated_at);
  assert a.slug='pao-de-acucar' and a.sort_order=1 and a.updated_at>original_revision;
  assert (select name is null and short_description='Description' and full_description='Full' from public.hotel_tourism_item_translations where item_id=a.id);
  assert not public.save_current_hotel_tourism_translation(a.id,'en',original_revision,'{"name":"STALE"}');
  assert public.save_current_hotel_tourism_translation(a.id,'es',a.updated_at,'{"name":"Nombre"}');
  select * into a from public.save_current_hotel_tourism_item(a.id,'{"name":"Nome transitório"}',a.updated_at);
  assert not exists(select 1 from public.hotel_tourism_item_translations where item_id=a.id and language='es');
  select * into a from public.save_current_hotel_tourism_item(a.id,'{"name":"Nome novo"}',a.updated_at);
  assert public.save_current_hotel_tourism_translation(a.id,'es',a.updated_at,'{"name":"Nombre"}');
  perform pg_temp.expect_error(format('select public.save_current_hotel_tourism_translation(%L,%L,%L,%L)',a.id,'pt',a.updated_at,'{"name":"PT"}'),'22023');
  perform pg_temp.expect_error(format('select public.save_current_hotel_tourism_translation(%L,%L,%L,%L)',a.id,'es',a.updated_at,'{"name":null}'),'23514');
  perform pg_temp.expect_error(format('select public.save_current_hotel_tourism_item(%L,%L,%L)',a.id,'{"name":"Nome novo"}',original_revision),'40001');
  perform pg_temp.expect_error(format('select public.delete_current_hotel_tourism_item(%L,%L)',a.id,original_revision),'40001');
  perform pg_temp.expect_error(format('select public.reorder_current_hotel_tourism_items(array[%L,%L,%L]::uuid[])',a.id,a.id,b.id),'22023');
  perform pg_temp.expect_error(format('select public.reorder_current_hotel_tourism_items(array[%L]::uuid[])',a.id),'22023');
  perform pg_temp.expect_error(format('select public.reorder_current_hotel_tourism_items(array[%L,%L,%L]::uuid[])',a.id,b.id,'52130000-0000-4000-8000-000000000002'),'22023');
  perform public.reorder_current_hotel_tourism_items(array[b.id,a.id,'52130000-0000-4000-8000-000000000001']::uuid[]);
  assert (select sort_order=0 from public.hotel_tourism_items where id=b.id);
  select * into a from public.hotel_tourism_items where id=a.id;
  perform set_config('test.s521_revision',a.updated_at::text,true);
  perform pg_temp.expect_error($s$insert into public.hotel_tourism_items(hotel_id,slug,name,type,category_key,short_description) values('52100000-0000-4000-8000-000000000001','direct','X','PLACE','sights','Y')$s$,'42501');
  perform pg_temp.expect_error($s$update public.hotel_tourism_items set name='Direct'$s$,'42501');
  perform pg_temp.expect_error($s$delete from public.hotel_tourism_items$s$,'42501');
  perform pg_temp.expect_error($s$delete from public.hotel_tourism_item_translations$s$,'42501');
end $$;
reset role;

-- Translation identity, uniqueness, bounds and UUID defaults.
do $$ declare col text; lim integer; item uuid:=current_setting('test.s521_id')::uuid; begin
  assert (select id is not null from public.hotel_tourism_item_translations where item_id=item and language='en');
  perform pg_temp.expect_error(format('insert into public.hotel_tourism_item_translations(item_id,language,name) values(%L,%L,%L)',item,'en','Duplicate'),'23505');
  perform pg_temp.expect_error($s$update public.hotel_tourism_item_translations set language='es' where language='en'$s$,'22023');
  perform pg_temp.expect_error($s$update public.hotel_tourism_item_translations set item_id='52130000-0000-4000-8000-000000000002'$s$,'22023');
  for col,lim in select * from (values('name',240),('short_description',750),('full_description',15000),('opening_hours',1500),('price_info',450),('duration_info',300)) v(c,l) loop
    perform pg_temp.expect_error(format('update public.hotel_tourism_item_translations set %I=%L',col,''),'23514');
    perform pg_temp.expect_error(format('update public.hotel_tourism_item_translations set %I=%L',col,repeat('x',lim+1)),'23514');
  end loop;
end $$;

-- Empty patches must fail with the exact controlled error and no persistent side effects.
-- Capture as owner because an operator intentionally cannot read admin_audit_log.
do $$
declare
  item uuid:=current_setting('test.s521_id')::uuid;
  new_translation_item uuid:='52130000-0000-4000-8000-000000000001';
  revision timestamptz;
  new_revision timestamptz;
  items_before jsonb;
  translations_before jsonb;
  audits_before bigint;
  statement text;
begin
  select updated_at into revision from public.hotel_tourism_items where id=item;
  select updated_at into new_revision from public.hotel_tourism_items where id=new_translation_item;
  assert exists(select 1 from public.hotel_tourism_item_translations where item_id=item and language='en');
  assert not exists(select 1 from public.hotel_tourism_item_translations where item_id=new_translation_item);
  select jsonb_agg(to_jsonb(i) order by id) into items_before from public.hotel_tourism_items i;
  select jsonb_agg(to_jsonb(t) order by id) into translations_before from public.hotel_tourism_item_translations t;
  select count(*) into audits_before from public.admin_audit_log;
  foreach statement in array array[
    $s$select public.save_current_hotel_tourism_item(null,'{}')$s$,
    format('select public.save_current_hotel_tourism_item(%L,%L,%L)',item,'{}',revision),
    format('select public.save_current_hotel_tourism_translation(%L,%L,%L,%L)',new_translation_item,'en',new_revision,'{}'),
    format('select public.save_current_hotel_tourism_translation(%L,%L,%L,%L)',item,'en',revision,'{}')
  ] loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
    perform pg_temp.expect_error(statement,'22023','tourism_patch_empty');
    execute 'reset role';
    assert (select jsonb_agg(to_jsonb(i) order by id) from public.hotel_tourism_items i) is not distinct from items_before,
      'empty patch changed item content, count or updated_at';
    assert (select jsonb_agg(to_jsonb(t) order by id) from public.hotel_tourism_item_translations t) is not distinct from translations_before,
      'empty patch changed translation content, count or updated_at';
    assert (select count(*) from public.admin_audit_log)=audits_before, 'empty patch created audit';
  end loop;
  -- Nonempty patches, including normalized NULL, retain their existing semantics.
  assert tourism_private.checked_patch('{"address":"  "}')='{"address":null}'::jsonb;
  assert tourism_private.checked_patch('{"name":"Nome novo"}')='{"name":"Nome novo"}'::jsonb;
  assert tourism_private.checked_patch('{"name":"Sugarloaf"}',true)='{"name":"Sugarloaf"}'::jsonb;
end $$;

-- Verify public rules independently, toggling one predicate at a time as fixture owner.
set local role anon;
do $$ begin
  assert (select count(*)=1 from public.hotel_tourism_items where hotel_id='52100000-0000-4000-8000-000000000001');
  assert (select count(*)=2 from public.hotel_tourism_item_translations);
end $$;
reset role;
update public.hotel_module_entitlements set is_enabled=false,enabled_at=null,enabled_by=null,disabled_at=now() where hotel_id='52100000-0000-4000-8000-000000000001' and module_key='content.languages';
set local role anon;
do $$ begin assert (select count(*)=0 from public.hotel_tourism_item_translations); end $$;
reset role;
update public.hotel_module_entitlements set is_enabled=true,enabled_at=now(),disabled_at=null where hotel_id='52100000-0000-4000-8000-000000000001' and module_key='content.languages';
update public.hotels set platform_status='suspended' where id='52100000-0000-4000-8000-000000000001';
set local role anon;
do $$ begin assert (select count(*)=0 from public.hotel_tourism_items); assert (select count(*)=0 from public.hotel_tourism_item_translations); end $$;
reset role;
update public.hotels set platform_status='active' where id='52100000-0000-4000-8000-000000000001';
update public.hotel_module_entitlements set is_enabled=false,enabled_at=null,enabled_by=null,disabled_at=now() where hotel_id='52100000-0000-4000-8000-000000000001' and module_key='core.directory';
set local role anon;
do $$ begin assert (select count(*)=0 from public.hotel_tourism_items); end $$;
reset role;
update public.hotel_module_entitlements set is_enabled=true,enabled_at=now(),disabled_at=null where hotel_id='52100000-0000-4000-8000-000000000001' and module_key='core.directory';
update public.hotel_module_entitlements set is_enabled=false,enabled_at=null,enabled_by=null,disabled_at=now() where hotel_id='52100000-0000-4000-8000-000000000001' and module_key='content.tourism';
set local role anon;
do $$ begin assert (select count(*)=0 from public.hotel_tourism_items); end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error($s$select public.save_current_hotel_tourism_item(null,'{}')$s$,'42501');
do $$ begin assert (select count(*)=0 from public.hotel_tourism_items); end $$;
reset role;
update public.hotel_module_entitlements set is_enabled=true,enabled_at=now(),disabled_at=null where hotel_id='52100000-0000-4000-8000-000000000001' and module_key='content.tourism';

set local role authenticated;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000001',true);
do $$ begin
  assert (select count(*)=3 from public.hotel_tourism_items where hotel_id='52100000-0000-4000-8000-000000000001');
  assert (select count(*)=0 from public.hotel_tourism_items where hotel_id='52100000-0000-4000-8000-000000000002');
end $$;
select pg_temp.expect_error($s$select public.save_current_hotel_tourism_item(null,'{}')$s$,'42501');
select pg_temp.expect_error($s$select public.reorder_current_hotel_tourism_items('{}')$s$,'42501');
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000004',true);
select pg_temp.expect_error($s$select public.save_current_hotel_tourism_item(null,'{}')$s$,'42501');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error($s$select public.save_current_hotel_tourism_item(null,'{}')$s$,'42501');
reset role;

-- Hotel lifecycle, disabled profiles and translation entitlement also gate RPCs.
update public.hotels set platform_status='archived' where id='52100000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error($s$select public.save_current_hotel_tourism_item(null,'{}')$s$,'42501');
do $$ begin assert (select count(*)=0 from public.hotel_tourism_items where hotel_id='52100000-0000-4000-8000-000000000001'); end $$;
reset role;
update public.hotels set platform_status='active' where id='52100000-0000-4000-8000-000000000001';
update public.profiles set is_active=false where id='52110000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.expect_error($s$select public.save_current_hotel_tourism_item(null,'{}')$s$,'42501');
reset role;
update public.profiles set is_active=true where id='52110000-0000-4000-8000-000000000002';

-- Deliberately reject audit insertion: the parent edit must roll back with it.
create function pg_temp.reject_tourism_audit() returns trigger language plpgsql as $$
begin if new.action like 'tourism.%' then raise exception using errcode='23514',message='test audit failure'; end if; return new; end $$;
create trigger s521_test_audit_failure before insert on public.admin_audit_log for each row execute function pg_temp.reject_tourism_audit();
set local role authenticated;
select set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error(format('select public.save_current_hotel_tourism_item(%L,%L,%L)',current_setting('test.s521_id'),'{"name":"MUST ROLLBACK"}',current_setting('test.s521_revision')),'23514');
select pg_temp.expect_error(format('select public.delete_current_hotel_tourism_item(%L,%L)',current_setting('test.s521_id'),current_setting('test.s521_revision')),'23514');
select pg_temp.expect_error($s$select public.save_current_hotel_tourism_item(null,'{"name":"MUST ROLLBACK","type":"PLACE","category_key":"sights","short_description":"Rollback"}')$s$,'23514');
do $$ begin assert (select name='Nome novo' from public.hotel_tourism_items where id=current_setting('test.s521_id')::uuid); end $$;
reset role;
drop trigger s521_test_audit_failure on public.admin_audit_log;

-- Reorder and translation must also roll back when the final audit write fails.
-- Snapshot as owner; the authenticated operator cannot inspect the audit table.
do $$
declare
  item uuid:=current_setting('test.s521_id')::uuid;
  new_translation_item uuid:='52130000-0000-4000-8000-000000000001';
  revision timestamptz;
  new_revision timestamptz;
  current_order uuid[];
  requested_order uuid[];
  items_before jsonb;
  translations_before jsonb;
  audits_before bigint;
  statement text;
begin
  select updated_at into strict revision from public.hotel_tourism_items where id=item;
  select updated_at into strict new_revision from public.hotel_tourism_items where id=new_translation_item;
  select array_agg(id order by sort_order,id),array_agg(id order by sort_order desc,id desc)
    into current_order,requested_order from public.hotel_tourism_items
    where hotel_id='52100000-0000-4000-8000-000000000001';
  assert cardinality(current_order)>1 and requested_order<>current_order, 'reorder must actually change the complete catalog';
  assert exists(select 1 from public.hotel_tourism_item_translations where item_id=item and language='en');
  assert not exists(select 1 from public.hotel_tourism_item_translations where item_id=new_translation_item and language='en');
  select jsonb_agg(to_jsonb(i) order by id) into items_before from public.hotel_tourism_items i;
  select jsonb_agg(to_jsonb(t) order by id) into translations_before from public.hotel_tourism_item_translations t;
  select count(*) into audits_before from public.admin_audit_log;
  execute 'create trigger s521_test_audit_failure before insert on public.admin_audit_log for each row execute function pg_temp.reject_tourism_audit()';
  foreach statement in array array[
    format('select public.reorder_current_hotel_tourism_items(%L::uuid[])',requested_order),
    format('select public.save_current_hotel_tourism_translation(%L,%L,%L,%L)',item,'en',revision,'{"name":"Audit rollback UPDATE"}'),
    format('select public.save_current_hotel_tourism_translation(%L,%L,%L,%L)',new_translation_item,'en',new_revision,'{"name":"Audit rollback INSERT"}')
  ] loop
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub','52110000-0000-4000-8000-000000000002',true);
    perform pg_temp.expect_error(statement,'23514','test audit failure');
    execute 'reset role';
    assert (select jsonb_agg(to_jsonb(i) order by id) from public.hotel_tourism_items i) is not distinct from items_before,
      'audit failure changed item sort_order, content or timestamps';
    assert (select jsonb_agg(to_jsonb(t) order by id) from public.hotel_tourism_item_translations t) is not distinct from translations_before,
      'audit failure changed translation rows, content or timestamps';
    assert (select count(*) from public.admin_audit_log)=audits_before, 'audit failure persisted an additional audit';
  end loop;
  execute 'drop trigger s521_test_audit_failure on public.admin_audit_log';
end $$;

set local role authenticated;
do $$ declare a public.hotel_tourism_items; begin
  select * into a from public.hotel_tourism_items where id=current_setting('test.s521_id')::uuid;
  select * into a from public.save_current_hotel_tourism_item(a.id,'{"is_published":false}',a.updated_at);
  assert (select count(*)=2 from public.hotel_tourism_item_translations where item_id=a.id);
  perform public.delete_current_hotel_tourism_item(a.id,a.updated_at);
  assert not exists(select 1 from public.hotel_tourism_items where id=a.id);
  assert not exists(select 1 from public.hotel_tourism_item_translations where item_id=a.id);
end $$;
reset role;
do $$ declare rpc_signature text; begin
  assert exists(select 1 from public.admin_audit_log where entity_id=current_setting('test.s521_id')::uuid and action='tourism.deleted');
  assert not exists(select 1 from public.admin_audit_log a cross join lateral jsonb_object_keys(a.metadata) k
    where a.action like 'tourism.%' and k not in ('type','category_key','featured','recommended_by_hotel','is_published','item_count','language'));
  assert not has_table_privilege('authenticated','public.hotel_tourism_items','INSERT');
  assert not has_table_privilege('authenticated','public.hotel_tourism_items','UPDATE');
  assert not has_table_privilege('authenticated','public.hotel_tourism_items','DELETE');
  assert not has_table_privilege('authenticated','public.hotel_tourism_item_translations','INSERT');
  assert not has_table_privilege('authenticated','public.hotel_tourism_item_translations','UPDATE');
  assert not has_table_privilege('authenticated','public.hotel_tourism_item_translations','DELETE');
  foreach rpc_signature in array array[
    'public.save_current_hotel_tourism_item(uuid,jsonb,timestamptz)',
    'public.reorder_current_hotel_tourism_items(uuid[])',
    'public.delete_current_hotel_tourism_item(uuid,timestamptz)',
    'public.save_current_hotel_tourism_translation(uuid,text,timestamptz,jsonb)'
  ] loop
    assert not has_function_privilege('anon',rpc_signature,'EXECUTE'), 'anon can execute '||rpc_signature;
    assert not has_function_privilege('service_role',rpc_signature,'EXECUTE'), 'service_role can execute '||rpc_signature;
    assert has_function_privilege('authenticated',rpc_signature,'EXECUTE'), 'authenticated cannot execute '||rpc_signature;
  end loop;
end $$;
rollback;
