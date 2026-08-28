-- Disposable/local database only. Every synthetic change rolls back.
begin;

do $$
declare
  nullable_instance boolean;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='hotel_sections' and column_name='operational_key'
  ) then
    raise exception '52 operational key behavior: migration missing';
  end if;
  select is_nullable='YES' into strict nullable_instance
  from information_schema.columns
  where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance and to_regclass('auth.instances') is null then
    raise exception '52 operational key behavior: auth.instances missing';
  end if;
  if exists(select 1 from auth.users where email like 's52-%@example.invalid')
    or exists(select 1 from public.hotels where slug like 's52-%') then
    raise exception '52 operational key behavior: fixture collision';
  end if;
end
$$;

do $$
declare
  nullable_instance boolean;
begin
  select is_nullable='YES' into strict nullable_instance
  from information_schema.columns
  where table_schema='auth' and table_name='users' and column_name='instance_id';
  if not nullable_instance then
    insert into auth.instances
    select (jsonb_populate_record(null::auth.instances,jsonb_build_object(
      'id','52720000-0000-4000-8000-000000000001',
      'uuid','52720000-0000-4000-8000-000000000001',
      'raw_base_config','{}','created_at',now(),'updated_at',now()
    ))).*;
  end if;
end
$$;

insert into public.hotels(id,name,city,slug,subdomain,platform_status) values
  ('52700000-0000-4000-8000-000000000001','S52 Hotel A','Rio de Janeiro','s52-hotel-a','s52a','active'),
  ('52700000-0000-4000-8000-000000000002','S52 Hotel B','Salvador','s52-hotel-b','s52b','active');

insert into public.hotel_module_entitlements(hotel_id,module_key,is_enabled,enabled_at) values
  ('52700000-0000-4000-8000-000000000001','core.directory',true,now()),
  ('52700000-0000-4000-8000-000000000001','content.services',true,now()),
  ('52700000-0000-4000-8000-000000000002','core.directory',true,now()),
  ('52700000-0000-4000-8000-000000000002','content.services',true,now())
on conflict on constraint hotel_module_entitlements_pkey do update set
  is_enabled=true,enabled_at=excluded.enabled_at,disabled_at=null,disabled_by=null;

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select case when (
  select is_nullable='YES' from information_schema.columns
  where table_schema='auth' and table_name='users' and column_name='instance_id'
) then null::uuid else '52720000-0000-4000-8000-000000000001'::uuid end,
id,'authenticated','authenticated',email,'',now(),
'{"provider":"email","providers":["email"]}','{}',now(),now()
from (values
  ('52710000-0000-4000-8000-000000000001'::uuid,'s52-editor-a@example.invalid'),
  ('52710000-0000-4000-8000-000000000002'::uuid,'s52-editor-b@example.invalid'),
  ('52710000-0000-4000-8000-000000000003'::uuid,'s52-operator-a@example.invalid')
) users(id,email);

delete from public.profiles where id=any(array[
  '52710000-0000-4000-8000-000000000001',
  '52710000-0000-4000-8000-000000000002',
  '52710000-0000-4000-8000-000000000003'
]::uuid[]);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active) values
  ('52710000-0000-4000-8000-000000000001','s52-editor-a@example.invalid','S52 Editor A','editor','52700000-0000-4000-8000-000000000001',true),
  ('52710000-0000-4000-8000-000000000002','s52-editor-b@example.invalid','S52 Editor B','editor','52700000-0000-4000-8000-000000000002',true),
  ('52710000-0000-4000-8000-000000000003','s52-operator-a@example.invalid','S52 Operator A','operador','52700000-0000-4000-8000-000000000001',true);

insert into public.hotel_sections(id,hotel_id,title,content,service_action_type,operational_key,enabled,sort_order) values
  ('52730000-0000-4000-8000-000000000001','52700000-0000-4000-8000-000000000002','Hotel B service','Editorial','standard',null,true,1);

set local role authenticated;
select set_config('request.jwt.claim.sub','52710000-0000-4000-8000-000000000001',true);

-- A matching title never classifies a service automatically.
insert into public.hotel_sections(hotel_id,title,content,service_action_type,enabled,sort_order) values
  ('52700000-0000-4000-8000-000000000001','Café da manhã','Editorial','standard',true,1);
do $$ begin
  if (select operational_key from public.hotel_sections where hotel_id='52700000-0000-4000-8000-000000000001' and title='Café da manhã') is not null then
    raise exception '52 operational key behavior: title caused automatic classification';
  end if;
end $$;

insert into public.hotel_sections(hotel_id,title,content,service_action_type,operational_key,enabled,sort_order) values
  ('52700000-0000-4000-8000-000000000001','Editorial breakfast','Editorial','standard','breakfast',true,2);

do $$ begin
  begin
    insert into public.hotel_sections(hotel_id,title,service_action_type,operational_key,enabled)
    values('52700000-0000-4000-8000-000000000001','Invalid catalog','standard','restaurant',true);
    raise exception '52 operational key behavior: open catalog accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.hotel_sections(hotel_id,title,service_action_type,operational_key,enabled)
    values('52700000-0000-4000-8000-000000000001','Duplicate breakfast','standard','breakfast',true);
    raise exception '52 operational key behavior: duplicate hotel key accepted';
  exception when unique_violation then null;
  end;
end $$;

do $$ declare affected integer; begin
  update public.hotel_sections set operational_key='breakfast'
  where id='52730000-0000-4000-8000-000000000001';
  get diagnostics affected=row_count;
  if affected<>0 then
    raise exception '52 operational key behavior: editor changed another hotel';
  end if;
end $$;

-- The same semantic key is valid for another hotel.
select set_config('request.jwt.claim.sub','52710000-0000-4000-8000-000000000002',true);
insert into public.hotel_sections(hotel_id,title,content,service_action_type,operational_key,enabled,sort_order) values
  ('52700000-0000-4000-8000-000000000002','Breakfast','Editorial','standard','breakfast',true,2);

-- An operator can manage ordinary service fields but cannot change semantic identity.
select set_config('request.jwt.claim.sub','52710000-0000-4000-8000-000000000003',true);
update public.hotel_sections set title='Café editorial atualizado'
where hotel_id='52700000-0000-4000-8000-000000000001' and title='Café da manhã';
do $$ begin
  begin
    update public.hotel_sections set operational_key='breakfast'
    where hotel_id='52700000-0000-4000-8000-000000000001' and title='Café editorial atualizado';
    raise exception '52 operational key behavior: operator changed semantic identity';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role anon;
do $$ begin
  begin
    update public.hotel_sections set operational_key=null
    where title='Editorial breakfast';
    raise exception '52 operational key behavior: anon changed semantic identity';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
