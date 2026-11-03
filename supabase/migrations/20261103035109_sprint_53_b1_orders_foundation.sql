-- Sprint 53 B1. Additive, opt-in only; no tenant/content provisioning.
begin;
do $$ begin
 if to_regclass('public.hotel_fb_items') is null or to_regprocedure('fb_private.mutation_hotel()') is null
 then raise exception 'B1 requires the audited catalog foundation'; end if;
end $$;
create schema fb_order_private;
revoke all on schema fb_order_private from public,anon,authenticated,service_role;

create table fb_order_private.hotel_settings(
 hotel_id uuid primary key references public.hotels(id) on delete restrict,
 enabled boolean not null default false, timezone text not null,
 cancel_minutes integer not null default 10 check(cancel_minutes between 0 and 120),
 cancel_auto boolean not null default false, cancel_free boolean not null default false,
 revision integer not null default 1 check(revision>0),updated_at timestamptz not null default clock_timestamp()
);
create table fb_order_private.sectors(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 160),active boolean not null default true,
 sort_order integer not null default 0 check(sort_order between 0 and 100000),
 revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),unique(hotel_id,id)
);
create table fb_order_private.operator_grants(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete cascade,
 capability text not null check(capability in('orders.read','orders.transition','orders.cancel','orders.supervise','orders.pii.read','orders.configure')),
 sector_id uuid,active boolean not null default true,revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),
 foreign key(hotel_id,sector_id) references fb_order_private.sectors(hotel_id,id) on delete restrict,
 unique nulls not distinct(hotel_id,user_id,capability,sector_id),
 check(capability not in('orders.configure','orders.supervise') or sector_id is null)
);
create index b1_grants_actor on fb_order_private.operator_grants(hotel_id,user_id,capability) where active;
create table fb_order_private.outlet_settings(
 id uuid primary key,hotel_id uuid not null,mode text not null default 'external' check(mode in('external','native')),
 accepting boolean not null default false,pickup boolean not null default false,room_delivery boolean not null default false,
 default_sector_id uuid,revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),
 unique(hotel_id,id),foreign key(hotel_id,id) references public.hotel_fb_outlets(hotel_id,id) on delete cascade,
 foreign key(hotel_id,default_sector_id) references fb_order_private.sectors(hotel_id,id) on delete restrict
);
create table fb_order_private.service_entrypoints(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,outlet_id uuid not null,service_id uuid not null,
 active boolean not null default false,revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),
 unique(hotel_id,service_id),foreign key(hotel_id,outlet_id) references public.hotel_fb_outlets(hotel_id,id) on delete cascade,
 foreign key(service_id,hotel_id) references public.hotel_sections(id,hotel_id) on delete cascade
);
create table fb_order_private.item_fulfilment(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,outlet_id uuid not null,item_id uuid not null,sector_id uuid not null,
 revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),
 unique(hotel_id,outlet_id,item_id),foreign key(hotel_id,outlet_id) references public.hotel_fb_outlets(hotel_id,id) on delete cascade,
 foreign key(hotel_id,item_id) references public.hotel_fb_items(hotel_id,id) on delete cascade,
 foreign key(hotel_id,sector_id) references fb_order_private.sectors(hotel_id,id) on delete restrict
);
create table fb_order_private.modifier_groups(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,item_id uuid not null,name text not null check(length(btrim(name)) between 1 and 160),
 selection text not null check(selection in('single','multi')),min_selected integer not null default 0,
 max_selected integer not null default 1,active boolean not null default true,sort_order integer not null default 0,
 revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),unique(hotel_id,id),
 foreign key(hotel_id,item_id) references public.hotel_fb_items(hotel_id,id) on delete cascade,
 check(min_selected>=0 and max_selected between 1 and 16 and min_selected<=max_selected and (selection<>'single' or max_selected=1))
);
create index b1_modifier_item on fb_order_private.modifier_groups(hotel_id,item_id,sort_order);
create table fb_order_private.modifier_options(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,group_id uuid not null,name text not null check(length(btrim(name)) between 1 and 160),
 amount_minor bigint not null default 0 check(amount_minor between 0 and 100000000),currency text not null,
 active boolean not null default true,sort_order integer not null default 0,revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),
 unique(hotel_id,id),foreign key(hotel_id,group_id) references fb_order_private.modifier_groups(hotel_id,id) on delete cascade
);
create index b1_modifier_group on fb_order_private.modifier_options(hotel_id,group_id,sort_order);
create table fb_order_private.combos(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 160),amount_minor bigint not null check(amount_minor between 0 and 100000000),
 currency text not null,is_published boolean not null default false,revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),unique(hotel_id,id)
);
create table fb_order_private.combo_slots(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,combo_id uuid not null,name text not null check(length(btrim(name)) between 1 and 160),
 min_selected integer not null default 1,max_selected integer not null default 1,multiplicity integer not null default 1,
 revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),unique(hotel_id,id),
 foreign key(hotel_id,combo_id) references fb_order_private.combos(hotel_id,id) on delete cascade,
 check(min_selected>=0 and max_selected between 1 and 8 and min_selected<=max_selected and multiplicity between 1 and 10)
);
create index b1_slots_combo on fb_order_private.combo_slots(hotel_id,combo_id);
create table fb_order_private.combo_choices(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,slot_id uuid not null,item_id uuid not null,
 extra_minor bigint not null default 0 check(extra_minor between 0 and 100000000),active boolean not null default true,
 revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),unique(hotel_id,id),unique(hotel_id,slot_id,item_id),
 foreign key(hotel_id,slot_id) references fb_order_private.combo_slots(hotel_id,id) on delete cascade,
 foreign key(hotel_id,item_id) references public.hotel_fb_items(hotel_id,id) on delete cascade
);
create table fb_order_private.combo_menus(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,combo_id uuid not null,menu_id uuid not null,
 revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),unique(hotel_id,combo_id,menu_id),
 foreign key(hotel_id,combo_id) references fb_order_private.combos(hotel_id,id) on delete cascade,
 foreign key(hotel_id,menu_id) references public.hotel_fb_menus(hotel_id,id) on delete cascade
);
create table fb_order_private.availability_scopes(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,outlet_id uuid,menu_id uuid,item_id uuid,
 always_open boolean not null default false,display_mode text not null default 'show_unavailable' check(display_mode in('hide','show_unavailable')),
 manual_closed boolean not null default false,closed_until timestamptz,
 revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),unique(hotel_id,id),
 check(num_nonnulls(outlet_id,menu_id,item_id)=1),
 foreign key(hotel_id,outlet_id) references public.hotel_fb_outlets(hotel_id,id) on delete cascade,
 foreign key(hotel_id,menu_id) references public.hotel_fb_menus(hotel_id,id) on delete cascade,
 foreign key(hotel_id,item_id) references public.hotel_fb_items(hotel_id,id) on delete cascade
);
create unique index b1_avail_outlet on fb_order_private.availability_scopes(hotel_id,outlet_id) where outlet_id is not null;
create unique index b1_avail_menu on fb_order_private.availability_scopes(hotel_id,menu_id) where menu_id is not null;
create unique index b1_avail_item on fb_order_private.availability_scopes(hotel_id,item_id) where item_id is not null;
create table fb_order_private.availability_windows(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,scope_id uuid not null,
 weekday integer not null check(weekday between 0 and 6),start_minute integer not null check(start_minute between 0 and 1439),
 end_minute integer not null check(end_minute between 0 and 1439),next_day boolean not null default false,
 revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),
 foreign key(hotel_id,scope_id) references fb_order_private.availability_scopes(hotel_id,id) on delete cascade,
 check((next_day and end_minute<=start_minute) or (not next_day and end_minute>start_minute)),
 unique(hotel_id,scope_id,weekday,start_minute,end_minute,next_day)
);
create table fb_order_private.availability_exceptions(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,scope_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,available boolean not null default false,
 revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '31 days'),
 foreign key(hotel_id,scope_id) references fb_order_private.availability_scopes(hotel_id,id) on delete cascade
);
create index b1_exceptions_scope on fb_order_private.availability_exceptions(hotel_id,scope_id,starts_at,ends_at);

