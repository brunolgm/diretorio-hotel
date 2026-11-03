-- Sprint 53 B2+B3. Additive boundary; no hotel provisioning or real content.
begin;
create table fb_order_private.quotes(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,session_id uuid not null,
 outlet_id uuid not null,secret_digest text not null unique check(secret_digest~'^[0-9a-f]{64}$'),
 basket_digest text not null check(basket_digest~'^[0-9a-f]{64}$'),priced jsonb not null,
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',
 committed_order_id uuid,confirm_key uuid,confirm_digest text,
 foreign key(hotel_id,session_id) references fb_order_private.guest_sessions(hotel_id,id) on delete cascade,
 foreign key(hotel_id,committed_order_id) references fb_order_private.orders(hotel_id,id) on delete cascade,
 check((committed_order_id is null and confirm_key is null and confirm_digest is null) or
 (committed_order_id is not null and confirm_key is not null and confirm_digest is not null and confirm_digest~'^[0-9a-f]{64}$'))
);
create index b23_quotes_session on fb_order_private.quotes(hotel_id,session_id);
create index b23_quotes_order on fb_order_private.quotes(hotel_id,committed_order_id);
create index b23_quotes_expiry on fb_order_private.quotes(expires_at);
alter table fb_order_private.quotes enable row level security;
revoke all on fb_order_private.quotes from public,anon,authenticated,service_role;

-- Free observations allow newlines; names/configuration still reject control characters.
create or replace function fb_order_private.valid_text(v text,lim integer,required boolean default false) returns text
language plpgsql immutable set search_path='' as $$ begin
 v:=nullif(btrim(v),'');
 if (required and v is null) or length(v)>lim or
 (case when required then v else replace(v,E'\n','') end)~'[[:cntrl:]<>]'
 then raise exception using errcode='22023',message='orders_text_invalid';end if;
 return v;
end $$;

