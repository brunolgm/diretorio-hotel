-- Sprint 53: additive, consultative F&B. No tenant/content/entitlement backfill.
-- Availability remains coming_soon until all local closure gates pass.
begin;
do $$ begin
 if to_regprocedure('public.has_active_hotel_role(uuid,text)') is null
 or to_regprocedure('public.is_hotel_module_enabled(uuid,text)') is null
 or to_regprocedure('public.record_admin_audit_event(uuid,uuid,text,text,uuid,jsonb,text)') is null
 then raise exception '53 preflight: canonical authorization/audit contracts missing'; end if;
 if not exists(select 1 from pg_catalog.pg_class where oid=to_regclass('storage.objects') and relrowsecurity)
 or exists(select 1 from pg_catalog.pg_policies p where p.schemaname='storage' and p.tablename='objects'
  and p.cmd in ('ALL','INSERT','UPDATE','DELETE') and (
   p.roles && array['public','anon','authenticated']::name[]
   or exists(select 1 from pg_catalog.pg_roles r where r.rolname=any(p.roles)
    and (pg_has_role('anon',r.rolname,'MEMBER') or pg_has_role('authenticated',r.rolname,'MEMBER'))))
  and not ((coalesce(p.qual,'')||' '||coalesce(p.with_check,'')) not ilike '%hotel-assets%'
   and (coalesce(p.qual,'')||' '||coalesce(p.with_check,'')) ~* 'bucket_id[[:space:]]*=[[:space:]]*''[a-z0-9][a-z0-9._-]*''(::text)?'
   and (coalesce(p.qual,'')||' '||coalesce(p.with_check,'')) !~* '(^|[^a-z_])(or|not)([^a-z_]|$)'))
 then raise exception '53 preflight: Storage hotel-assets must remain server-only'; end if;
end $$;
-- Reuse the canonical composite identity introduced by service_room_guides.
-- The legacy PK(id) alone is not a composite referenced key.
do $$ begin
 if not exists(select 1 from pg_catalog.pg_constraint c
  where c.conrelid=to_regclass('public.hotel_sections') and c.contype='u' and c.convalidated
  and c.conkey=array[
   (select attnum from pg_catalog.pg_attribute where attrelid=c.conrelid and attname='id'),
   (select attnum from pg_catalog.pg_attribute where attrelid=c.conrelid and attname='hotel_id')])
 then raise exception '53 preflight: canonical Service composite identity missing'; end if;
end $$;
create schema fb_private;
revoke all on schema fb_private from public,anon,authenticated,service_role;
create function fb_private.mutation_hotel() returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 select p.hotel_id into target from public.profiles p where p.id=auth.uid() and p.is_active for share;
 if target is null or not public.has_active_hotel_role(target,'operador') then raise exception using errcode='42501',message='fb_operator_required'; end if;
 perform 1 from public.hotels where id=target and platform_status<>'archived' for update;
 if not found or not public.is_hotel_module_enabled(target,'fb.menu') then raise exception using errcode='42501',message='fb_entitlement_required'; end if;
 return target;
end $$;
create function fb_private.public_hotel(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hotels where id=target and platform_status='active')
 and public.is_hotel_module_enabled(target,'core.directory') and public.is_hotel_module_enabled(target,'fb.menu');
