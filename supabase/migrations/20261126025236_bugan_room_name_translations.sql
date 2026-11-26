begin;

create table fb_order_private.room_name_translations (
 hotel_id uuid not null, outlet_id uuid not null,
 kind text not null check(kind in('item','combo','combo_slot','modifier_group','modifier_option')),
 entity_id uuid not null, source_name text not null check(length(source_name) between 1 and 160),
 name_en text check(name_en is null or length(name_en) between 1 and 160),
 name_es text check(name_es is null or length(name_es) between 1 and 160),
 revision integer not null check(revision>0), updated_at timestamptz not null default clock_timestamp(),
 primary key(hotel_id,outlet_id,kind,entity_id),
 foreign key(hotel_id,outlet_id) references public.hotel_fb_outlets(hotel_id,id) on delete restrict
);
alter table fb_order_private.room_name_translations enable row level security;
alter table fb_order_private.room_name_translations force row level security;
revoke all on fb_order_private.room_name_translations from public,anon,authenticated,service_role;

-- Authoritative membership, including drafts, without any pricing or rule fields.
create function fb_order_private.room_name_sources(h uuid, outlet uuid)
returns table(kind text,id uuid,source_name text,context_name text,parent_id uuid)
language sql stable set search_path='' as $$
 with scope as (
  select o.id from public.hotel_fb_outlets o join public.hotels hotel on hotel.id=o.hotel_id
  where o.hotel_id=h and o.id=outlet and o.type='room_service' and o.is_published
   and o.action_type<>'external_url' and hotel.slug='bugan-recife' and hotel.platform_status='active'
 ), items as materialized (
  select distinct i.id,i.name,c.name as category_name
  from public.hotel_fb_items i join public.hotel_fb_categories c on (c.hotel_id,c.id)=(i.hotel_id,i.category_id)
  join public.hotel_fb_outlet_menus l on (l.hotel_id,l.menu_id)=(c.hotel_id,c.menu_id)
  where i.hotel_id=h and l.outlet_id=outlet and exists(select 1 from scope)
 ), combos as materialized (
  select c.id,c.name from fb_order_private.combos c where c.hotel_id=h and c.room_outlet_id=outlet
   and exists(select 1 from scope) and exists(select 1 from fb_order_private.combo_menus m
    join public.hotel_fb_outlet_menus l on (l.hotel_id,l.menu_id)=(m.hotel_id,m.menu_id)
    where m.hotel_id=h and m.combo_id=c.id and l.outlet_id=outlet)
 ), groups as materialized (
  select g.id,g.name,g.item_id,i.name as item_name from fb_order_private.modifier_groups g
  join items i on i.id=g.item_id where g.hotel_id=h and g.room_outlet_id=outlet
 )
 select 'item',i.id,i.name,i.category_name,null::uuid from items i
 union all select 'combo',c.id,c.name,'Room Service',null::uuid from combos c
 union all select 'combo_slot',s.id,s.name,c.name,c.id from fb_order_private.combo_slots s join combos c on c.id=s.combo_id where s.hotel_id=h
 union all select 'modifier_group',g.id,g.name,g.item_name,g.item_id from groups g
 union all select 'modifier_option',o.id,o.name,g.item_name||' · '||g.name,g.id
  from fb_order_private.modifier_options o join groups g on g.id=o.group_id where o.hotel_id=h;
$$;
revoke all on function fb_order_private.room_name_sources(uuid,uuid) from public,anon,authenticated,service_role;

create function fb_order_private.room_name_rows(h uuid,outlet uuid) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('hotel_id',h,'outlet_id',outlet,'kind',s.kind,'id',s.id,
  'source_name',s.source_name,'context_name',s.context_name,'parent_id',s.parent_id,
  'fallback_en',case when s.kind='item' then e.fields->>'name' end,
  'fallback_es',case when s.kind='item' then es.fields->>'name' end,
  'saved_source_name',t.source_name,'name_en',t.name_en,'name_es',t.name_es,'revision',coalesce(t.revision,0))
  order by s.kind,s.context_name,s.source_name,s.id),'[]'::jsonb)
 from fb_order_private.room_name_sources(h,outlet) s left join fb_order_private.room_name_translations t
  on (t.hotel_id,t.outlet_id,t.kind,t.entity_id)=(h,outlet,s.kind,s.id)
 left join public.hotel_fb_items i on s.kind='item' and i.hotel_id=h and i.id=s.id
 left join public.hotel_fb_items_translations e on (e.hotel_id,e.entity_id,e.language,e.source_revision)=(h,i.id,'en',i.source_revision)
 left join public.hotel_fb_items_translations es on (es.hotel_id,es.entity_id,es.language,es.source_revision)=(h,i.id,'es',i.source_revision);