create table fb_order_private.guest_sessions(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
 secret_digest text not null unique check(secret_digest~'^[0-9a-f]{64}$'),created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '24 hours',unique(hotel_id,id)
);
create index b1_session_expiry on fb_order_private.guest_sessions(expires_at);
create table fb_order_private.orders(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
 outlet_origin_id uuid not null,outlet_name text not null,language text not null check(language in('pt','en','es')),
 fulfilment text not null check(fulfilment in('pickup','room_delivery')),timezone text not null,currency text not null,
 total_minor bigint not null check(total_minor between 0 and 1000000000000),
 status text not null default 'registered' check(status in('registered','accepted','preparing','ready','out_for_delivery','delivered','cancelled')),
 revision integer not null default 1,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 terminal_at timestamptz,retain_until timestamptz not null default clock_timestamp()+interval '180 days',alerted_at timestamptz,
 unique(hotel_id,id)
);
create index b1_orders_panel on fb_order_private.orders(hotel_id,status,created_at,id);
create index b1_order_retention on fb_order_private.orders(retain_until);
create table fb_order_private.order_private_data(
 hotel_id uuid not null,order_id uuid primary key,first_name text not null,last_name text not null,room_label text,note text,
 expires_at timestamptz not null default clock_timestamp()+interval '7 days',
 foreign key(hotel_id,order_id) references fb_order_private.orders(hotel_id,id) on delete cascade
);
create index b1_private_expiry on fb_order_private.order_private_data(expires_at);
create table fb_order_private.order_groups(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,order_id uuid not null,sector_id uuid not null,sector_name text not null,
 status text not null default 'registered' check(status in('registered','accepted','preparing','ready','out_for_delivery','delivered','cancelled')),
 revision integer not null default 1,updated_at timestamptz not null default clock_timestamp(),
 foreign key(hotel_id,order_id) references fb_order_private.orders(hotel_id,id) on delete cascade,
 foreign key(hotel_id,sector_id) references fb_order_private.sectors(hotel_id,id) on delete restrict,
 unique(hotel_id,id),unique(hotel_id,order_id,id),unique(hotel_id,order_id,sector_id)
);
create index b1_groups_panel on fb_order_private.order_groups(hotel_id,sector_id,status,order_id);
create table fb_order_private.order_lines(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,order_id uuid not null,group_id uuid,parent_id uuid,
 kind text not null check(kind in('item','combo','component')),origin_id uuid not null,name text not null,
 quantity integer not null check(quantity between 1 and 100),unit_minor bigint not null check(unit_minor between 0 and 100000000),
 total_minor bigint not null check(total_minor between 0 and 1000000000000),currency text not null,
 position integer not null,unique(hotel_id,order_id,id),unique(hotel_id,order_id,position),
 check((kind='combo' and group_id is null and parent_id is null) or (kind='item' and group_id is not null and parent_id is null) or (kind='component' and group_id is not null and parent_id is not null and unit_minor=0 and total_minor=0)),
 foreign key(hotel_id,order_id) references fb_order_private.orders(hotel_id,id) on delete cascade,
 foreign key(hotel_id,order_id,group_id) references fb_order_private.order_groups(hotel_id,order_id,id) on delete cascade,
 foreign key(hotel_id,order_id,parent_id) references fb_order_private.order_lines(hotel_id,order_id,id) on delete cascade
);
create index b1_lines_group on fb_order_private.order_lines(hotel_id,order_id,group_id);
create table fb_order_private.order_line_options(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,order_id uuid not null,line_id uuid not null,bill_to_line_id uuid not null,
 origin_id uuid not null,kind text not null check(kind in('modifier','combo_choice')),group_name text not null,name text not null,
 unit_minor bigint not null check(unit_minor between 0 and 100000000),quantity integer not null check(quantity between 1 and 100),
 foreign key(hotel_id,order_id,line_id) references fb_order_private.order_lines(hotel_id,order_id,id) on delete cascade,
 foreign key(hotel_id,order_id,bill_to_line_id) references fb_order_private.order_lines(hotel_id,order_id,id) on delete cascade
);
create index b1_line_options on fb_order_private.order_line_options(hotel_id,order_id,line_id);
create table fb_order_private.order_line_notes(
 hotel_id uuid not null,order_id uuid not null,line_id uuid primary key,note text not null,
 expires_at timestamptz not null default clock_timestamp()+interval '7 days',
 foreign key(hotel_id,order_id,line_id) references fb_order_private.order_lines(hotel_id,order_id,id) on delete cascade
);
create index b1_notes_expiry on fb_order_private.order_line_notes(expires_at);
create table fb_order_private.order_events(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,order_id uuid not null,group_id uuid,
 action text not null,actor_id uuid,actor_kind text not null check(actor_kind in('guest','staff','system')),
 order_revision integer not null,contract_version integer not null default 1,created_at timestamptz not null default clock_timestamp(),
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=2048),
 foreign key(hotel_id,order_id) references fb_order_private.orders(hotel_id,id) on delete cascade,
 foreign key(hotel_id,order_id,group_id) references fb_order_private.order_groups(hotel_id,order_id,id) on delete cascade
);
create index b1_events_order on fb_order_private.order_events(hotel_id,order_id,order_revision,created_at,id);
create table fb_order_private.idempotency(
 hotel_id uuid not null,session_id uuid not null,key_id uuid not null,intent_digest text not null check(intent_digest~'^[0-9a-f]{64}$'),
 order_id uuid not null,expires_at timestamptz not null,
 primary key(hotel_id,session_id,key_id),
 foreign key(hotel_id,order_id) references fb_order_private.orders(hotel_id,id) on delete cascade
);
create index b1_idempotency_expiry on fb_order_private.idempotency(expires_at);
create table fb_order_private.order_access_tokens(
 hotel_id uuid not null,order_id uuid primary key,secret_digest text not null unique check(secret_digest~'^[0-9a-f]{64}$'),
 expires_at timestamptz not null,foreign key(hotel_id,order_id) references fb_order_private.orders(hotel_id,id) on delete cascade
);
create index b1_access_expiry on fb_order_private.order_access_tokens(expires_at);
create table fb_order_private.cancellation_requests(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,order_id uuid not null,status text not null default 'pending' check(status in('pending','approved','denied')),
 revision integer not null default 1,reason_code text,created_at timestamptz not null default clock_timestamp(),
 foreign key(hotel_id,order_id) references fb_order_private.orders(hotel_id,id) on delete cascade
);
create unique index b1_cancel_pending on fb_order_private.cancellation_requests(hotel_id,order_id) where status='pending';
create table fb_order_private.admission_buckets(
 hotel_id uuid not null references public.hotels(id) on delete restrict,scope text not null check(scope in('session','hotel','network','room','access')),
 digest text not null check(digest~'^[0-9a-f]{64}$'),window_at timestamptz not null,used integer not null check(used>=0),
 primary key(hotel_id,scope,digest,window_at)
);
create index b1_admission_expiry on fb_order_private.admission_buckets(window_at);
-- Reverse-reference indexes keep A's existing catalogue deletions bounded.
create index b1_grants_profile on fb_order_private.operator_grants(user_id);
create index b1_grants_sector on fb_order_private.operator_grants(hotel_id,sector_id);
create index b1_entry_outlet on fb_order_private.service_entrypoints(hotel_id,outlet_id);
create index b1_fulfilment_item on fb_order_private.item_fulfilment(hotel_id,item_id);
create index b1_fulfilment_sector on fb_order_private.item_fulfilment(hotel_id,sector_id);
create index b1_choice_item on fb_order_private.combo_choices(hotel_id,item_id);
create index b1_combo_menu on fb_order_private.combo_menus(hotel_id,menu_id);
create index b1_line_parent on fb_order_private.order_lines(hotel_id,order_id,parent_id) where parent_id is not null;
create index b1_option_bill on fb_order_private.order_line_options(hotel_id,order_id,bill_to_line_id);
create index b1_event_group on fb_order_private.order_events(hotel_id,order_id,group_id);
create index b1_key_order on fb_order_private.idempotency(hotel_id,order_id);
create index b1_request_order on fb_order_private.cancellation_requests(hotel_id,order_id);

-- Private schema, RLS defense in depth, no direct Data API/table grants.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='fb_order_private' loop
  execute format('alter table fb_order_private.%I enable row level security',t.tablename);
  execute format('revoke all on table fb_order_private.%I from public,anon,authenticated,service_role',t.tablename);
 end loop;
end $$;

create function fb_order_private.hash(v text) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(v,'UTF8')),'hex');
$$;
create function fb_order_private.service_only() returns void language plpgsql stable set search_path='' as $$ begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='orders_server_required'; end if;
end $$;
create function fb_order_private.valid_text(v text,lim integer,required boolean default false) returns text language plpgsql immutable set search_path='' as $$ begin
 v:=nullif(btrim(v),'');
 if (required and v is null) or length(v)>lim or v~'[[:cntrl:]<>]' then raise exception using errcode='22023',message='orders_text_invalid'; end if;
 return v;
end $$;
create function fb_order_private.actor() returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
 select hotel_id into h from public.profiles where id=auth.uid() and is_active for share;
 if h is null or not public.has_active_hotel_role(h,'operador') then raise exception using errcode='42501',message='orders_actor_denied'; end if;
 perform 1 from public.hotels where id=h and platform_status<>'archived' for update;
 if not found then raise exception using errcode='42501',message='orders_hotel_denied'; end if;
 return h;