$$;
create function fb_private.admin_hotel(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.has_active_hotel_role(target,'visualizador') and public.is_hotel_module_enabled(target,'fb.menu')
 and exists(select 1 from public.hotels where id=target and platform_status<>'archived');
$$;
grant usage on schema fb_private to authenticated;
grant execute on function fb_private.admin_hotel(uuid) to authenticated;
create function fb_private.safe_url(v text) returns boolean language sql immutable set search_path='' as $$
 select v is null or (length(v)<=2048 and v ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#]|$)' and v !~ '[[:cntrl:][:space:]\\]' and split_part(split_part(v,'/',3),'?',1) !~ '@');
$$;

create table public.hotel_fb_outlets(
 id uuid primary key default gen_random_uuid(),
 hotel_id uuid not null references public.hotels(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 160),
 type text not null default 'restaurant' check(type in ('restaurant','bar','room_service','breakfast','cafe','other')),
 short_description text,
 full_description text,
 opening_hours text,
 location_info text,
 main_image_path text,
 is_featured boolean not null default false,
 action_type text not null default 'none' check(action_type in ('none','service','external_url')),
 external_url text,
 is_published boolean not null default false,
 sort_order integer not null default 0 check(sort_order between 0 and 100000),
 revision integer not null default 1 check(revision>0),
 source_revision integer not null default 1 check(source_revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(hotel_id,id),
 check(fb_private.safe_url(external_url)),
 check((action_type='external_url' and external_url is not null) or (action_type<>'external_url' and external_url is null)),
 check(main_image_path is null or main_image_path ~ ('^'||hotel_id::text||'/fb/outlet/'||id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'))
);
create index hotel_fb_outlets_order on public.hotel_fb_outlets(hotel_id,sort_order,id);
alter table public.hotel_fb_outlets enable row level security;
revoke all on public.hotel_fb_outlets from public,anon,authenticated,service_role;
grant select on public.hotel_fb_outlets to authenticated;
create policy fb_admin_read on public.hotel_fb_outlets for select to authenticated using(fb_private.admin_hotel(hotel_id));
create table public.hotel_fb_outlets_translations(hotel_id uuid not null,entity_id uuid not null,language text not null check(language in ('en','es')),source_revision integer not null,fields jsonb not null check(jsonb_typeof(fields)='object' and octet_length(fields::text)<=60000),updated_at timestamptz not null default now(),primary key(entity_id,language),foreign key(hotel_id,entity_id) references public.hotel_fb_outlets(hotel_id,id) on delete cascade);
create index hotel_fb_outlets_translations_hotel on public.hotel_fb_outlets_translations(hotel_id,entity_id,language);
alter table public.hotel_fb_outlets_translations enable row level security;
revoke all on public.hotel_fb_outlets_translations from public,anon,authenticated,service_role;
grant select on public.hotel_fb_outlets_translations to authenticated;
create policy fb_admin_read on public.hotel_fb_outlets_translations for select to authenticated using(fb_private.admin_hotel(hotel_id));
create table public.hotel_fb_menus(
 id uuid primary key default gen_random_uuid(),
 hotel_id uuid not null references public.hotels(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 160),
 short_description text,
 is_published boolean not null default false,
 sort_order integer not null default 0 check(sort_order between 0 and 100000),
 revision integer not null default 1 check(revision>0),
 source_revision integer not null default 1 check(source_revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(hotel_id,id)
);
create index hotel_fb_menus_order on public.hotel_fb_menus(hotel_id,sort_order,id);
alter table public.hotel_fb_menus enable row level security;
revoke all on public.hotel_fb_menus from public,anon,authenticated,service_role;
grant select on public.hotel_fb_menus to authenticated;
create policy fb_admin_read on public.hotel_fb_menus for select to authenticated using(fb_private.admin_hotel(hotel_id));
create table public.hotel_fb_menus_translations(hotel_id uuid not null,entity_id uuid not null,language text not null check(language in ('en','es')),source_revision integer not null,fields jsonb not null check(jsonb_typeof(fields)='object' and octet_length(fields::text)<=60000),updated_at timestamptz not null default now(),primary key(entity_id,language),foreign key(hotel_id,entity_id) references public.hotel_fb_menus(hotel_id,id) on delete cascade);
create index hotel_fb_menus_translations_hotel on public.hotel_fb_menus_translations(hotel_id,entity_id,language);
alter table public.hotel_fb_menus_translations enable row level security;
revoke all on public.hotel_fb_menus_translations from public,anon,authenticated,service_role;
grant select on public.hotel_fb_menus_translations to authenticated;
create policy fb_admin_read on public.hotel_fb_menus_translations for select to authenticated using(fb_private.admin_hotel(hotel_id));
create table public.hotel_fb_categories(
 id uuid primary key default gen_random_uuid(),
 hotel_id uuid not null references public.hotels(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 160),
 menu_id uuid not null,
 description text,
 is_published boolean not null default false,
 sort_order integer not null default 0 check(sort_order between 0 and 100000),
 revision integer not null default 1 check(revision>0),
 source_revision integer not null default 1 check(source_revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(hotel_id,id),
 foreign key(hotel_id,menu_id) references public.hotel_fb_menus(hotel_id,id) on delete cascade
);
create index hotel_fb_categories_order on public.hotel_fb_categories(hotel_id,menu_id,sort_order,id);
alter table public.hotel_fb_categories enable row level security;
revoke all on public.hotel_fb_categories from public,anon,authenticated,service_role;
grant select on public.hotel_fb_categories to authenticated;
create policy fb_admin_read on public.hotel_fb_categories for select to authenticated using(fb_private.admin_hotel(hotel_id));
create table public.hotel_fb_categories_translations(hotel_id uuid not null,entity_id uuid not null,language text not null check(language in ('en','es')),source_revision integer not null,fields jsonb not null check(jsonb_typeof(fields)='object' and octet_length(fields::text)<=60000),updated_at timestamptz not null default now(),primary key(entity_id,language),foreign key(hotel_id,entity_id) references public.hotel_fb_categories(hotel_id,id) on delete cascade);
create index hotel_fb_categories_translations_hotel on public.hotel_fb_categories_translations(hotel_id,entity_id,language);
alter table public.hotel_fb_categories_translations enable row level security;
revoke all on public.hotel_fb_categories_translations from public,anon,authenticated,service_role;
grant select on public.hotel_fb_categories_translations to authenticated;
create policy fb_admin_read on public.hotel_fb_categories_translations for select to authenticated using(fb_private.admin_hotel(hotel_id));
create table public.hotel_fb_items(
 id uuid primary key default gen_random_uuid(),
 hotel_id uuid not null references public.hotels(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 160),
 category_id uuid not null,
 short_description text,
 full_description text,
 price_amount_minor integer check(price_amount_minor between 0 and 100000000),
 currency text not null default 'BRL' check(currency = any(array['AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC','CUC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD','HKD','HNL','HRK','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KPW','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SLL','SOS','SRD','SSP','STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XCG','XDR','XOF','XPF','XSU','YER','ZAR','ZMW','ZWG','ZWL']::text[])),
 price_on_request boolean not null default false,
 allergens_info text,
 dietary_info text,
 is_available boolean not null default true,
 main_image_path text,
 is_published boolean not null default false,
 sort_order integer not null default 0 check(sort_order between 0 and 100000),
 revision integer not null default 1 check(revision>0),
 source_revision integer not null default 1 check(source_revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(hotel_id,id),
 foreign key(hotel_id,category_id) references public.hotel_fb_categories(hotel_id,id) on delete cascade,
 check(not price_on_request or price_amount_minor is null),
 check(main_image_path is null or main_image_path ~ ('^'||hotel_id::text||'/fb/item/'||id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'))
);
create index hotel_fb_items_order on public.hotel_fb_items(hotel_id,category_id,sort_order,id);
alter table public.hotel_fb_items enable row level security;
revoke all on public.hotel_fb_items from public,anon,authenticated,service_role;
grant select on public.hotel_fb_items to authenticated;
create policy fb_admin_read on public.hotel_fb_items for select to authenticated using(fb_private.admin_hotel(hotel_id));
create table public.hotel_fb_items_translations(hotel_id uuid not null,entity_id uuid not null,language text not null check(language in ('en','es')),source_revision integer not null,fields jsonb not null check(jsonb_typeof(fields)='object' and octet_length(fields::text)<=60000),updated_at timestamptz not null default now(),primary key(entity_id,language),foreign key(hotel_id,entity_id) references public.hotel_fb_items(hotel_id,id) on delete cascade);
create index hotel_fb_items_translations_hotel on public.hotel_fb_items_translations(hotel_id,entity_id,language);
alter table public.hotel_fb_items_translations enable row level security;
revoke all on public.hotel_fb_items_translations from public,anon,authenticated,service_role;
grant select on public.hotel_fb_items_translations to authenticated;
create policy fb_admin_read on public.hotel_fb_items_translations for select to authenticated using(fb_private.admin_hotel(hotel_id));

create table public.hotel_fb_outlet_menus(hotel_id uuid not null,outlet_id uuid not null,menu_id uuid not null,sort_order integer not null default 0 check(sort_order between 0 and 100000),
 primary key(outlet_id,menu_id),foreign key(hotel_id,outlet_id) references public.hotel_fb_outlets(hotel_id,id) on delete cascade,
 foreign key(hotel_id,menu_id) references public.hotel_fb_menus(hotel_id,id) on delete cascade);
create index hotel_fb_outlet_menus_menu on public.hotel_fb_outlet_menus(hotel_id,menu_id);
-- Existing UNIQUE(id,hotel_id) supports tenant consistency without another
-- legacy index build. No ALTER or data change on hotel_sections.
create table public.hotel_fb_service_links(hotel_id uuid not null,outlet_id uuid primary key,service_id uuid not null,
 foreign key(service_id,hotel_id) references public.hotel_sections(id,hotel_id) on delete cascade,
 foreign key(hotel_id,outlet_id) references public.hotel_fb_outlets(hotel_id,id) on delete cascade);
create index hotel_fb_service_links_service on public.hotel_fb_service_links(hotel_id,service_id);
create function fb_private.check_service_tenant() returns trigger language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from public.hotel_sections where id=new.service_id and hotel_id=new.hotel_id) then raise exception using errcode='23503',message='fb_service_tenant_mismatch'; end if; return new;
end $$;
create trigger fb_service_tenant before insert or update on public.hotel_fb_service_links for each row execute function fb_private.check_service_tenant();

alter table public.hotel_fb_outlet_menus enable row level security; revoke all on public.hotel_fb_outlet_menus from public,anon,authenticated,service_role; grant select on public.hotel_fb_outlet_menus to authenticated; create policy fb_admin_read on public.hotel_fb_outlet_menus for select to authenticated using(fb_private.admin_hotel(hotel_id));
alter table public.hotel_fb_service_links enable row level security; revoke all on public.hotel_fb_service_links from public,anon,authenticated,service_role; grant select on public.hotel_fb_service_links to authenticated; create policy fb_admin_read on public.hotel_fb_service_links for select to authenticated using(fb_private.admin_hotel(hotel_id));
create function fb_private.table_name(k text) returns text language plpgsql immutable set search_path='' as $$ begin case k when 'outlet' then return 'hotel_fb_outlets'; when 'menu' then return 'hotel_fb_menus'; when 'category' then return 'hotel_fb_categories'; when 'item' then return 'hotel_fb_items'; else raise exception using errcode='22023',message='fb_kind_invalid'; end case; end $$;
create function fb_private.text_fields(k text) returns text[] language plpgsql immutable set search_path='' as $$ begin case k when 'outlet' then return array['name','short_description','full_description','opening_hours','location_info']::text[]; when 'menu' then return array['name','short_description']::text[]; when 'category' then return array['name','description']::text[]; when 'item' then return array['name','short_description','full_description','allergens_info','dietary_info']::text[]; else raise exception using errcode='22023',message='fb_kind_invalid'; end case; end $$;
create function fb_private.checked_patch(k text,v jsonb,translation boolean default false) returns jsonb language plpgsql immutable set search_path='' as $$
declare allowed text[]; key text; value jsonb; lim integer;
begin
 if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>65000 then raise exception using errcode='22023',message='fb_patch_invalid'; end if;
 if translation then allowed:=fb_private.text_fields(k); else case k
when 'outlet' then allowed:=array['name','is_published','sort_order','type','short_description','full_description','opening_hours','location_info','main_image_path','is_featured','action_type','external_url']::text[];
when 'menu' then allowed:=array['name','is_published','sort_order','short_description']::text[];
when 'category' then allowed:=array['name','is_published','sort_order','menu_id','description']::text[];
when 'item' then allowed:=array['name','is_published','sort_order','category_id','short_description','full_description','price_amount_minor','currency','price_on_request','allergens_info','dietary_info','is_available','main_image_path']::text[];
else raise exception using errcode='22023',message='fb_kind_invalid'; end case; end if;
 for key,value in select * from jsonb_each(v) loop
 if not key=any(allowed) or (not translation and key='main_image_path') then raise exception using errcode='22023',message='fb_field_not_writable'; end if;
 if key in ('is_published','is_featured','is_available','price_on_request') then
  if jsonb_typeof(value)<>'boolean' then raise exception using errcode='22023',message='fb_boolean_required'; end if;
 elsif key in ('sort_order','price_amount_minor') then
  if value<>'null'::jsonb and (jsonb_typeof(value)<>'number' or value::text !~ '^[0-9]+$' or length(value::text)>9) then raise exception using errcode='22023',message='fb_integer_required'; end if;
 else
  if value<>'null'::jsonb and jsonb_typeof(value)<>'string' then raise exception using errcode='22023',message='fb_text_required'; end if;
  lim:=case key when 'name' then 160 when 'full_description' then 10000 when 'external_url' then 2048 when 'short_description' then 500 else 1000 end;
  if translation then lim:=lim*2; end if;
  if length(value#>>'{}')>lim or (value#>>'{}') ~ '[<>\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' then raise exception using errcode='22023',message='fb_text_invalid'; end if;
 end if;
 end loop; return v;
end $$;
create function public.save_current_hotel_fb(p_kind text,p_id uuid,p_expected_revision integer,p_values jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=fb_private.mutation_hotel(); tbl text:=fb_private.table_name(p_kind); previous jsonb; candidate jsonb; changes jsonb;
 entity uuid:=coalesce(p_id,gen_random_uuid()); changed boolean:=false; f text; count_rows integer; mid uuid; service uuid;
begin
 changes:=fb_private.checked_patch(p_kind,p_values-array['menu_ids','service_id']);
 if p_id is not null then
  execute format('select to_jsonb(t) from public.%I t where id=$1 and hotel_id=$2 for update',tbl) into previous using p_id,target;
  if previous is null then raise exception using errcode='P0002',message='fb_not_found'; end if;
  if p_expected_revision is null or (previous->>'revision')::int<>p_expected_revision then raise exception using errcode='PT409',message='fb_revision_conflict'; end if;
 else
  if p_expected_revision is distinct from 0 then raise exception using errcode='PT409',message='fb_revision_conflict'; end if;
  execute format('select count(*) from public.%I where hotel_id=$1',tbl) into count_rows using target;
  if count_rows >= (case p_kind when 'outlet' then 50 when 'menu' then 100 when 'category' then 500 else 5000 end) then raise exception using errcode='54000',message='fb_limit'; end if;
 end if;
 candidate:=coalesce(previous,jsonb_build_object('id',entity,'hotel_id',target,'name',null,'is_published',false,'sort_order',0,'revision',0,'source_revision',0,'created_at',clock_timestamp()));
 if previous is null then candidate:=candidate||case p_kind when 'outlet' then '{"type":"restaurant","is_featured":false,"action_type":"none"}'::jsonb when 'item' then '{"currency":"BRL","price_on_request":false,"is_available":true}'::jsonb else '{}'::jsonb end; end if;
 candidate:=candidate||changes;
 if p_kind='category' and previous is not null and candidate->>'menu_id' is distinct from previous->>'menu_id'
 or p_kind='item' and previous is not null and candidate->>'category_id' is distinct from previous->>'category_id' then raise exception using errcode='22023',message='fb_parent_immutable'; end if;
 foreach f in array fb_private.text_fields(p_kind) loop changed:=changed or (previous->f is distinct from candidate->f); end loop;
 candidate:=candidate||jsonb_build_object('revision',coalesce((previous->>'revision')::int,0)+1,'source_revision',coalesce((previous->>'source_revision')::int,0)+case when changed or previous is null then 1 else 0 end,'updated_at',clock_timestamp());
 if p_id is null then execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).*',tbl,tbl) using candidate;
 else execute format('update public.%I t set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1)) where id=$2 and hotel_id=$3',tbl,
 (select string_agg(quote_ident(key),',' order by key) from jsonb_object_keys(candidate) key), (select string_agg(quote_ident(key),',' order by key) from jsonb_object_keys(candidate) key),tbl) using candidate,entity,target; end if;
 if p_kind<>'outlet' and (p_values ? 'menu_ids' or p_values ? 'service_id') then raise exception using errcode='22023',message='fb_field_not_writable'; end if;
 if p_kind='outlet' then
  if p_values ? 'menu_ids' then
   if jsonb_typeof(p_values->'menu_ids')<>'array' or jsonb_array_length(p_values->'menu_ids')>100 then raise exception using errcode='22023',message='fb_menus_invalid'; end if;
   delete from public.hotel_fb_outlet_menus where outlet_id=entity and hotel_id=target;
   for mid in select jsonb_array_elements_text(p_values->'menu_ids')::uuid loop
    insert into public.hotel_fb_outlet_menus(hotel_id,outlet_id,menu_id) values(target,entity,mid);
   end loop;
  end if;
  if p_values ? 'service_id' then
   service:=nullif(p_values->>'service_id','')::uuid;
   delete from public.hotel_fb_service_links where outlet_id=entity and hotel_id=target;
   if service is not null then insert into public.hotel_fb_service_links values(target,entity,service); end if;
  end if;
  if candidate->>'action_type'='service' and not exists(select 1 from public.hotel_fb_service_links where outlet_id=entity and hotel_id=target)
   or candidate->>'action_type'<>'service' and exists(select 1 from public.hotel_fb_service_links where outlet_id=entity and hotel_id=target)
   then raise exception using errcode='22023',message='fb_service_action_invalid'; end if;
 end if;
 perform public.record_admin_audit_event(auth.uid(),target,case when p_id is null then 'fb.created' when previous->'is_published' is distinct from candidate->'is_published' then case when (candidate->>'is_published')::boolean then 'fb.published' else 'fb.unpublished' end else 'fb.updated' end,'fb_'||p_kind,entity,jsonb_build_object('revision',(candidate->>'revision')::int,'is_published',(candidate->>'is_published')::boolean),null);
 return candidate;
end $$;
create function public.save_current_hotel_fb_translation(p_kind text,p_id uuid,p_language text,p_source_revision integer,p_fields jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare target uuid:=fb_private.mutation_hotel(); tbl text:=fb_private.table_name(p_kind); current_revision integer; fields jsonb;
begin
 if not public.is_hotel_module_enabled(target,'content.languages') then return false; end if;
 if p_language not in ('en','es') or p_language is null then raise exception using errcode='22023',message='fb_language_invalid'; end if;
 fields:=fb_private.checked_patch(p_kind,p_fields,true);
 execute format('select source_revision from public.%I where id=$1 and hotel_id=$2 for update',tbl) into current_revision using p_id,target;
 if current_revision is null then raise exception using errcode='P0002',message='fb_not_found'; end if;
 if current_revision is distinct from p_source_revision then return false; end if;
 execute format('insert into public.%I(hotel_id,entity_id,language,source_revision,fields) values($1,$2,$3,$4,$5) on conflict(entity_id,language) do update set fields=excluded.fields,source_revision=excluded.source_revision,updated_at=clock_timestamp()',tbl||'_translations') using target,p_id,p_language,p_source_revision,fields;
 perform public.record_admin_audit_event(auth.uid(),target,'fb.translated','fb_'||p_kind,p_id,jsonb_build_object('language',p_language,'source_revision',p_source_revision),null);
 return true;
end $$;
create function public.set_current_hotel_fb_image(p_kind text,p_id uuid,p_expected_revision integer,p_path text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=fb_private.mutation_hotel(); tbl text:=fb_private.table_name(p_kind); previous jsonb; result jsonb;
begin
 if p_kind not in ('outlet','item') then raise exception using errcode='22023',message='fb_image_kind_invalid'; end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1 and hotel_id=$2 for update',tbl) into previous using p_id,target;
 if previous is null then raise exception using errcode='P0002',message='fb_not_found'; end if;
 if p_expected_revision is distinct from (previous->>'revision')::int then raise exception using errcode='PT409',message='fb_revision_conflict'; end if;
 -- Browser callers cannot attach invented, stale or previously associated paths.
 -- Only the validated server upload can create objects in this owned prefix.
 -- Freshness also prevents reattaching an old object during post-commit cleanup.
 if p_path is not null and (
  p_path !~ ('^'||target::text||'/fb/'||p_kind||'/'||p_id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
  or not exists(select 1 from storage.objects o where o.bucket_id='hotel-assets' and o.name=p_path
   and o.created_at > (previous->>'updated_at')::timestamptz
   and o.metadata->>'mimetype'=case when p_path like '%.jpg' then 'image/jpeg' when p_path like '%.png' then 'image/png' else 'image/webp' end
   and o.metadata->>'size' ~ '^[0-9]{1,7}$' and (o.metadata->>'size')::integer between 1 and 2097152)
 ) then raise exception using errcode='23514',message='fb_verified_image_required'; end if;
 execute format('update public.%I t set main_image_path=$1,revision=revision+1,updated_at=clock_timestamp() where id=$2 and hotel_id=$3 returning to_jsonb(t)',tbl) into result using p_path,p_id,target;
 perform public.record_admin_audit_event(auth.uid(),target,'fb.image_updated','fb_'||p_kind,p_id,'{}',null);
 return jsonb_build_object('item_id',p_id,'previous_image_path',previous->'main_image_path','main_image_path',p_path,'updated_at',result->>'updated_at');
end $$;
create function public.reorder_current_hotel_fb(p_kind text,p_parent_id uuid,p_rows jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid:=fb_private.mutation_hotel(); tbl text:=fb_private.table_name(p_kind); parent text:=case p_kind when 'category' then 'menu_id' when 'item' then 'category_id' else null end;
 expected jsonb; current_rows jsonb; row jsonb; pos integer:=0;
begin
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>5000 then raise exception using errcode='22023',message='fb_order_invalid'; end if;
 execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''revision'',revision) order by id),''[]'') from public.%I where hotel_id=$1 %s',tbl,case when parent is null then '' else format('and %I=$2',parent) end) into current_rows using target,p_parent_id;
 select coalesce(jsonb_agg(v order by v->>'id'),'[]') into expected from jsonb_array_elements(p_rows) v;
 if expected<>current_rows or (select count(distinct v->>'id') from jsonb_array_elements(p_rows) v)<>jsonb_array_length(p_rows) then raise exception using errcode='PT409',message='fb_revision_conflict'; end if;
 for row in select * from jsonb_array_elements(p_rows) loop
 execute format('update public.%I set sort_order=$1,revision=revision+1,updated_at=clock_timestamp() where hotel_id=$2 and id=$3',tbl) using pos,target,(row->>'id')::uuid; pos:=pos+1;
 end loop;
 perform public.record_admin_audit_event(auth.uid(),target,'fb.reordered','fb_'||p_kind,null,jsonb_build_object('count',pos),null);
end $$;
create function public.delete_current_hotel_fb(p_kind text,p_id uuid,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=fb_private.mutation_hotel(); tbl text:=fb_private.table_name(p_kind); previous jsonb; images jsonb:='[]';
begin
 execute format('select to_jsonb(t) from public.%I t where id=$1 and hotel_id=$2 for update',tbl) into previous using p_id,target;
 if previous is null then raise exception using errcode='P0002',message='fb_not_found'; end if;
 if p_expected_revision is distinct from (previous->>'revision')::int then raise exception using errcode='PT409',message='fb_revision_conflict'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('kind','item','id',i.id,'path',i.main_image_path)),'[]') into images from public.hotel_fb_items i join public.hotel_fb_categories c on c.hotel_id=i.hotel_id and c.id=i.category_id
 where i.hotel_id=target and i.main_image_path is not null and (p_kind='menu' and c.menu_id=p_id or p_kind='category' and c.id=p_id);
 if p_kind in ('outlet','item') and previous->>'main_image_path' is not null then images:=images||jsonb_build_array(jsonb_build_object('kind',p_kind,'id',p_id,'path',previous->>'main_image_path')); end if;
 execute format('delete from public.%I where id=$1 and hotel_id=$2',tbl) using p_id,target;
 perform public.record_admin_audit_event(auth.uid(),target,'fb.deleted','fb_'||p_kind,p_id,'{}',null);
 return jsonb_build_object('deleted_id',p_id,'images',images);
end $$;

create function fb_private.localized(k text,source jsonb,lang text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare translated jsonb; f text;
begin
 source:=source-array['created_at','updated_at'];
 if lang not in ('en','es') or not public.is_hotel_module_enabled((source->>'hotel_id')::uuid,'content.languages') then return source; end if;
 execute format('select fields from public.%I where entity_id=$1 and hotel_id=$2 and language=$3 and source_revision=$4',fb_private.table_name(k)||'_translations') into translated using (source->>'id')::uuid,(source->>'hotel_id')::uuid,lang,(source->>'source_revision')::int;
 foreach f in array fb_private.text_fields(k) loop if nullif(btrim(translated->>f),'') is not null then source:=jsonb_set(source,array[f],translated->f); end if; end loop;
 return source;
end $$;
create function public.get_public_hotel_fb(p_hotel_id uuid,p_language text default 'pt') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; outlets uuid[]; menus uuid[]; categories uuid[];
begin
 if not fb_private.public_hotel(p_hotel_id) then return null; end if;
 select coalesce(array_agg(id),'{}') into outlets from public.hotel_fb_outlets where hotel_id=p_hotel_id and is_published;
 select coalesce(array_agg(distinct m.id),'{}') into menus from public.hotel_fb_menus m join public.hotel_fb_outlet_menus l on l.hotel_id=m.hotel_id and l.menu_id=m.id where m.hotel_id=p_hotel_id and m.is_published and l.outlet_id=any(outlets);
 select coalesce(array_agg(id),'{}') into categories from public.hotel_fb_categories where hotel_id=p_hotel_id and is_published and menu_id=any(menus);
 select jsonb_build_object(
 'outlets',(select coalesce(jsonb_agg(fb_private.localized('outlet',to_jsonb(o),p_language) order by o.sort_order,o.id),'[]') from public.hotel_fb_outlets o where hotel_id=p_hotel_id and id=any(outlets)),
 'menus',(select coalesce(jsonb_agg(fb_private.localized('menu',to_jsonb(m),p_language) order by m.sort_order,m.id),'[]') from public.hotel_fb_menus m where hotel_id=p_hotel_id and id=any(menus)),
 'categories',(select coalesce(jsonb_agg(fb_private.localized('category',to_jsonb(c),p_language) order by c.sort_order,c.id),'[]') from public.hotel_fb_categories c where hotel_id=p_hotel_id and id=any(categories)),
 'items',(select coalesce(jsonb_agg(fb_private.localized('item',to_jsonb(i),p_language) order by i.sort_order,i.id),'[]') from public.hotel_fb_items i where hotel_id=p_hotel_id and category_id=any(categories) and is_published and is_available),
 'outlet_menus',(select coalesce(jsonb_agg(to_jsonb(l) order by sort_order,menu_id),'[]') from public.hotel_fb_outlet_menus l where hotel_id=p_hotel_id and outlet_id=any(outlets) and menu_id=any(menus)),
 'service_links',(select coalesce(jsonb_agg(to_jsonb(l)),'[]') from public.hotel_fb_service_links l join public.hotel_sections ss on ss.hotel_id=l.hotel_id and ss.id=l.service_id and ss.enabled where l.hotel_id=p_hotel_id and l.outlet_id=any(outlets) and public.is_hotel_module_enabled(p_hotel_id,'content.services'))) into result;
 return result;
end $$;
revoke all on all functions in schema fb_private from public,anon,authenticated,service_role;
grant execute on function fb_private.admin_hotel(uuid) to authenticated;

revoke all on function public.save_current_hotel_fb(text,uuid,integer,jsonb) from public,anon,authenticated,service_role; grant execute on function public.save_current_hotel_fb(text,uuid,integer,jsonb) to authenticated;
revoke all on function public.save_current_hotel_fb_translation(text,uuid,text,integer,jsonb) from public,anon,authenticated,service_role; grant execute on function public.save_current_hotel_fb_translation(text,uuid,text,integer,jsonb) to authenticated;
revoke all on function public.set_current_hotel_fb_image(text,uuid,integer,text) from public,anon,authenticated,service_role; grant execute on function public.set_current_hotel_fb_image(text,uuid,integer,text) to authenticated;
revoke all on function public.reorder_current_hotel_fb(text,uuid,jsonb) from public,anon,authenticated,service_role; grant execute on function public.reorder_current_hotel_fb(text,uuid,jsonb) to authenticated;
revoke all on function public.delete_current_hotel_fb(text,uuid,integer) from public,anon,authenticated,service_role; grant execute on function public.delete_current_hotel_fb(text,uuid,integer) to authenticated;
revoke all on function public.get_public_hotel_fb(uuid,text) from public,anon,authenticated,service_role; grant execute on function public.get_public_hotel_fb(uuid,text) to anon,authenticated;
commit;
