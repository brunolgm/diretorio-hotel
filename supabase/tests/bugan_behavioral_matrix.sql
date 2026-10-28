-- Local/disposable only; use bugan_local_lab.ps1 for pre-migration snapshots.
begin;
do $$ begin
  assert not exists((select * from public.hotels except select * from bugan_before_hotels)
    union all (select * from bugan_before_hotels except select * from public.hotels)), 'existing hotels changed';
  assert not exists((select * from public.hotel_experience_layout except select * from bugan_before_layout)
    union all (select * from bugan_before_layout except select * from public.hotel_experience_layout)), 'existing layouts changed';
  assert not exists((select * from public.hotel_module_entitlements except select * from bugan_before_entitlements)
    union all (select * from bugan_before_entitlements except select * from public.hotel_module_entitlements)), 'entitlements changed';
  assert not exists(select 1 from bugan_before_acl b join pg_proc p on p.oid=b.oid
    where p.proacl is distinct from b.proacl or p.prosecdef is distinct from b.prosecdef or p.proconfig is distinct from b.proconfig), 'RPC security changed';
  assert (select relrowsecurity from pg_class where oid='public.hotels'::regclass), 'RLS disabled';
end $$;

insert into public.hotels(id,name,city,slug,subdomain,brand_code,platform_status)
select ('b0600000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
  'Synthetic brand test','Recife, PE','bugan-test-'||i,'bugan-test-'||i,brand,'draft'
from (values (1,'bugan'),(2,'grand-mercure'),(3,'novotel'),(4,'mercure'),(5,null)) t(i,brand);
do $$ begin
  begin
    insert into public.hotels(name,slug,brand_code) values('Invalid','bugan-test-invalid','bugan-recife');
    raise exception 'invalid brand accepted';
  exception when check_violation then null; end;
  assert (select position from public.hotel_experience_layout where hotel_id='b0600000-0000-4000-8000-000000000001' and block_key='hero')=1;
  assert (select position from public.hotel_experience_layout where hotel_id='b0600000-0000-4000-8000-000000000001' and block_key='banners')=8;
  assert not exists(select 1 from public.public_hotels where slug like 'bugan-test-%'), 'draft visible publicly';
end $$;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('b0610000-0000-4000-8000-000000000001','authenticated','authenticated','bugan-test-platform@example.invalid','{}','{}',now(),now()),
('b0610000-0000-4000-8000-000000000002','authenticated','authenticated','bugan-test-admin@example.invalid','{}','{}',now(),now()),
('b0610000-0000-4000-8000-000000000003','authenticated','authenticated','bugan-test-other@example.invalid','{}','{}',now(),now());
insert into public.platform_users(user_id,role,is_active) values ('b0610000-0000-4000-8000-000000000001','platform_admin',true);
insert into public.profiles(id,email,full_name,role,hotel_id,is_active)
values ('b0610000-0000-4000-8000-000000000003','bugan-test-other@example.invalid','Other','administrador','b0600000-0000-4000-8000-000000000002',true)
on conflict(id) do update set hotel_id=excluded.hotel_id,role=excluded.role,is_active=true;

set local role authenticated;
select set_config('request.jwt.claim.sub','b0610000-0000-4000-8000-000000000001',true);
select * from public.create_platform_hotel_onboarding('Synthetic Bugan','Recife, PE','bugan-test-onboard','bugan-test-onboard','bugan',null,
  'b0610000-0000-4000-8000-000000000002','bugan-test-admin@example.invalid','Synthetic Admin');
select * from public.update_platform_hotel_brand('b0600000-0000-4000-8000-000000000002','bugan');
do $$ begin
  begin
    perform * from public.update_platform_hotel_brand('b0600000-0000-4000-8000-000000000002','invalid');
    raise exception 'invalid governance brand accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ declare target uuid; begin
  select id into strict target from public.hotels where slug='bugan-test-onboard';
  assert (select platform_status='draft' and theme_preset='bugan' from public.hotels where id=target);
  assert (select count(*) from public.hotel_module_entitlements where hotel_id=target and is_enabled)=12;
  assert not exists(select 1 from public.hotel_module_entitlements where hotel_id=target and is_enabled and module_key in ('travel.flights','content.tourism','analytics.advanced'));
  assert (select hotel_id=target and role='administrador' from public.profiles where id='b0610000-0000-4000-8000-000000000002');
  assert exists(select 1 from public.platform_audit_log where entity_id=target and action='hotel.created');
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','b0610000-0000-4000-8000-000000000003',true);
do $$ begin
  assert not exists(select 1 from public.hotels where slug='bugan-test-onboard'), 'cross-tenant leak';
  begin
    perform * from public.update_platform_hotel_brand('b0600000-0000-4000-8000-000000000001','mercure');
    raise exception 'hotel admin changed platform brand';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.create_platform_hotel_onboarding('Rejected','Recife','bugan-test-denied','bugan-test-denied','bugan',null,
      'b0610000-0000-4000-8000-000000000002','bugan-test-admin@example.invalid','Synthetic Admin');
    raise exception 'hotel admin onboarded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  assert not exists(select 1 from public.public_hotels where slug='bugan-test-onboard');
  begin
    perform * from public.update_platform_hotel_brand('b0600000-0000-4000-8000-000000000001','mercure');
    raise exception 'anon changed brand';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