-- Narrow drain actor: active profile + existing operational role, including archived hotel.
-- Configuration/catalogue/Auth helpers retain their original lifecycle rules.
create function fb_order_private.operational_role(target_hotel uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$ begin
 return exists(select 1 from public.profiles p join public.hotels h on h.id=p.hotel_id
 where p.id=auth.uid() and p.hotel_id=target_hotel and p.is_active and
 lower(btrim(coalesce(p.role,''))) in('operador','editor','administrador','admin','owner'));
end $$;
create or replace function fb_order_private.can(h uuid,cap text,sector uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select (case when cap='orders.configure' then public.has_active_hotel_role(h,'editor') else fb_order_private.operational_role(h) end)
 and exists(select 1 from fb_order_private.operator_grants g join public.profiles p on p.id=g.user_id and p.hotel_id=g.hotel_id and p.is_active
 where g.hotel_id=h and g.user_id=auth.uid() and g.capability=cap and g.active and (g.sector_id is null or g.sector_id=sector));
$$;
create function fb_order_private.drain_actor() returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid;begin
 select hotel_id into h from public.profiles where id=auth.uid() and is_active for share;
 if h is null or not fb_order_private.operational_role(h) then raise exception using errcode='42501',message='orders_operator_required';end if;
 perform 1 from public.hotels where id=h for update;
 if not found then raise exception using errcode='42501',message='orders_hotel_invalid';end if;
 return h;
end $$;
-- Evolve only the operational entrypoints, keeping their B1 bodies/ACLs and CAS semantics.
do $$ declare f record;definition text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(
 'get_current_hotel_fb_order','get_current_hotel_fb_order_pii','get_current_hotel_fb_order_panel',
 'transition_current_hotel_fb_order_group','decide_current_hotel_fb_order_cancellation','get_current_hotel_fb_acceptance_events') loop
  definition:=pg_get_functiondef(f.oid);
  if position('fb_order_private.actor()' in definition)=0 then raise exception 'B23 operational prerequisite changed';end if;
  execute replace(definition,'fb_order_private.actor()','fb_order_private.drain_actor()');
 end loop;
end $$;

create function fb_order_private.public_item(h uuid,outlet uuid,menu uuid,item uuid,lang text,moment timestamptz) returns jsonb
language plpgsql stable set search_path='' as $$
declare i public.hotel_fb_items%rowtype;c public.hotel_fb_categories%rowtype;d jsonb;groups jsonb;available boolean;hidden boolean;sector uuid;
begin
 select * into i from public.hotel_fb_items where hotel_id=h and id=item and is_published;
 select * into c from public.hotel_fb_categories where hotel_id=h and id=i.category_id and menu_id=menu and is_published;
 if i.id is null or c.id is null or not exists(select 1 from public.hotel_fb_menus where hotel_id=h and id=menu and is_published) or
 not exists(select 1 from public.hotel_fb_outlet_menus where hotel_id=h and outlet_id=outlet and menu_id=menu) then return null;end if;
 select coalesce((select sector_id from fb_order_private.item_fulfilment where hotel_id=h and outlet_id=outlet and item_id=item),default_sector_id)
 into sector from fb_order_private.outlet_settings where hotel_id=h and id=outlet;
 available:=i.is_available and i.price_amount_minor is not null and not i.price_on_request and
 exists(select 1 from fb_order_private.sectors where hotel_id=h and id=sector and active) and
 fb_order_private.scope_available(h,'outlet',outlet,moment) and fb_order_private.scope_available(h,'menu',menu,moment) and fb_order_private.scope_available(h,'item',item,moment);
 hidden:=exists(select 1 from fb_order_private.availability_scopes s where s.hotel_id=h and s.display_mode='hide' and
 ((s.outlet_id=outlet and not fb_order_private.scope_available(h,'outlet',outlet,moment)) or
 (s.menu_id=menu and not fb_order_private.scope_available(h,'menu',menu,moment)) or
 (s.item_id=item and (not i.is_available or not fb_order_private.scope_available(h,'item',item,moment)))));
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'selection',g.selection,'min',g.min_selected,'max',g.max_selected,
 'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'amount_minor',o.amount_minor) order by o.sort_order,o.id)
 from fb_order_private.modifier_options o where o.hotel_id=h and o.group_id=g.id and o.active and o.currency=i.currency),'[]')) order by g.sort_order,g.id),'[]') into groups
 from fb_order_private.modifier_groups g where g.hotel_id=h and g.item_id=item and g.active;
 if exists(select 1 from jsonb_array_elements(groups) g where jsonb_array_length(g->'options')<(g->>'min')::int) then available:=false;end if;
 d:=fb_private.localized('item',to_jsonb(i),lang);
 return jsonb_build_object('id',i.id,'kind','item','menu_id',menu,'category_id',c.id,'name',d->>'name',
 'description',coalesce(d->>'short_description',d->>'full_description'),'image_path',i.main_image_path,
 'allergens',d->>'allergens_info','dietary',d->>'dietary_info','amount_minor',i.price_amount_minor,'currency',i.currency,
 'available',available,'hidden',hidden,'groups',groups,'sort_order',i.sort_order);
end $$;

create function public.get_fb_order_offer(p_hotel_slug text,p_language text default 'pt') returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid;moment timestamptz:=clock_timestamp();o record;m record;i record;combo record;slot record;choice record;
 outlets jsonb:='[]';menus jsonb;products jsonb;slots jsonb;choices jsonb;d jsonb;od jsonb;md jsonb;ci jsonb;
 outlet_available boolean;combo_available boolean;combo_hidden boolean;native_enabled boolean;