end $$;
create function fb_order_private.can(h uuid,cap text,sector uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select public.has_active_hotel_role(h,case when cap='orders.configure' then 'editor' else 'operador' end)
 and exists(select 1 from fb_order_private.operator_grants g join public.profiles p on p.id=g.user_id and p.hotel_id=g.hotel_id and p.is_active
 where g.hotel_id=h and g.user_id=auth.uid() and g.capability=cap and g.active and (g.sector_id is null or g.sector_id=sector));
$$;
create function fb_order_private.require_cap(h uuid,cap text,sector uuid default null) returns void language plpgsql set search_path='' as $$ begin
 if not fb_order_private.can(h,cap,sector) then raise exception using errcode='42501',message='orders_capability_required'; end if;
end $$;
create function fb_order_private.audit(h uuid,action text,entity uuid) returns void language plpgsql set search_path='' as $$ begin
 perform public.record_admin_audit_event(auth.uid(),h,action,'fb_orders',entity,'{}',null);
end $$;


create function fb_order_private.currency(v text) returns boolean language sql immutable set search_path='' as $$ select v in('AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNY','COP','CRC','CUC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD','HKD','HNL','HRK','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KPW','KRW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SLL','SOS','SRD','SSP','STN','SVC','SYP','SZL','THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XCG','XDR','XOF','XPF','XSU','YER','ZAR','ZMW','ZWG','ZWL'); $$;

-- Controlled patch surface, not arbitrary table/column/payload persistence.
create function public.save_current_hotel_fb_order_config(p_kind text,p_id uuid,p_expected_revision integer,p_values jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.actor();tbl text;allowed text[];prev jsonb;candidate jsonb;entity uuid;cols text;k text;u public.profiles%rowtype;row_count bigint;
begin
 case p_kind
 when 'hotel' then tbl:='hotel_settings';allowed:=array['enabled','timezone','cancel_minutes','cancel_auto','cancel_free'];
 when 'outlet' then tbl:='outlet_settings';allowed:=array['mode','accepting','pickup','room_delivery','default_sector_id'];
 when 'sector' then tbl:='sectors';allowed:=array['name','active','sort_order'];
 when 'grant' then tbl:='operator_grants';allowed:=array['user_id','capability','sector_id','active'];
 when 'entrypoint' then tbl:='service_entrypoints';allowed:=array['outlet_id','service_id','active'];
 when 'fulfilment' then tbl:='item_fulfilment';allowed:=array['outlet_id','item_id','sector_id'];
 when 'modifier_group' then tbl:='modifier_groups';allowed:=array['item_id','name','selection','min_selected','max_selected','active','sort_order'];
 when 'modifier_option' then tbl:='modifier_options';allowed:=array['group_id','name','amount_minor','currency','active','sort_order'];
 when 'combo' then tbl:='combos';allowed:=array['name','amount_minor','currency','is_published'];
 when 'combo_slot' then tbl:='combo_slots';allowed:=array['combo_id','name','min_selected','max_selected','multiplicity'];
 when 'combo_choice' then tbl:='combo_choices';allowed:=array['slot_id','item_id','extra_minor','active'];
 when 'combo_menu' then tbl:='combo_menus';allowed:=array['combo_id','menu_id'];
 when 'availability' then tbl:='availability_scopes';allowed:=array['outlet_id','menu_id','item_id','always_open','display_mode','manual_closed','closed_until'];
 when 'window' then tbl:='availability_windows';allowed:=array['scope_id','weekday','start_minute','end_minute','next_day'];
 when 'exception' then tbl:='availability_exceptions';allowed:=array['scope_id','starts_at','ends_at','available'];
 else raise exception using errcode='22023',message='orders_config_kind_invalid';
 end case;
 if p_kind='grant' then
  if not public.has_active_hotel_role(h,'administrador') then raise exception using errcode='42501',message='orders_admin_required'; end if;
 else perform fb_order_private.require_cap(h,'orders.configure'); end if;
 if p_kind<>'grant' and not public.is_hotel_module_enabled(h,'fb.menu') then raise exception using errcode='42501',message='orders_module_required'; end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>8192 or (p_values-allowed)<>'{}' then raise exception using errcode='22023',message='orders_config_patch_invalid'; end if;
 if p_expected_revision is null or p_expected_revision<0 then raise exception using errcode='PT409',message='orders_revision_conflict'; end if;
 for k in select jsonb_object_keys(p_values) loop
  if k in('enabled','cancel_auto','cancel_free','accepting','pickup','room_delivery','active','is_published','always_open','manual_closed','next_day','available') then
   if jsonb_typeof(p_values->k)<>'boolean' then raise exception using errcode='22023',message='orders_boolean_required'; end if;
  elsif k in('cancel_minutes','sort_order','min_selected','max_selected','multiplicity','amount_minor','extra_minor','weekday','start_minute','end_minute') then
   if jsonb_typeof(p_values->k)<>'number' or (p_values->>k)!~'^[0-9]+$' then raise exception using errcode='22023',message='orders_integer_required'; end if;
   if k='sort_order' and (p_values->>k)::numeric>100000 then raise exception using errcode='22023',message='orders_sort_invalid'; end if;
  elsif jsonb_typeof(p_values->k) not in('string','null') then raise exception using errcode='22023',message='orders_text_required'; end if;
 end loop;
 entity:=case when p_kind='hotel' then h else coalesce(p_id,gen_random_uuid()) end;
 if p_kind='outlet' and not exists(select 1 from public.hotel_fb_outlets where hotel_id=h and id=entity) then raise exception using errcode='23503',message='orders_outlet_scope_invalid'; end if;
 if p_kind='hotel' then select to_jsonb(t) into prev from fb_order_private.hotel_settings t where hotel_id=h for update;
 else execute format('select to_jsonb(t) from fb_order_private.%I t where id=$1 and hotel_id=$2 for update',tbl) into prev using entity,h; end if;
 if prev is null and p_id is not null and p_kind not in('hotel','outlet') then raise exception using errcode='P0002',message='orders_config_missing'; end if;
 if (prev is null and p_expected_revision<>0) or (prev is not null and (prev->>'revision')::int<>p_expected_revision) then raise exception using errcode='PT409',message='orders_revision_conflict'; end if;
 if prev is null and (select count(*) from pg_catalog.jsonb_object_keys(p_values))=0 then raise exception using errcode='22023',message='orders_config_empty'; end if;
 if prev is null then
  execute format('select count(*) from fb_order_private.%I where hotel_id=$1',tbl) into row_count using h;
  if row_count>=10000 then raise exception using errcode='22023',message='orders_config_quota'; end if;
  if p_kind='hotel' then
   insert into fb_order_private.hotel_settings(hotel_id,timezone) values(h,'UTC');
  else
   -- Defaults come from the declared columns; required fields come only from the allowlist.
   select string_agg(quote_ident(key),',' order by key) into cols from jsonb_object_keys(p_values) key;
   execute format('insert into fb_order_private.%I(id,hotel_id,%s) select $1,$2,%s from jsonb_populate_record(null::fb_order_private.%I,$3)',tbl,cols,cols,tbl) using entity,h,p_values;
  end if;
  if p_kind='hotel' then select to_jsonb(t) into prev from fb_order_private.hotel_settings t where hotel_id=h;
  else execute format('select to_jsonb(t) from fb_order_private.%I t where id=$1 and hotel_id=$2',tbl) into prev using entity,h; end if;
  prev:=prev||jsonb_build_object('revision',0);
 end if;
 candidate:=prev||p_values||jsonb_build_object('revision',p_expected_revision+1,'updated_at',clock_timestamp());
 if candidate?'currency' and not coalesce(fb_order_private.currency(candidate->>'currency'),false) then raise exception using errcode='23514',message='orders_currency_invalid'; end if;
 if candidate?'name' then candidate:=candidate||jsonb_build_object('name',fb_order_private.valid_text(candidate->>'name',160,true)); end if;
 if p_kind='hotel' and (not(p_values?'timezone') and p_expected_revision=0 or not exists(select 1 from pg_timezone_names where name=candidate->>'timezone')) then raise exception using errcode='22023',message='orders_timezone_required'; end if;
 if p_kind='grant' then
  select * into u from public.profiles where id=(candidate->>'user_id')::uuid and hotel_id=h and is_active for share;
  if not found or not public.has_active_hotel_role(h,'administrador') or
   not (case when candidate->>'capability'='orders.configure' then public.has_active_hotel_role(h,'editor') else true end)
  then raise exception using errcode='42501',message='orders_grant_target_invalid'; end if;
  if lower(u.role) not in('operador','editor','administrador','admin','owner') or (candidate->>'capability'='orders.configure' and lower(u.role) not in('editor','administrador','admin','owner')) then raise exception using errcode='42501',message='orders_grant_role_invalid'; end if;
 end if;
 if p_kind='entrypoint' and not exists(select 1 from public.hotel_fb_service_links l where l.hotel_id=h and l.outlet_id=(candidate->>'outlet_id')::uuid and l.service_id=(candidate->>'service_id')::uuid) then raise exception using errcode='23503',message='orders_entrypoint_link_required'; end if;
 if p_kind='fulfilment' and not exists(select 1 from public.hotel_fb_items i join public.hotel_fb_categories c on c.hotel_id=i.hotel_id and c.id=i.category_id join public.hotel_fb_outlet_menus l on l.hotel_id=c.hotel_id and l.menu_id=c.menu_id where i.hotel_id=h and i.id=(candidate->>'item_id')::uuid and l.outlet_id=(candidate->>'outlet_id')::uuid) then raise exception using errcode='23503',message='orders_item_outlet_invalid'; end if;
 if p_kind='modifier_option' and not exists(select 1 from fb_order_private.modifier_groups g join public.hotel_fb_items i on i.hotel_id=g.hotel_id and i.id=g.item_id where g.hotel_id=h and g.id=(candidate->>'group_id')::uuid and i.currency=candidate->>'currency') then raise exception using errcode='23514',message='orders_option_currency_invalid'; end if;
 -- Parent identities cannot be moved after creation.
 if p_expected_revision>0 then
  foreach k in array array['item_id','group_id','combo_id','slot_id','menu_id','scope_id','outlet_id','service_id','user_id','capability','sector_id'] loop
   if p_values?k and candidate->k is distinct from prev->k and not(p_kind='fulfilment' and k='sector_id') then raise exception using errcode='22023',message='orders_config_parent_immutable'; end if;
  end loop;
 end if;
 select string_agg(format('%I=r.%I',a.attname,a.attname),',') into cols from pg_attribute a
 where a.attrelid=format('fb_order_private.%I',tbl)::regclass and a.attnum>0 and not a.attisdropped and a.attname not in('id','hotel_id');
 execute format('update fb_order_private.%I t set %s from jsonb_populate_record(null::fb_order_private.%I,$1) r where t.hotel_id=$2 %s returning to_jsonb(t)',tbl,cols,tbl,case when p_kind='hotel' then '' else 'and t.id=$3' end) into candidate using candidate,h,entity;
 perform fb_order_private.audit(h,'fb.orders.configured',entity);
 return candidate;
end $$;

create function public.get_current_hotel_fb_order_config() returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.actor();result jsonb:='{}';tbl text;part jsonb;
begin
 perform fb_order_private.require_cap(h,'orders.configure');
 foreach tbl in array array['hotel_settings','outlet_settings','service_entrypoints','sectors','operator_grants','item_fulfilment','modifier_groups','modifier_options','combos','combo_slots','combo_choices','combo_menus','availability_scopes','availability_windows','availability_exceptions'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]'') from fb_order_private.%I t where hotel_id=$1',tbl) into part using h;
  result:=result||jsonb_build_object(tbl,part);
 end loop;
 return result;
end $$;

-- Calendar evaluation accepts an explicit instant internally for deterministic SQL tests.
-- Public confirmation always supplies clock_timestamp(), never a browser timestamp.
create function fb_order_private.scope_available(h uuid,k text,entity uuid,moment timestamptz) returns boolean
language plpgsql stable set search_path='' as $$
declare s fb_order_private.availability_scopes%rowtype;zone text;local_time timestamp;minute integer;day integer;decision boolean;
begin
 select * into s from fb_order_private.availability_scopes where hotel_id=h and
 (k='outlet' and outlet_id=entity or k='menu' and menu_id=entity or k='item' and item_id=entity);
 if not found then return k<>'outlet'; end if;
 if s.manual_closed and (s.closed_until is null or moment<s.closed_until) then return false; end if;
 -- A closing exception always wins overlapping opening exceptions.
 if exists(select 1 from fb_order_private.availability_exceptions where hotel_id=h and scope_id=s.id and starts_at<=moment and ends_at>moment and not available) then return false; end if;
 if exists(select 1 from fb_order_private.availability_exceptions where hotel_id=h and scope_id=s.id and starts_at<=moment and ends_at>moment and available) then return true; end if;
 if s.always_open then return true; end if;
 select timezone into zone from fb_order_private.hotel_settings where hotel_id=h;
 if zone is null then return false; end if;
 local_time:=moment at time zone zone;minute:=extract(hour from local_time)::int*60+extract(minute from local_time)::int;day:=extract(dow from local_time)::int;
 return exists(select 1 from fb_order_private.availability_windows w where w.hotel_id=h and w.scope_id=s.id and
 ((w.weekday=day and minute>=w.start_minute and (w.next_day or minute<w.end_minute))
 or (w.next_day and w.weekday=(day+6)%7 and minute<w.end_minute)));
end $$;
create function fb_order_private.native_hotel(h uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.hotels where id=h and platform_status='active')
 and public.is_hotel_module_enabled(h,'core.directory') and public.is_hotel_module_enabled(h,'fb.menu')
 and exists(select 1 from fb_order_private.hotel_settings where hotel_id=h and enabled);
$$;
create function public.begin_fb_order_session(p_hotel_slug text,p_secret_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid;s fb_order_private.guest_sessions%rowtype;
begin
 perform fb_order_private.service_only();
 select id into h from public.hotels where slug=p_hotel_slug for update;
 if h is null or not fb_order_private.native_hotel(h) then raise exception using errcode='42501',message='orders_disabled'; end if;
 insert into fb_order_private.guest_sessions(hotel_id,secret_digest) values(h,p_secret_digest) returning * into s;
 return jsonb_build_object('id',s.id,'expires_at',s.expires_at);
end $$;

-- Separate short transaction: rejected order attempts consume admission, not order facts.
create function public.admit_fb_order_attempt(p_hotel_slug text,p_scope text,p_digest text) returns boolean
language plpgsql security definer set search_path='' as $$
declare h uuid;n integer;moment timestamptz:=date_trunc('minute',clock_timestamp());lim integer;
begin
 perform fb_order_private.service_only();
 select id into h from public.hotels where slug=p_hotel_slug;
 if h is null or not exists(select 1 from public.hotels where id=h and platform_status='active') then return false; end if;
 lim:=case p_scope when 'session' then 5 when 'room' then 10 when 'network' then 60 when 'hotel' then 120 when 'access' then 60 else 0 end;
 if lim=0 then raise exception using errcode='22023',message='orders_scope_invalid'; end if;
 insert into fb_order_private.admission_buckets(hotel_id,scope,digest,window_at,used) values(h,p_scope,p_digest,moment,1)
 on conflict(hotel_id,scope,digest,window_at) do update set used=fb_order_private.admission_buckets.used+1 where fb_order_private.admission_buckets.used<lim returning used into n;
 return n is not null;
end $$;

create function fb_order_private.option_ids(v jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb;
begin
 if v is null then return '[]'; end if;
 if jsonb_typeof(v)<>'array' or jsonb_array_length(v)>16 or exists(select 1 from jsonb_array_elements(v) e where jsonb_typeof(e)<>'string' or (e#>>'{}')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 or (select count(*)<>count(distinct lower(value)) from jsonb_array_elements_text(v)) then raise exception using errcode='22023',message='orders_options_invalid'; end if;
 select coalesce(jsonb_agg(to_jsonb(lower(value)) order by lower(value)),'[]') into result from jsonb_array_elements_text(v);
 return result;
end $$;
create function fb_order_private.intent(v jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare lines jsonb:='[]';l jsonb;c jsonb;choices jsonb;kind text;q integer;result jsonb;
begin
 if v is null or jsonb_typeof(v)<>'object' or octet_length(v::text)>32768 or (v-array['lines','first_name','last_name','note','fulfilment','language'])<>'{}'
 or jsonb_typeof(v->'lines') is distinct from 'array' or jsonb_array_length(v->'lines') not between 1 and 20 then raise exception using errcode='22023',message='orders_intent_invalid'; end if;
 if jsonb_typeof(v->'first_name') is distinct from 'string' or jsonb_typeof(v->'last_name') is distinct from 'string' or
 (v?'note' and jsonb_typeof(v->'note') not in('string','null')) then raise exception using errcode='22023',message='orders_text_required'; end if;
 for l in select value from jsonb_array_elements(v->'lines') loop
  if jsonb_typeof(l)<>'object' or (l-array['kind','id','menu_id','quantity','options','choices','note'])<>'{}' or jsonb_typeof(l->'quantity') is distinct from 'number'
  or (l->>'quantity')!~'^[1-9][0-9]?$' then raise exception using errcode='22023',message='orders_line_invalid'; end if;
  kind:=l->>'kind';q:=(l->>'quantity')::int;
  if kind not in('item','combo') or kind is null or (l->>'id')::uuid is null or (l->>'menu_id')::uuid is null or q>20 then raise exception using errcode='22023',message='orders_line_invalid'; end if;
  if l?'note' and jsonb_typeof(l->'note') not in('string','null') then raise exception using errcode='22023',message='orders_text_required'; end if;
  choices:='[]';
  if kind='combo' then
   if jsonb_typeof(l->'choices') is distinct from 'array' or jsonb_array_length(l->'choices') not between 1 and 16 or l?'options' then raise exception using errcode='22023',message='orders_choices_invalid'; end if;
   for c in select value from jsonb_array_elements(l->'choices') loop
    if jsonb_typeof(c)<>'object' or (c-array['id','options'])<>'{}' or (c->>'id')::uuid is null then raise exception using errcode='22023',message='orders_choices_invalid'; end if;
    choices:=choices||jsonb_build_array(jsonb_build_object('id',(c->>'id')::uuid,'options',fb_order_private.option_ids(c->'options')));
   end loop;
   if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(choices)) then raise exception using errcode='22023',message='orders_choices_duplicate'; end if;
   select jsonb_agg(value order by value->>'id') into choices from jsonb_array_elements(choices);
  elsif l?'choices' then raise exception using errcode='22023',message='orders_choices_invalid'; end if;
  lines:=lines||jsonb_build_array(jsonb_build_object('kind',kind,'id',(l->>'id')::uuid,'menu_id',(l->>'menu_id')::uuid,'quantity',q,
   'options',case when kind='item' then fb_order_private.option_ids(l->'options') else '[]'::jsonb end,'choices',choices,'note',fb_order_private.valid_text(l->>'note',500)));
 end loop;
 result:=jsonb_build_object('lines',lines,'first_name',fb_order_private.valid_text(v->>'first_name',80,true),'last_name',fb_order_private.valid_text(v->>'last_name',80,true),
 'note',fb_order_private.valid_text(v->>'note',1000),'fulfilment',v->>'fulfilment','language',coalesce(v->>'language','pt'));
 if result->>'fulfilment' not in('pickup','room_delivery') or result->>'fulfilment' is null or result->>'language' not in('pt','en','es') then raise exception using errcode='22023',message='orders_context_invalid'; end if;
 return result;
end $$;
create function fb_order_private.item_price(h uuid,outlet uuid,menu uuid,item uuid,opts jsonb,qty integer,lang text,moment timestamptz)
returns jsonb language plpgsql stable set search_path='' as $$
declare i public.hotel_fb_items%rowtype;s fb_order_private.sectors%rowtype;g fb_order_private.modifier_groups%rowtype;
 op fb_order_private.modifier_options%rowtype;n integer;extra bigint:=0;options jsonb:='[]';display jsonb;
begin
 select t.* into i from public.hotel_fb_items t join public.hotel_fb_categories c on c.id=t.category_id and c.hotel_id=t.hotel_id
 join public.hotel_fb_menus m on m.hotel_id=c.hotel_id and m.id=c.menu_id
 join public.hotel_fb_outlet_menus l on l.hotel_id=m.hotel_id and l.menu_id=m.id
 where t.hotel_id=h and t.id=item and m.id=menu and l.outlet_id=outlet and t.is_published and t.is_available and c.is_published and m.is_published;
 if not found or i.price_on_request or i.price_amount_minor is null or not fb_order_private.scope_available(h,'menu',menu,moment) or not fb_order_private.scope_available(h,'item',item,moment)
 then raise exception using errcode='22023',message='orders_item_unavailable'; end if;
 select st.* into s from fb_order_private.sectors st where st.hotel_id=h and st.active and st.id=coalesce(
 (select sector_id from fb_order_private.item_fulfilment where hotel_id=h and outlet_id=outlet and item_id=item),
 (select default_sector_id from fb_order_private.outlet_settings where hotel_id=h and id=outlet));
 if not found then raise exception using errcode='22023',message='orders_sector_unavailable'; end if;
 opts:=fb_order_private.option_ids(opts);
 for g in select * from fb_order_private.modifier_groups where hotel_id=h and item_id=item and active loop
  select count(*) into n from fb_order_private.modifier_options o where o.hotel_id=h and o.group_id=g.id and to_jsonb(o.id::text)<@opts;
  if n<g.min_selected or n>g.max_selected then raise exception using errcode='22023',message='orders_option_count_invalid'; end if;
 end loop;
 for display in select value from jsonb_array_elements(opts) loop
  select o.* into op from fb_order_private.modifier_options o join fb_order_private.modifier_groups mg on mg.hotel_id=o.hotel_id and mg.id=o.group_id
  where o.hotel_id=h and o.id=(display#>>'{}')::uuid and o.active and mg.active and mg.item_id=item and o.currency=i.currency;
  if not found then raise exception using errcode='22023',message='orders_option_unavailable'; end if;
  extra:=extra+op.amount_minor;
  options:=options||jsonb_build_array(jsonb_build_object('origin_id',op.id,'kind','modifier','group_name',(select name from fb_order_private.modifier_groups where id=op.group_id and hotel_id=h),'name',op.name,'unit_minor',op.amount_minor,'quantity',qty));
 end loop;
 display:=fb_private.localized('item',to_jsonb(i),lang);
 return jsonb_build_object('kind','item','origin_id',item,'name',display->>'name','quantity',qty,'unit_minor',i.price_amount_minor,'total_minor',(i.price_amount_minor::bigint+extra)*qty,
 'currency',i.currency,'sector_id',s.id,'sector_name',s.name,'options',options);
end $$;
create function fb_order_private.price(h uuid,outlet uuid,v jsonb,moment timestamptz) returns jsonb
language plpgsql stable set search_path='' as $$
declare cfg fb_order_private.outlet_settings%rowtype;outrow public.hotel_fb_outlets%rowtype;l jsonb;line jsonb;lines jsonb:='[]';components jsonb;component jsonb;selected jsonb;
 combo fb_order_private.combos%rowtype;slot fb_order_private.combo_slots%rowtype;choice fb_order_private.combo_choices%rowtype;
 currency text;total bigint:=0;line_total bigint;count_leaves integer:=0;units integer:=0;menu uuid;q integer;n integer;
begin
 if not fb_order_private.native_hotel(h) then raise exception using errcode='42501',message='orders_disabled'; end if;
 select * into cfg from fb_order_private.outlet_settings where hotel_id=h and id=outlet and mode='native' and accepting;
 select * into outrow from public.hotel_fb_outlets where hotel_id=h and id=outlet and is_published;
 if cfg.id is null or outrow.id is null or not fb_order_private.scope_available(h,'outlet',outlet,moment) or
 (v->>'fulfilment'='pickup' and not cfg.pickup) or (v->>'fulfilment'='room_delivery' and not cfg.room_delivery) then raise exception using errcode='22023',message='orders_outlet_unavailable'; end if;
 for l in select value from jsonb_array_elements(v->'lines') loop
  menu:=(l->>'menu_id')::uuid;q:=(l->>'quantity')::int;
  if l->>'kind'='item' then
   line:=fb_order_private.item_price(h,outlet,menu,(l->>'id')::uuid,l->'options',q,v->>'language',moment);count_leaves:=count_leaves+1;units:=units+q;
  else
   select cb.* into combo from fb_order_private.combos cb join fb_order_private.combo_menus cm on cm.hotel_id=cb.hotel_id and cm.combo_id=cb.id
   join public.hotel_fb_menus m on m.hotel_id=cm.hotel_id and m.id=cm.menu_id
   join public.hotel_fb_outlet_menus om on om.hotel_id=m.hotel_id and om.menu_id=m.id
   where cb.hotel_id=h and cb.id=(l->>'id')::uuid and cb.is_published and m.id=menu and m.is_published and om.outlet_id=outlet;
   if not found or not fb_order_private.scope_available(h,'menu',menu,moment) then raise exception using errcode='22023',message='orders_combo_unavailable'; end if;
   components:='[]';line_total:=combo.amount_minor*q;
   if not exists(select 1 from fb_order_private.combo_slots where hotel_id=h and combo_id=combo.id) then raise exception using errcode='22023',message='orders_combo_empty'; end if;
   for slot in select * from fb_order_private.combo_slots where hotel_id=h and combo_id=combo.id loop
    select count(*) into n from jsonb_array_elements(l->'choices') e join fb_order_private.combo_choices cc on cc.hotel_id=h and cc.id=(e->>'id')::uuid and cc.slot_id=slot.id;
    if n<slot.min_selected or n>slot.max_selected then raise exception using errcode='22023',message='orders_combo_count_invalid'; end if;
   end loop;
   for selected in select value from jsonb_array_elements(l->'choices') loop
    select cc.* into choice from fb_order_private.combo_choices cc join fb_order_private.combo_slots cs on cs.hotel_id=cc.hotel_id and cs.id=cc.slot_id
    where cc.hotel_id=h and cc.id=(selected->>'id')::uuid and cc.active and cs.combo_id=combo.id;
    if not found then raise exception using errcode='22023',message='orders_combo_choice_invalid'; end if;
    select * into slot from fb_order_private.combo_slots where hotel_id=h and id=choice.slot_id;
    component:=fb_order_private.item_price(h,outlet,menu,choice.item_id,selected->'options',q*slot.multiplicity,v->>'language',moment);
    if component->>'currency'<>combo.currency then raise exception using errcode='22023',message='orders_currency_conflict'; end if;
    line_total:=line_total+(component->>'total_minor')::bigint-(component->>'unit_minor')::bigint*(component->>'quantity')::int+choice.extra_minor*(component->>'quantity')::int;
    component:=component||jsonb_build_object('choice_id',choice.id,'choice_name',slot.name,'extra_minor',choice.extra_minor);
    components:=components||jsonb_build_array(component);count_leaves:=count_leaves+1;units:=units+(component->>'quantity')::int;
   end loop;
   line:=jsonb_build_object('kind','combo','origin_id',combo.id,'name',combo.name,'quantity',q,'unit_minor',combo.amount_minor,'total_minor',line_total,'currency',combo.currency,'components',components);
  end if;
  if currency is not null and currency<>line->>'currency' then raise exception using errcode='22023',message='orders_currency_conflict'; end if;
  currency:=line->>'currency';total:=total+(line->>'total_minor')::bigint;lines:=lines||jsonb_build_array(line);
 end loop;
 if total>1000000000000 or count_leaves>60 or units>100 then raise exception using errcode='22023',message='orders_limits_exceeded'; end if;
 return jsonb_build_object('outlet_id',outlet,'outlet_name',outrow.name,'currency',currency,'total_minor',total,'lines',lines);
end $$;

create function public.quote_fb_order(p_hotel_slug text,p_session_secret text,p_outlet_id uuid,p_intent jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s fb_order_private.guest_sessions%rowtype;v jsonb;
begin
 perform fb_order_private.service_only();
 -- Quote does not require collecting a guest name before confirmation.
 v:=fb_order_private.intent(p_intent||jsonb_build_object('first_name','_','last_name','_'));
 select gs.* into s from fb_order_private.guest_sessions gs join public.hotels h on h.id=gs.hotel_id
 where h.slug=p_hotel_slug and gs.secret_digest=fb_order_private.hash(p_session_secret) and gs.expires_at>clock_timestamp();
 if not found then raise exception using errcode='42501',message='orders_session_invalid'; end if;
 return fb_order_private.price(s.hotel_id,p_outlet_id,v,clock_timestamp());
end $$;

create function fb_order_private.event(h uuid,o uuid,g uuid,action text,actor text,metadata jsonb default '{}') returns uuid
language plpgsql set search_path='' as $$
declare result uuid;
begin
 if (metadata-array['status','reason_code','contract_version','line_count'])<>'{}' or octet_length(metadata::text)>512 then raise exception using errcode='22023',message='orders_event_metadata_invalid'; end if;
 insert into fb_order_private.order_events(hotel_id,order_id,group_id,action,actor_id,actor_kind,order_revision,metadata)
 select h,o,g,action,case when actor='staff' then auth.uid() else null end,actor,revision,metadata from fb_order_private.orders where hotel_id=h and id=o returning id into result;
 if actor='staff' then perform fb_order_private.audit(h,action,o); end if;
 return result;
end $$;
create function fb_order_private.add_leaf(h uuid,o uuid,parent uuid,v jsonb,pos integer) returns uuid
language plpgsql set search_path='' as $$
declare g uuid;l uuid:=gen_random_uuid();op jsonb;
begin
 insert into fb_order_private.order_groups(hotel_id,order_id,sector_id,sector_name)
 values(h,o,(v->>'sector_id')::uuid,v->>'sector_name') on conflict(hotel_id,order_id,sector_id) do nothing;
 select id into g from fb_order_private.order_groups where hotel_id=h and order_id=o and sector_id=(v->>'sector_id')::uuid;
 insert into fb_order_private.order_lines(id,hotel_id,order_id,group_id,parent_id,kind,origin_id,name,quantity,unit_minor,total_minor,currency,position)
 values(l,h,o,g,parent,case when parent is null then 'item' else 'component' end,(v->>'origin_id')::uuid,v->>'name',(v->>'quantity')::int,
 case when parent is null then (v->>'unit_minor')::bigint else 0 end,case when parent is null then (v->>'total_minor')::bigint else 0 end,v->>'currency',pos);
 for op in select value from jsonb_array_elements(v->'options') loop
  insert into fb_order_private.order_line_options(hotel_id,order_id,line_id,bill_to_line_id,origin_id,kind,group_name,name,unit_minor,quantity)
  values(h,o,l,coalesce(parent,l),(op->>'origin_id')::uuid,'modifier',op->>'group_name',op->>'name',(op->>'unit_minor')::bigint,(op->>'quantity')::int);
 end loop;
 if parent is not null then
  insert into fb_order_private.order_line_options(hotel_id,order_id,line_id,bill_to_line_id,origin_id,kind,group_name,name,unit_minor,quantity)
  values(h,o,l,parent,(v->>'choice_id')::uuid,'combo_choice',v->>'choice_name',v->>'name',(v->>'extra_minor')::bigint,(v->>'quantity')::int);
 end if;
 return l;
end $$;

create function public.confirm_fb_order(p_hotel_slug text,p_session_secret text,p_key uuid,p_outlet_id uuid,p_intent jsonb,p_room_token text,p_access_digest text,p_expected_total_minor bigint,p_expected_currency text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid;s fb_order_private.guest_sessions%rowtype;idem fb_order_private.idempotency%rowtype;v jsonb;fingerprint text;priced jsonb;
 o fb_order_private.orders%rowtype;room_label text;root jsonb;component jsonb;parent uuid;leaf uuid;position integer:=0;index integer:=0;note text;replayed boolean:=false;moment timestamptz;
begin
 perform fb_order_private.service_only();v:=fb_order_private.intent(p_intent);
 if p_key is null or p_access_digest is null or p_access_digest!~'^[0-9a-f]{64}$' or p_expected_total_minor is null or p_expected_currency is null then raise exception using errcode='22023',message='orders_confirmation_invalid'; end if;
 select id into h from public.hotels where slug=p_hotel_slug for update;
 select * into s from fb_order_private.guest_sessions where hotel_id=h and secret_digest=fb_order_private.hash(p_session_secret) for update;
 if s.id is null then raise exception using errcode='42501',message='orders_session_invalid'; end if;
 fingerprint:=fb_order_private.hash(p_session_secret||jsonb_build_object('intent',v,'outlet',p_outlet_id,'room_context',coalesce(p_room_token,''),'amount',p_expected_total_minor,'currency',p_expected_currency)::text);
 select * into idem from fb_order_private.idempotency where hotel_id=h and session_id=s.id and key_id=p_key;
 moment:=clock_timestamp();
 if idem.order_id is not null then
  if idem.expires_at<=moment then raise exception using errcode='PT410',message='orders_key_expired'; end if;
  if idem.intent_digest<>fingerprint or not exists(select 1 from fb_order_private.order_access_tokens where order_id=idem.order_id and hotel_id=h and secret_digest=p_access_digest) then raise exception using errcode='PT409',message='orders_intent_conflict'; end if;
  select * into o from fb_order_private.orders where id=idem.order_id and hotel_id=h;replayed:=true;
 else
  if s.expires_at<=moment then raise exception using errcode='PT410',message='orders_session_expired'; end if;
  if not public.admit_fb_order_attempt(p_hotel_slug,'session',fb_order_private.hash(p_session_secret)) or not public.admit_fb_order_attempt(p_hotel_slug,'hotel',fb_order_private.hash(h::text))
  then raise exception using errcode='PT429',message='orders_admission_denied'; end if;
  priced:=fb_order_private.price(h,p_outlet_id,v,moment);
  if (priced->>'total_minor')::bigint<>p_expected_total_minor or priced->>'currency'<>p_expected_currency then raise exception using errcode='PT409',message='orders_quote_changed'; end if;
  if v->>'fulfilment'='room_delivery' then
   if not public.is_hotel_module_enabled(h,'rooms.qr') then raise exception using errcode='42501',message='orders_room_context_invalid'; end if;
   select room_number into room_label from public.hotel_room_links where hotel_id=h and room_token=p_room_token and is_active for share;
   if not found then raise exception using errcode='42501',message='orders_room_context_invalid'; end if;
  end if;
  insert into fb_order_private.orders(hotel_id,outlet_origin_id,outlet_name,language,fulfilment,timezone,currency,total_minor)
  values(h,p_outlet_id,priced->>'outlet_name',v->>'language',v->>'fulfilment',(select timezone from fb_order_private.hotel_settings where hotel_id=h),priced->>'currency',(priced->>'total_minor')::bigint) returning * into o;
  insert into fb_order_private.order_private_data(hotel_id,order_id,first_name,last_name,room_label,note) values(h,o.id,v->>'first_name',v->>'last_name',room_label,v->>'note');
  for root in select value from jsonb_array_elements(priced->'lines') loop
   position:=position+1;note:=v->'lines'->index->>'note';index:=index+1;
   if root->>'kind'='item' then leaf:=fb_order_private.add_leaf(h,o.id,null,root,position);
   else
    parent:=gen_random_uuid();leaf:=parent;
    insert into fb_order_private.order_lines(id,hotel_id,order_id,kind,origin_id,name,quantity,unit_minor,total_minor,currency,position)
    values(parent,h,o.id,'combo',(root->>'origin_id')::uuid,root->>'name',(root->>'quantity')::int,(root->>'unit_minor')::bigint,(root->>'total_minor')::bigint,root->>'currency',position);
    for component in select value from jsonb_array_elements(root->'components') loop position:=position+1;perform fb_order_private.add_leaf(h,o.id,parent,component,position);end loop;
   end if;
   if note is not null then insert into fb_order_private.order_line_notes(hotel_id,order_id,line_id,note) values(h,o.id,leaf,note); end if;
  end loop;
  insert into fb_order_private.order_access_tokens(hotel_id,order_id,secret_digest,expires_at) values(h,o.id,p_access_digest,o.created_at+interval '7 days');
  perform fb_order_private.event(h,o.id,null,'orders.registered','guest');
  insert into fb_order_private.idempotency(hotel_id,session_id,key_id,intent_digest,order_id,expires_at) values(h,s.id,p_key,fingerprint,o.id,moment+interval '24 hours');
 end if;
 return jsonb_build_object('order_id',o.id,'status',o.status,'revision',o.revision,'currency',o.currency,'total_minor',o.total_minor,
 'access_expires_at',(select expires_at from fb_order_private.order_access_tokens where hotel_id=h and order_id=o.id),'replayed',replayed);
end $$;

create function fb_order_private.facts(h uuid,o uuid,guest boolean default false) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('order_id',t.id,'status',t.status,'revision',t.revision,'created_at',t.created_at,'terminal_at',t.terminal_at,
 'currency',t.currency,'fulfilment',t.fulfilment,'total_minor',case when guest or fb_order_private.can(h,'orders.supervise') then t.total_minor else null end,
 'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'sector_id',g.sector_id,'sector_name',g.sector_name,'status',g.status,'revision',g.revision))
 from fb_order_private.order_groups g where g.hotel_id=h and g.order_id=o and (guest or fb_order_private.can(h,'orders.read',g.sector_id))),'[]'),
 'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.position) from fb_order_private.order_lines l where l.hotel_id=h and l.order_id=o and
 (guest or fb_order_private.can(h,'orders.supervise') or exists(select 1 from fb_order_private.order_groups g where g.hotel_id=h and g.order_id=o and g.id=l.group_id and fb_order_private.can(h,'orders.read',g.sector_id)))),'[]'),
 'options',coalesce((select jsonb_agg(to_jsonb(op)) from fb_order_private.order_line_options op join fb_order_private.order_lines l on l.hotel_id=op.hotel_id and l.order_id=op.order_id and l.id=op.line_id
 where op.hotel_id=h and op.order_id=o and (guest or fb_order_private.can(h,'orders.supervise') or exists(select 1 from fb_order_private.order_groups g where g.hotel_id=h and g.order_id=o and g.id=l.group_id and fb_order_private.can(h,'orders.read',g.sector_id)))),'[]'),
 'history',coalesce((select jsonb_agg(jsonb_build_object('event_id',e.id,'action',e.action,'at',e.created_at,'revision',e.order_revision,'status',e.metadata->>'status') order by e.order_revision,e.created_at,e.id)
 from fb_order_private.order_events e where e.hotel_id=h and e.order_id=o and (guest or e.group_id is null or exists(select 1 from fb_order_private.order_groups g where g.hotel_id=h and g.order_id=o and g.id=e.group_id and fb_order_private.can(h,'orders.read',g.sector_id)))),'[]'))
 from fb_order_private.orders t where t.hotel_id=h and t.id=o and t.retain_until>clock_timestamp();
$$;
create function public.get_current_hotel_fb_order(p_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.actor();
begin
 if not exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=p_order_id and fb_order_private.can(h,'orders.read',sector_id))
 then raise exception using errcode='42501',message='orders_read_denied'; end if;
 return fb_order_private.facts(h,p_order_id);
end $$;
create function public.get_current_hotel_fb_order_pii(p_order_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.actor();result jsonb;
begin
 if not exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=p_order_id and fb_order_private.can(h,'orders.read',sector_id) and fb_order_private.can(h,'orders.pii.read',sector_id))
 then raise exception using errcode='42501',message='orders_pii_denied'; end if;
 select jsonb_build_object('first_name',first_name,'last_name',last_name,'room_label',room_label,'note',note) into result
 from fb_order_private.order_private_data where hotel_id=h and order_id=p_order_id and expires_at>clock_timestamp();
 -- No accidental caching/audit payload of the returned PII; read audit has IDs only.
 perform fb_order_private.audit(h,'fb.orders.pii_read',p_order_id);
 return coalesce(result,'{}')||jsonb_build_object('line_notes',coalesce((
 select jsonb_agg(jsonb_build_object('line_id',n.line_id,'note',n.note)) from fb_order_private.order_line_notes n
 join fb_order_private.order_lines l on l.hotel_id=n.hotel_id and l.order_id=n.order_id and l.id=n.line_id
 where n.hotel_id=h and n.order_id=p_order_id and n.expires_at>clock_timestamp() and exists(
 select 1 from fb_order_private.order_groups g where g.hotel_id=h and g.order_id=p_order_id
 and fb_order_private.can(h,'orders.read',g.sector_id) and fb_order_private.can(h,'orders.pii.read',g.sector_id)
 and (g.id=l.group_id or exists(select 1 from fb_order_private.order_lines child where child.hotel_id=h and child.order_id=p_order_id and child.parent_id=l.id and child.group_id=g.id)))),'[]'));
end $$;
create function public.get_current_hotel_fb_order_panel(p_limit integer default 50,p_after_created timestamptz default null,p_after_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.actor();result jsonb;
begin
 if p_limit is null or p_limit not between 1 and 50 or (p_after_created is null)<>(p_after_id is null) then raise exception using errcode='22023',message='orders_page_invalid'; end if;
 if not exists(select 1 from fb_order_private.operator_grants where hotel_id=h and user_id=auth.uid() and capability='orders.read' and active) then raise exception using errcode='42501',message='orders_read_denied'; end if;
 select coalesce(jsonb_agg(fb_order_private.facts(h,x.id) order by x.created_at,x.id),'[]') into result from (
 select o.id,o.created_at from fb_order_private.orders o where o.hotel_id=h and o.retain_until>clock_timestamp()
 and (o.terminal_at is null or o.terminal_at>clock_timestamp()-interval '24 hours')
 and (p_after_id is null or (o.created_at,o.id)>(p_after_created,p_after_id))
 and exists(select 1 from fb_order_private.order_groups g where g.hotel_id=h and g.order_id=o.id and fb_order_private.can(h,'orders.read',g.sector_id))
 order by o.created_at,o.id limit p_limit) x;
 return result;
end $$;
create function fb_order_private.token_order(target_slug text,secret text) returns uuid language plpgsql stable set search_path='' as $$
declare result uuid;
begin
 if secret is null or length(secret)<43 or length(secret)>128 then raise exception using errcode='42501',message='orders_access_invalid'; end if;
 select a.order_id into result from fb_order_private.order_access_tokens a join public.hotels h on h.id=a.hotel_id
 join fb_order_private.orders o on o.id=a.order_id and o.hotel_id=a.hotel_id
 where h.slug=target_slug and a.secret_digest=fb_order_private.hash(secret) and a.expires_at>clock_timestamp() and o.retain_until>clock_timestamp();
 if result is null then raise exception using errcode='42501',message='orders_access_invalid'; end if;
 return result;
end $$;
create function public.get_fb_order_status(p_hotel_slug text,p_access_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid;h uuid;
begin
 perform fb_order_private.service_only();o:=fb_order_private.token_order(p_hotel_slug,p_access_secret);
 select hotel_id into h from fb_order_private.orders where id=o;
 return fb_order_private.facts(h,o,true);
end $$;
create function fb_order_private.finish_order(h uuid,o uuid) returns void language plpgsql set search_path='' as $$
declare rank integer;projected_status text;moment timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from fb_order_private.order_groups g where g.hotel_id=h and g.order_id=o and g.status<>'cancelled') then projected_status:='cancelled';
 else
  select min(array_position(array['registered','accepted','preparing','ready','out_for_delivery','delivered'],g.status)) into rank
  from fb_order_private.order_groups g where g.hotel_id=h and g.order_id=o;
  projected_status:=(array['registered','accepted','preparing','ready','out_for_delivery','delivered'])[rank];
 end if;
 update fb_order_private.orders set status=projected_status,revision=revision+1,updated_at=moment,
 terminal_at=case when projected_status in('delivered','cancelled') then coalesce(terminal_at,moment) else null end where hotel_id=h and id=o;
 if projected_status in('delivered','cancelled') then
  update fb_order_private.order_private_data set expires_at=moment+interval '7 days' where hotel_id=h and order_id=o and expires_at>moment;
  update fb_order_private.order_line_notes set expires_at=moment+interval '7 days' where hotel_id=h and order_id=o and expires_at>moment;
  update fb_order_private.order_access_tokens set expires_at=least(expires_at,moment+interval '24 hours') where hotel_id=h and order_id=o;
 end if;
end $$;
create function public.transition_current_hotel_fb_order_group(p_group_id uuid,p_expected_revision integer,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.actor();g fb_order_private.order_groups%rowtype;o fb_order_private.orders%rowtype;event_id uuid;
begin
 select * into g from fb_order_private.order_groups where hotel_id=h and id=p_group_id;
 if not found then raise exception using errcode='P0002',message='orders_group_missing'; end if;
 select * into o from fb_order_private.orders where hotel_id=h and id=g.order_id for update;
 perform fb_order_private.require_cap(h,'orders.transition',g.sector_id);
 if g.revision is distinct from p_expected_revision then raise exception using errcode='PT409',message='orders_revision_conflict'; end if;
 if p_status is null or not ((g.status='registered' and p_status='accepted') or (g.status='accepted' and p_status='preparing') or (g.status='preparing' and p_status='ready')
 or (g.status='ready' and p_status='out_for_delivery' and o.fulfilment='room_delivery')
 or (g.status='ready' and p_status='delivered' and o.fulfilment='pickup') or (g.status='out_for_delivery' and p_status='delivered'))
 then raise exception using errcode='22023',message='orders_transition_invalid'; end if;
 update fb_order_private.order_groups set status=p_status,revision=revision+1,updated_at=clock_timestamp() where hotel_id=h and id=g.id;
 perform fb_order_private.finish_order(h,o.id);
 event_id:=fb_order_private.event(h,o.id,g.id,'orders.'||p_status,'staff',jsonb_build_object('status',p_status));
 return jsonb_build_object('group_id',g.id,'revision',g.revision+1,'order_revision',(select revision from fb_order_private.orders where id=o.id),'event_id',event_id);
end $$;
create function fb_order_private.cancel_order(h uuid,o uuid,actor text,reason text) returns void language plpgsql set search_path='' as $$ begin
 if exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o and status='delivered') then raise exception using errcode='22023',message='orders_cancel_delivered'; end if;
 update fb_order_private.order_groups set status='cancelled',revision=revision+1,updated_at=clock_timestamp() where hotel_id=h and order_id=o and status<>'cancelled';
 perform fb_order_private.finish_order(h,o);
 perform fb_order_private.event(h,o,null,'orders.cancelled',actor,jsonb_build_object('status','cancelled','reason_code',reason));
end $$;
create function public.request_fb_order_cancellation(p_hotel_slug text,p_access_secret text,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare order_uuid uuid;o fb_order_private.orders%rowtype;cfg fb_order_private.hotel_settings%rowtype;r fb_order_private.cancellation_requests%rowtype;auto boolean;
begin
 perform fb_order_private.service_only();order_uuid:=fb_order_private.token_order(p_hotel_slug,p_access_secret);
 -- Same hotel -> order lock order as configuration/confirmation/operation.
 perform 1 from public.hotels where public.hotels.id=(select hotel_id from fb_order_private.orders where orders.id=order_uuid) for update;
 select * into o from fb_order_private.orders where orders.id=order_uuid for update;
 if o.status='cancelled' then return jsonb_build_object('status','cancelled'); end if;
 if o.revision is distinct from p_expected_revision then raise exception using errcode='PT409',message='orders_revision_conflict'; end if;
 if o.status='delivered' then raise exception using errcode='22023',message='orders_cancel_delivered'; end if;
 select * into cfg from fb_order_private.hotel_settings where hotel_id=o.hotel_id;
 auto:=coalesce(cfg.cancel_auto,false) and (cfg.cancel_free or clock_timestamp()<=o.created_at+make_interval(mins=>cfg.cancel_minutes))
 and not exists(select 1 from fb_order_private.order_groups where hotel_id=o.hotel_id and order_id=o.id and status<>'registered');
 if auto then
  perform fb_order_private.cancel_order(o.hotel_id,o.id,'guest','guest_request');return jsonb_build_object('status','cancelled');
 end if;
 insert into fb_order_private.cancellation_requests(hotel_id,order_id) values(o.hotel_id,o.id)
 on conflict(hotel_id,order_id) where status='pending' do update set status='pending' returning * into r;
 if r.revision=1 and not exists(select 1 from fb_order_private.order_events where hotel_id=o.hotel_id and order_id=o.id and action='orders.cancellation_requested') then
  perform fb_order_private.event(o.hotel_id,o.id,null,'orders.cancellation_requested','guest');
 end if;
 return jsonb_build_object('status','pending','request_id',r.id,'revision',r.revision);
end $$;
create function public.decide_current_hotel_fb_order_cancellation(p_request_id uuid,p_expected_revision integer,p_order_revision integer,p_approve boolean,p_reason_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.actor();r fb_order_private.cancellation_requests%rowtype;o fb_order_private.orders%rowtype;
begin
 if p_reason_code not in('guest_request','unavailable','operational','other') or p_reason_code is null or p_approve is null then raise exception using errcode='22023',message='orders_reason_invalid'; end if;
 select * into r from fb_order_private.cancellation_requests where hotel_id=h and id=p_request_id;
 if not found then raise exception using errcode='P0002',message='orders_request_missing'; end if;
 select * into o from fb_order_private.orders where hotel_id=h and id=r.order_id for update;
 if not exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o.id)
 or exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o.id and not fb_order_private.can(h,'orders.cancel',sector_id))
 then raise exception using errcode='42501',message='orders_cancel_denied'; end if;
 if r.revision is distinct from p_expected_revision or o.revision is distinct from p_order_revision or r.status<>'pending' then raise exception using errcode='PT409',message='orders_revision_conflict'; end if;
 if p_approve then
  if o.status in('cancelled','delivered') then raise exception using errcode='22023',message='orders_cancel_terminal'; end if;
  if exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o.id and status='out_for_delivery') then perform fb_order_private.require_cap(h,'orders.supervise'); end if;
  perform fb_order_private.cancel_order(h,o.id,'staff',p_reason_code);
 else perform fb_order_private.event(h,o.id,null,'orders.cancellation_denied','staff',jsonb_build_object('reason_code',p_reason_code)); end if;
 update fb_order_private.cancellation_requests set status=case when p_approve then 'approved' else 'denied' end,revision=revision+1,reason_code=p_reason_code where hotel_id=h and id=r.id;
 return jsonb_build_object('request_id',r.id,'status',case when p_approve then 'approved' else 'denied' end,'revision',r.revision+1);
end $$;

-- No printer/job/bridge. Stable accepted-group events and immutable line refs only.
create function public.get_current_hotel_fb_acceptance_events(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.actor();
begin
 perform fb_order_private.require_cap(h,'orders.supervise');
 return coalesce((select jsonb_agg(jsonb_build_object('event_id',e.id,'contract_version',e.contract_version,'hotel_id',h,'order_id',e.order_id,'group_id',e.group_id,
 'sector_id',g.sector_id,'revision',e.order_revision,'timestamp',e.created_at,
 'line_refs',(select jsonb_agg(l.id) from fb_order_private.order_lines l where l.hotel_id=h and l.order_id=e.order_id and l.group_id=g.id)))
 from fb_order_private.order_events e join fb_order_private.order_groups g on g.hotel_id=e.hotel_id and g.order_id=e.order_id and g.id=e.group_id
 where e.hotel_id=h and e.order_id=p_order_id and e.action='orders.accepted'),'[]');
end $$;

create function public.purge_expired_fb_order_data(p_batch integer default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o record;moment timestamptz:=clock_timestamp();n integer:=0;pii integer:=0;notes integer:=0;alerts integer:=0;
begin
 perform fb_order_private.service_only();
 if p_batch is null or p_batch not between 1 and 1000 then raise exception using errcode='22023',message='orders_batch_invalid'; end if;
 perform set_config('fb_orders.retention','on',true);
 for o in select id,hotel_id from fb_order_private.orders where terminal_at is null and created_at<=moment-interval '7 days' and alerted_at is null order by created_at,id limit p_batch for update skip locked loop
  update fb_order_private.orders set alerted_at=moment,revision=revision+1 where id=o.id;
  perform fb_order_private.event(o.hotel_id,o.id,null,'orders.retention_alert','system');alerts:=alerts+1;
 end loop;
 with d as (select order_id from fb_order_private.order_private_data where expires_at<=moment limit p_batch for update skip locked)
 delete from fb_order_private.order_private_data p using d where p.order_id=d.order_id;get diagnostics pii=row_count;
 with d as (select line_id from fb_order_private.order_line_notes where expires_at<=moment limit p_batch for update skip locked)
 delete from fb_order_private.order_line_notes p using d where p.line_id=d.line_id;get diagnostics notes=row_count;
 with d as (select order_id from fb_order_private.order_access_tokens where expires_at<=moment limit p_batch)
 delete from fb_order_private.order_access_tokens p using d where p.order_id=d.order_id;
 with d as (select ctid from fb_order_private.idempotency where expires_at<=moment limit p_batch)
 delete from fb_order_private.idempotency p using d where p.ctid=d.ctid;
 with d as (select id from fb_order_private.guest_sessions s where expires_at<=moment and not exists(select 1 from fb_order_private.idempotency i where i.hotel_id=s.hotel_id and i.session_id=s.id and i.expires_at>moment) limit p_batch)
 delete from fb_order_private.guest_sessions p using d where p.id=d.id;
 with d as (select ctid from fb_order_private.admission_buckets where window_at<moment-interval '2 hours' limit p_batch)
 delete from fb_order_private.admission_buckets p using d where p.ctid=d.ctid;
 for o in select id from fb_order_private.orders where retain_until<=moment order by retain_until,id limit p_batch for update skip locked loop
  delete from fb_order_private.orders where id=o.id;n:=n+1;
 end loop;
 perform set_config('fb_orders.retention','off',true);
 return jsonb_build_object('pii',pii,'notes',notes,'alerts',alerts,'facts',n);
end $$;
create function fb_order_private.immutable_fact() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='DELETE' and current_setting('fb_orders.retention',true)='on' then return old; end if;
 raise exception using errcode='42501',message='orders_snapshot_immutable';
end $$;
do $$ declare t text;begin
 foreach t in array array['order_lines','order_line_options','order_events'] loop
  execute format('create trigger b1_immutable before update or delete on fb_order_private.%I for each row execute function fb_order_private.immutable_fact()',t);
 end loop;
end $$;

-- Deny helper execution, including the default PUBLIC grant.
revoke all on all functions in schema fb_order_private from public,anon,authenticated,service_role;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in(
 'save_current_hotel_fb_order_config','get_current_hotel_fb_order_config','begin_fb_order_session','admit_fb_order_attempt','quote_fb_order','confirm_fb_order',
 'get_current_hotel_fb_order','get_current_hotel_fb_order_pii','get_current_hotel_fb_order_panel','get_fb_order_status','transition_current_hotel_fb_order_group',
 'request_fb_order_cancellation','decide_current_hotel_fb_order_cancellation','get_current_hotel_fb_acceptance_events','purge_expired_fb_order_data') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  execute format('grant execute on function %s to %I',f.signature,case when f.proname in('begin_fb_order_session','admit_fb_order_attempt','quote_fb_order','confirm_fb_order','get_fb_order_status','request_fb_order_cancellation','purge_expired_fb_order_data') then 'service_role' else 'authenticated' end);
 end loop;
end $$;
commit;