$$;
revoke all on function fb_order_private.room_name_rows(uuid,uuid) from public,anon,authenticated,service_role;

create function public.get_current_bugan_room_names() returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid; outlet uuid;
begin
 select c.hotel_id,c.outlet_id into h,outlet from fb_order_private.bugan_commercial_context() c;
 if not public.has_active_hotel_role(h,'editor') then raise exception using errcode='42501',message='room_translation_access_denied';end if;
 return fb_order_private.room_name_rows(h,outlet);
end $$;
revoke all on function public.get_current_bugan_room_names() from public,anon,authenticated,service_role;
grant execute on function public.get_current_bugan_room_names() to authenticated;

create function public.get_bugan_room_name_translations(p_hotel_id uuid,p_outlet_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform fb_order_private.service_only();
 if not public.is_hotel_module_enabled(p_hotel_id,'fb.menu') then return '[]';end if;
 return fb_order_private.room_name_rows(p_hotel_id,p_outlet_id);
end $$;
revoke all on function public.get_bugan_room_name_translations(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_bugan_room_name_translations(uuid,uuid) to service_role;

create function public.save_current_bugan_room_name_translation(
 p_kind text,p_id uuid,p_source_name text,p_revision integer,p_name_en text,p_name_es text
) returns integer language plpgsql security definer set search_path='' as $$
declare h uuid; outlet uuid; tbl text; current_name text; next_revision integer;
begin
 select c.hotel_id,c.outlet_id into h,outlet from fb_order_private.bugan_commercial_context() c;
 if not public.has_active_hotel_role(h,'editor') then raise exception using errcode='42501',message='room_translation_access_denied';end if;
 tbl:=case p_kind when 'item' then 'public.hotel_fb_items' when 'combo' then 'fb_order_private.combos'
  when 'combo_slot' then 'fb_order_private.combo_slots' when 'modifier_group' then 'fb_order_private.modifier_groups'
  when 'modifier_option' then 'fb_order_private.modifier_options' end;
 if tbl is null or p_id is null or p_revision is null or p_revision<0 or p_source_name is null
  or p_name_en is null or p_name_es is null or length(p_name_en)>160 or length(p_name_es)>160
  or p_name_en ~ '[[:cntrl:]]' or p_name_es ~ '[[:cntrl:]]' then
  raise exception using errcode='22023',message='room_translation_invalid';
 end if;
 if not exists(select 1 from fb_order_private.room_name_sources(h,outlet) s where s.kind=p_kind and s.id=p_id) then
  raise exception using errcode='42501',message='room_translation_scope_denied';
 end if;
 -- Do not race a Portuguese rename. The row lock never changes the source record.
 execute format('select name from %s where hotel_id=$1 and id=$2 for share',tbl) into current_name using h,p_id;
 if current_name is distinct from p_source_name then raise exception using errcode='PT409',message='room_translation_source_changed';end if;
 if p_revision=0 then
  insert into fb_order_private.room_name_translations(hotel_id,outlet_id,kind,entity_id,source_name,name_en,name_es,revision)
   values(h,outlet,p_kind,p_id,current_name,nullif(btrim(p_name_en),''),nullif(btrim(p_name_es),''),1)
   on conflict do nothing returning revision into next_revision;
 else
  update fb_order_private.room_name_translations t set source_name=current_name,name_en=nullif(btrim(p_name_en),''),
   name_es=nullif(btrim(p_name_es),''),revision=t.revision+1,updated_at=clock_timestamp()
   where (t.hotel_id,t.outlet_id,t.kind,t.entity_id,t.revision)=(h,outlet,p_kind,p_id,p_revision)
   returning t.revision into next_revision;
 end if;
 if next_revision is null then raise exception using errcode='PT409',message='room_translation_conflict';end if;
 perform public.record_admin_audit_event(auth.uid(),h,'fb.room_translation_saved',p_kind,p_id,
  jsonb_build_object('languages',jsonb_build_array('en','es'),'revision',next_revision),null);
 return next_revision;
end $$;
revoke all on function public.save_current_bugan_room_name_translation(text,uuid,text,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function public.save_current_bugan_room_name_translation(text,uuid,text,integer,text,text) to authenticated;

commit;