begin
 perform fb_order_private.service_only();
 if p_language not in('pt','en','es') then raise exception using errcode='22023',message='orders_language_invalid';end if;
 select id into h from public.hotels where slug=p_hotel_slug and platform_status='active';
 if h is null or not public.is_hotel_module_enabled(h,'core.directory') or not public.is_hotel_module_enabled(h,'fb.menu') then return jsonb_build_object('outlets','[]'::jsonb);end if;
 native_enabled:=fb_order_private.native_hotel(h);
 for o in select t.*,cfg.accepting,cfg.pickup,cfg.room_delivery from public.hotel_fb_outlets t
 join fb_order_private.outlet_settings cfg on cfg.hotel_id=t.hotel_id and cfg.id=t.id and cfg.mode='native'
 where t.hotel_id=h and t.is_published order by t.sort_order,t.id loop
  outlet_available:=native_enabled and o.accepting and fb_order_private.scope_available(h,'outlet',o.id,moment);
  menus:='[]';products:='[]';
  for m in select t.*,l.sort_order as link_sort from public.hotel_fb_menus t join public.hotel_fb_outlet_menus l on l.hotel_id=t.hotel_id and l.menu_id=t.id
  where t.hotel_id=h and l.outlet_id=o.id and t.is_published order by l.sort_order,t.sort_order,t.id loop
   md:=fb_private.localized('menu',to_jsonb(m),p_language);
   menus:=menus||jsonb_build_array(jsonb_build_object('id',m.id,'name',md->>'name','categories',coalesce((select jsonb_agg(
    jsonb_build_object('id',c.id,'name',fb_private.localized('category',to_jsonb(c),p_language)->>'name') order by c.sort_order,c.id)
    from public.hotel_fb_categories c where c.hotel_id=h and c.menu_id=m.id and c.is_published),'[]')));
   for i in select t.id from public.hotel_fb_items t join public.hotel_fb_categories c on c.hotel_id=t.hotel_id and c.id=t.category_id
    where t.hotel_id=h and c.menu_id=m.id and c.is_published and t.is_published order by c.sort_order,t.sort_order,t.id loop
    d:=fb_order_private.public_item(h,o.id,m.id,i.id,p_language,moment);
    if d is not null and not (d->>'hidden')::boolean then products:=products||jsonb_build_array(d||jsonb_build_object('available',outlet_available and (d->>'available')::boolean));end if;
   end loop;
   for combo in select t.* from fb_order_private.combos t join fb_order_private.combo_menus l on l.hotel_id=t.hotel_id and l.combo_id=t.id
    where t.hotel_id=h and l.menu_id=m.id and t.is_published order by t.id loop
    slots:='[]';combo_available:=outlet_available and fb_order_private.scope_available(h,'menu',m.id,moment);combo_hidden:=false;
    for slot in select * from fb_order_private.combo_slots where hotel_id=h and combo_id=combo.id order by id loop
     choices:='[]';
     for choice in select * from fb_order_private.combo_choices where hotel_id=h and slot_id=slot.id and active order by id loop
      ci:=fb_order_private.public_item(h,o.id,m.id,choice.item_id,p_language,moment);
      if ci is not null and not (ci->>'hidden')::boolean and ci->>'currency'=combo.currency then
       choices:=choices||jsonb_build_array(jsonb_build_object('id',choice.id,'extra_minor',choice.extra_minor,'item',ci));
      end if;
     end loop;
     if (select count(*) from jsonb_array_elements(choices) x where (x#>>'{item,available}')::boolean)<slot.min_selected then combo_available:=false;end if;
     slots:=slots||jsonb_build_array(jsonb_build_object('id',slot.id,'name',slot.name,'min',slot.min_selected,'max',slot.max_selected,'multiplicity',slot.multiplicity,'choices',choices));
    end loop;
    if jsonb_array_length(slots)=0 then combo_available:=false;end if;
    combo_hidden:=exists(select 1 from fb_order_private.availability_scopes where hotel_id=h and menu_id=m.id and display_mode='hide') and not fb_order_private.scope_available(h,'menu',m.id,moment);
    if not combo_hidden then products:=products||jsonb_build_array(jsonb_build_object('id',combo.id,'kind','combo','menu_id',m.id,'category_id',null,'name',combo.name,
     'amount_minor',combo.amount_minor,'currency',combo.currency,'available',combo_available,'groups','[]'::jsonb,'slots',slots));end if;
   end loop;
  end loop;
  od:=fb_private.localized('outlet',to_jsonb(o),p_language);
  outlets:=outlets||jsonb_build_array(jsonb_build_object('id',o.id,'name',od->>'name','description',od->>'short_description','image_path',o.main_image_path,
   'available',outlet_available,'hidden',not outlet_available and exists(select 1 from fb_order_private.availability_scopes where hotel_id=h and outlet_id=o.id and display_mode='hide'),
   'pickup',o.pickup,'room_delivery',o.room_delivery,'menus',menus,'products',products));
 end loop;
 return jsonb_build_object('outlets',outlets,'as_of',moment);
end $$;

create function public.create_fb_order_quote(p_hotel_slug text,p_session_secret text,p_outlet_id uuid,p_intent jsonb,p_quote_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid;s fb_order_private.guest_sessions%rowtype;v jsonb;priced jsonb;q fb_order_private.quotes%rowtype;
begin
 perform fb_order_private.service_only();
 select id into h from public.hotels where slug=p_hotel_slug for update;
 select * into s from fb_order_private.guest_sessions where hotel_id=h and secret_digest=fb_order_private.hash(p_session_secret) and expires_at>clock_timestamp() for update;
 if s.id is null then raise exception using errcode='PT410',message='orders_session_expired';end if;
 v:=fb_order_private.intent(p_intent||jsonb_build_object('first_name','_','last_name','_'));
 priced:=fb_order_private.price(h,p_outlet_id,v,clock_timestamp());
 -- Bound abandoned references per session. Old committed quotes remain for B1 replay.
 delete from fb_order_private.quotes where hotel_id=h and session_id=s.id and committed_order_id is null and expires_at<=clock_timestamp();
 if (select count(*) from fb_order_private.quotes where hotel_id=h and session_id=s.id and committed_order_id is null)>=20 or
 (select count(*) from fb_order_private.quotes where hotel_id=h and session_id=s.id)>=200
 then raise exception using errcode='PT429',message='orders_quote_quota';end if;
 insert into fb_order_private.quotes(hotel_id,session_id,outlet_id,secret_digest,basket_digest,priced)
 values(h,s.id,p_outlet_id,p_quote_digest,fb_order_private.hash(p_session_secret||(v-'first_name'-'last_name'-'note')::text),priced) returning * into q;
 return jsonb_build_object('quote_id',q.id,'expires_at',q.expires_at,'priced',priced);
end $$;

create function public.confirm_fb_order_from_quote(p_hotel_slug text,p_session_secret text,p_outlet_id uuid,p_quote_id uuid,p_quote_secret text,
 p_key uuid,p_intent jsonb,p_room_token text,p_access_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid;s fb_order_private.guest_sessions%rowtype;q fb_order_private.quotes%rowtype;v jsonb;result jsonb;o fb_order_private.orders%rowtype;fresh jsonb;
begin
 perform fb_order_private.service_only();
 select id into h from public.hotels where slug=p_hotel_slug for update;
 select * into s from fb_order_private.guest_sessions where hotel_id=h and secret_digest=fb_order_private.hash(p_session_secret) for update;
 select * into q from fb_order_private.quotes where hotel_id=h and session_id=s.id and id=p_quote_id and outlet_id=p_outlet_id
 and secret_digest=fb_order_private.hash(p_quote_secret) for update;
 if q.id is null then raise exception using errcode='42501',message='orders_quote_invalid';end if;
 v:=fb_order_private.intent(p_intent);
 if q.basket_digest<>fb_order_private.hash(p_session_secret||(v-'first_name'-'last_name'-'note')::text)
 then raise exception using errcode='PT409',message='orders_quote_changed';end if;
 if q.committed_order_id is not null then
  if q.confirm_key<>p_key or q.confirm_digest<>fb_order_private.hash(p_session_secret||v::text) then raise exception using errcode='PT409',message='orders_intent_conflict';end if;
  if not exists(select 1 from fb_order_private.idempotency where hotel_id=h and session_id=s.id and key_id=p_key and order_id=q.committed_order_id and expires_at>clock_timestamp())
  then raise exception using errcode='PT410',message='orders_idempotency_expired';end if;
  -- Reissue only the same session-derived credential; room context may have changed since ACK loss.
  if not exists(select 1 from fb_order_private.order_access_tokens where hotel_id=h and order_id=q.committed_order_id and secret_digest=p_access_digest and expires_at>clock_timestamp())
  then raise exception using errcode='42501',message='orders_access_invalid';end if;
  select * into o from fb_order_private.orders where hotel_id=h and id=q.committed_order_id;
  return jsonb_build_object('order_id',o.id,'status',o.status,'revision',o.revision,'currency',o.currency,'total_minor',o.total_minor,
   'access_expires_at',(select expires_at from fb_order_private.order_access_tokens where hotel_id=h and order_id=o.id),'replayed',true);
 end if;
 if q.expires_at<=clock_timestamp() then raise exception using errcode='PT410',message='orders_quote_expired';end if;
 begin
  fresh:=fb_order_private.price(h,p_outlet_id,v,clock_timestamp());
 exception when sqlstate '22023' or sqlstate '23503' then
  raise exception using errcode='PT409',message='orders_quote_changed';
 end;
 if fresh<>q.priced then raise exception using errcode='PT409',message='orders_quote_changed';end if;
 -- B1 owns raw-intent normalization. Its internal normalized representation is not raw input.
 begin
  result:=public.confirm_fb_order(p_hotel_slug,p_session_secret,p_key,p_outlet_id,p_intent,p_room_token,p_access_digest,(q.priced->>'total_minor')::bigint,q.priced->>'currency');
 exception when sqlstate '22023' then
  -- A calendar can close between the two authoritative checks, even under the hotel lock.
  raise exception using errcode='PT409',message='orders_quote_changed';
 end;
 update fb_order_private.quotes set committed_order_id=(result->>'order_id')::uuid,confirm_key=p_key,confirm_digest=fb_order_private.hash(p_session_secret||v::text) where id=q.id;
 return result;
end $$;

-- Independent, committed HTTP admission. No IP or device identifiers are collected.
alter table fb_order_private.admission_buckets drop constraint admission_buckets_scope_check;
alter table fb_order_private.admission_buckets add constraint admission_buckets_scope_check check(scope in('session','hotel','network','room','access','http_quote','http_confirm','http_status','http_cancel','http_offer','http_restart'));
create function public.admit_fb_order_http(p_hotel_slug text,p_action text,p_digest text) returns boolean
language plpgsql security definer set search_path='' as $$
declare h uuid;n integer;cap integer;hotel_cap integer;bucket_scope text;bucket_window timestamptz:=date_trunc('minute',clock_timestamp());d text;
begin
 perform fb_order_private.service_only();
 if p_action is null or p_action not in('quote','confirm','status','cancel','offer','restart') or (p_digest is not null and p_digest!~'^[0-9a-f]{64}$') then raise exception using errcode='22023',message='orders_admission_invalid';end if;
 select id into h from public.hotels where slug=p_hotel_slug;
 if h is null then return false;end if;
 bucket_scope:='http_'||p_action;cap:=case p_action when 'quote' then 15 when 'confirm' then 20 when 'cancel' then 10 when 'restart' then 5 else 60 end;
 hotel_cap:=case when p_action in('status','offer') then 1800 when p_action='restart' then 120 else 240 end;
 foreach d in array array[fb_order_private.hash(h::text||p_action),p_digest] loop
  if d is null then continue;end if;
  insert into fb_order_private.admission_buckets as b values(h,bucket_scope,d,bucket_window,1)
   on conflict(hotel_id,scope,digest,window_at) do update set used=least(b.used+1,12001) returning used into n;
  if n>(case when d=p_digest then cap else hotel_cap end) then return false;end if;
 end loop;
 return true;
end $$;

create function public.get_fb_order_cancellation_info(p_hotel_slug text,p_access_secret text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o uuid;h uuid;result jsonb;begin
 perform fb_order_private.service_only();o:=fb_order_private.token_order(p_hotel_slug,p_access_secret);
 select hotel_id into h from fb_order_private.orders where id=o;
 select jsonb_build_object('automatic',cancel_auto and cancel_free,'minutes',cancel_minutes) into result from fb_order_private.hotel_settings where hotel_id=h;
 return coalesce(result,'{}')||jsonb_build_object('request_status',(select status from fb_order_private.cancellation_requests where hotel_id=h and order_id=o order by created_at desc,id desc limit 1));
end $$;

create function public.get_current_hotel_fb_order_access() returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.drain_actor();begin
 if not exists(select 1 from fb_order_private.operator_grants where hotel_id=h and user_id=auth.uid() and active and capability='orders.read')
 then raise exception using errcode='42501',message='orders_read_denied';end if;
 return jsonb_build_object('hotel_id',h,'hotel',(select jsonb_build_object('name',name,'city',city,'logo_url',logo_url,'brand_code',brand_code,'theme_preset',theme_preset) from public.hotels where id=h),
 'hotel_status',(select platform_status from public.hotels where id=h),'accepting',fb_order_private.native_hotel(h) and exists(
 select 1 from fb_order_private.outlet_settings s join public.hotel_fb_outlets o on o.hotel_id=s.hotel_id and o.id=s.id
 where s.hotel_id=h and s.mode='native' and s.accepting and o.is_published and fb_order_private.scope_available(h,'outlet',s.id,clock_timestamp())),
 'capabilities',coalesce((select jsonb_agg(jsonb_build_object('capability',capability,'sector_id',sector_id) order by capability,sector_id)
 from fb_order_private.operator_grants where hotel_id=h and user_id=auth.uid() and active),'[]'));
end $$;

create function fb_order_private.panel_facts(h uuid,o uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb;may_cancel boolean;begin
 result:=fb_order_private.facts(h,o);
 if result is null then return null;end if;
 -- A global supervisor capability never widens the explicit read-sector scope in B3.
 result:=result||jsonb_build_object('lines',coalesce((select jsonb_agg(l order by (l->>'position')::int) from jsonb_array_elements(result->'lines') l
 where exists(select 1 from jsonb_array_elements(result->'groups') g where g->>'id'=l->>'group_id') or
 (l->>'kind'='combo' and not exists(select 1 from fb_order_private.order_lines child where child.hotel_id=h and child.order_id=o and child.parent_id=(l->>'id')::uuid and not exists(select 1 from jsonb_array_elements(result->'groups') g where g->>'id'=child.group_id::text)))),'[]'),
 'total_minor',case when not exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o and not fb_order_private.can(h,'orders.read',sector_id)) then result->'total_minor' else 'null'::jsonb end);
 result:=result||jsonb_build_object('options',coalesce((select jsonb_agg(op) from jsonb_array_elements(result->'options') op where exists(select 1 from jsonb_array_elements(result->'lines') l where l->>'id'=op->>'line_id')),'[]'));
 may_cancel:=not exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o and (not fb_order_private.can(h,'orders.cancel',sector_id) or not fb_order_private.can(h,'orders.read',sector_id))) and
 (not exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o and status='out_for_delivery') or fb_order_private.can(h,'orders.supervise'));
 return result||jsonb_build_object('permissions',jsonb_build_object('pii',exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o and fb_order_private.can(h,'orders.read',sector_id) and fb_order_private.can(h,'orders.pii.read',sector_id)),
 'cancel',may_cancel,'transition_groups',coalesce((select jsonb_agg(id) from fb_order_private.order_groups where hotel_id=h and order_id=o and fb_order_private.can(h,'orders.read',sector_id) and fb_order_private.can(h,'orders.transition',sector_id)),'[]')),
 'cancellation_requests',coalesce((select jsonb_agg(jsonb_build_object('id',case when may_cancel then id end,'revision',case when may_cancel then revision end,'status',status) order by created_at,id)
 from fb_order_private.cancellation_requests where hotel_id=h and order_id=o),'[]'));
end $$;

create function public.get_current_hotel_fb_order_panel_v2(p_limit integer default 50,p_after_created timestamptz default null,p_after_id uuid default null,p_history boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.drain_actor();result jsonb;begin
 perform public.get_current_hotel_fb_order_access();
 if p_limit is null or p_limit not between 1 and 50 or (p_after_created is null)<>(p_after_id is null) or p_history is null
 then raise exception using errcode='22023',message='orders_page_invalid';end if;
 select coalesce(jsonb_agg(fb_order_private.panel_facts(h,x.id) order by x.created_at,x.id),'[]') into result from(
 select o.id,o.created_at from fb_order_private.orders o where o.hotel_id=h and o.retain_until>clock_timestamp()
 and (p_history or o.terminal_at is null or o.terminal_at>clock_timestamp()-interval '24 hours')
 and (p_after_id is null or (o.created_at,o.id)>(p_after_created,p_after_id))
 and exists(select 1 from fb_order_private.order_groups g where g.hotel_id=h and g.order_id=o.id and fb_order_private.can(h,'orders.read',g.sector_id))
 order by o.created_at,o.id limit p_limit)x;
 return result;
end $$;

create function public.get_current_hotel_fb_order_private_view(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.drain_actor();result jsonb;expiry timestamptz;begin
 result:=public.get_current_hotel_fb_order_pii(p_order_id);
 select expires_at into expiry from fb_order_private.order_private_data where hotel_id=h and order_id=p_order_id;
 if expiry is null or expiry<=clock_timestamp() then result:=jsonb_build_object('line_notes','[]'::jsonb);end if;
 return result||jsonb_build_object('expired',expiry is null or expiry<=clock_timestamp(),'expires_at',case when expiry>clock_timestamp() then expiry end);
end $$;

create function public.transition_current_hotel_fb_order_group_v2(p_group_id uuid,p_expected_revision integer,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.drain_actor();sector uuid;begin
 select sector_id into sector from fb_order_private.order_groups where hotel_id=h and id=p_group_id;
 if sector is null then raise exception using errcode='42501',message='orders_read_denied';end if;
 perform fb_order_private.require_cap(h,'orders.read',sector);
 return public.transition_current_hotel_fb_order_group(p_group_id,p_expected_revision,p_status);
end $$;
create function public.decide_current_hotel_fb_order_cancellation_v2(p_request_id uuid,p_expected_revision integer,p_order_revision integer,p_approve boolean,p_reason_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.drain_actor();o uuid;begin
 select order_id into o from fb_order_private.cancellation_requests where hotel_id=h and id=p_request_id;
 if o is null or exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o and not fb_order_private.can(h,'orders.read',sector_id))
 then raise exception using errcode='42501',message='orders_read_denied';end if;
 return public.decide_current_hotel_fb_order_cancellation(p_request_id,p_expected_revision,p_order_revision,p_approve,p_reason_code);
end $$;

-- The existing bounded B1 maintenance entrypoint also collects abandoned quote references.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.purge_expired_fb_order_data(integer)'::regprocedure);
 -- Keep the entire B1 collector and its service-only gate, extending just before return.
 if position('return jsonb_build_object(''pii''' in definition)=0 then raise exception 'B23 GC prerequisite changed';end if;
 if position('and i.expires_at>moment) limit p_batch)' in definition)=0 then raise exception 'B23 session GC prerequisite changed';end if;
 -- Quotes are collected in their own bounded batch before a later pass removes empty sessions.
 -- This prevents the existing session FK cascade from expanding one batch into many quotes.
 definition:=replace(definition,'and i.expires_at>moment) limit p_batch)',
 'and i.expires_at>moment) and not exists(select 1 from fb_order_private.quotes q where q.hotel_id=s.hotel_id and q.session_id=s.id) limit p_batch)');
 definition:=replace(definition,'return jsonb_build_object(''pii''',
 'delete from fb_order_private.quotes where id in (select id from fb_order_private.quotes where expires_at<clock_timestamp()-interval ''24 hours'' order by expires_at limit p_batch); return jsonb_build_object(''pii''');
 execute definition;
end $$;

revoke all on all functions in schema fb_order_private from public,anon,authenticated,service_role;
do $$ declare f record;role_name text;begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(
 'get_fb_order_offer','create_fb_order_quote','confirm_fb_order_from_quote','admit_fb_order_http','get_fb_order_cancellation_info',
 'get_current_hotel_fb_order_access','get_current_hotel_fb_order_panel_v2','get_current_hotel_fb_order_private_view',
 'transition_current_hotel_fb_order_group_v2','decide_current_hotel_fb_order_cancellation_v2') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.oid::regprocedure);
  role_name:=case when f.proname like '%current_hotel%' then 'authenticated' else 'service_role' end;
  execute format('grant execute on function %s to %I',f.oid::regprocedure,role_name);
 end loop;
end $$;
commit;
