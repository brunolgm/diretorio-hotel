begin;

-- Keep the legacy name-only RPCs intact for already deployed clients and rollback.
alter table fb_order_private.room_name_translations
 drop constraint room_name_translations_kind_check,
 drop constraint room_name_translations_source_name_check,
 drop constraint room_name_translations_name_en_check,
 drop constraint room_name_translations_name_es_check,
 add constraint room_name_translations_kind_check check(kind in('item','combo','combo_slot','modifier_group','modifier_option','item_description','category')),
 add constraint room_name_translations_source_name_check check(length(source_name) between 1 and case when kind='item_description' then 10000 else 160 end),
 add constraint room_name_translations_name_en_check check(name_en is null or length(name_en) between 1 and case when kind='item_description' then 10000 else 160 end),
 add constraint room_name_translations_name_es_check check(name_es is null or length(name_es) between 1 and case when kind='item_description' then 10000 else 160 end);

create function fb_order_private.room_editorial_sources(h uuid,outlet uuid)
returns table(kind text,id uuid,source_name text,context_name text,parent_id uuid)
language sql stable set search_path='' as $$
 with scope as (
  select o.id from public.hotel_fb_outlets o join public.hotels hotel on hotel.id=o.hotel_id
  where o.hotel_id=h and o.id=outlet and o.type='room_service' and o.is_published
   and o.action_type<>'external_url' and hotel.slug='bugan-recife' and hotel.platform_status='active'
 ), categories as materialized (
  select distinct c.id,c.name,m.name as menu_name,c.menu_id
  from public.hotel_fb_categories c join public.hotel_fb_menus m on (m.hotel_id,m.id)=(c.hotel_id,c.menu_id)
  join public.hotel_fb_outlet_menus l on (l.hotel_id,l.menu_id)=(c.hotel_id,c.menu_id)
  where c.hotel_id=h and l.outlet_id=outlet and exists(select 1 from scope)
 )
 select 'category',c.id,c.name,c.menu_name,c.menu_id from categories c
 union all
 select 'item_description',i.id,coalesce(i.short_description,i.full_description),i.name,i.id
 from public.hotel_fb_items i join categories c on c.id=i.category_id
 where i.hotel_id=h and length(coalesce(i.short_description,i.full_description))>0;
$$;
revoke all on function fb_order_private.room_editorial_sources(uuid,uuid) from public,anon,authenticated,service_role;

create function fb_order_private.room_text_rows(h uuid,outlet uuid) returns jsonb
language sql stable set search_path='' as $$
 select fb_order_private.room_name_rows(h,outlet)||coalesce(jsonb_agg(jsonb_build_object(
  'hotel_id',h,'outlet_id',outlet,'kind',s.kind,'id',s.id,'source_name',s.source_name,
  'context_name',s.context_name,'parent_id',s.parent_id,
  'fallback_en',case when s.kind='category' then ce.fields->>'name' else coalesce(e.fields->>'short_description',e.fields->>'full_description') end,
  'fallback_es',case when s.kind='category' then ces.fields->>'name' else coalesce(es.fields->>'short_description',es.fields->>'full_description') end,
  'saved_source_name',t.source_name,'name_en',t.name_en,'name_es',t.name_es,'revision',coalesce(t.revision,0))
  order by s.kind,s.context_name,s.source_name,s.id),'[]'::jsonb)
 from fb_order_private.room_editorial_sources(h,outlet) s
 left join fb_order_private.room_name_translations t on (t.hotel_id,t.outlet_id,t.kind,t.entity_id)=(h,outlet,s.kind,s.id)
 left join public.hotel_fb_items i on s.kind='item_description' and i.hotel_id=h and i.id=s.id
 left join public.hotel_fb_items_translations e on (e.hotel_id,e.entity_id,e.language,e.source_revision)=(h,i.id,'en',i.source_revision)
 left join public.hotel_fb_items_translations es on (es.hotel_id,es.entity_id,es.language,es.source_revision)=(h,i.id,'es',i.source_revision)
 left join public.hotel_fb_categories c on s.kind='category' and c.hotel_id=h and c.id=s.id
 left join public.hotel_fb_categories_translations ce on (ce.hotel_id,ce.entity_id,ce.language,ce.source_revision)=(h,c.id,'en',c.source_revision)
 left join public.hotel_fb_categories_translations ces on (ces.hotel_id,ces.entity_id,ces.language,ces.source_revision)=(h,c.id,'es',c.source_revision);
$$;
revoke all on function fb_order_private.room_text_rows(uuid,uuid) from public,anon,authenticated,service_role;

create function public.get_current_bugan_room_texts() returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid; outlet uuid;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='room_translation_access_denied';end if;
 select c.hotel_id,c.outlet_id into h,outlet from fb_order_private.bugan_commercial_context() c;
 if not public.has_active_hotel_role(h,'editor') then raise exception using errcode='42501',message='room_translation_access_denied';end if;
 return fb_order_private.room_text_rows(h,outlet);
end $$;
revoke all on function public.get_current_bugan_room_texts() from public,anon,authenticated,service_role;
grant execute on function public.get_current_bugan_room_texts() to authenticated;

create function public.get_bugan_room_text_translations(p_hotel_id uuid,p_outlet_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform fb_order_private.service_only();
 if not public.is_hotel_module_enabled(p_hotel_id,'fb.menu') then return '[]';end if;
 return fb_order_private.room_text_rows(p_hotel_id,p_outlet_id);
end $$;
revoke all on function public.get_bugan_room_text_translations(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_bugan_room_text_translations(uuid,uuid) to service_role;

create function public.save_current_bugan_room_text_translation(
 p_kind text,p_id uuid,p_source_name text,p_revision integer,p_name_en text,p_name_es text
) returns integer language plpgsql security definer set search_path='' as $$
declare h uuid; outlet uuid; current_source text; next_revision integer; max_length integer;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='room_translation_access_denied';end if;
 if p_kind in('item','combo','combo_slot','modifier_group','modifier_option') then
  return public.save_current_bugan_room_name_translation(p_kind,p_id,p_source_name,p_revision,p_name_en,p_name_es);
 end if;
 select c.hotel_id,c.outlet_id into h,outlet from fb_order_private.bugan_commercial_context() c;
 if not public.has_active_hotel_role(h,'editor') then raise exception using errcode='42501',message='room_translation_access_denied';end if;
 max_length:=case when p_kind='item_description' then 10000 else 160 end;
 if p_kind is null or p_kind not in('item_description','category') or p_id is null or p_revision is null or p_revision<0
  or p_source_name is null or length(p_source_name) not between 1 and max_length or p_name_en is null or p_name_es is null
  or length(p_name_en)>max_length or length(p_name_es)>max_length
  or (case when p_kind='item_description' then regexp_replace(p_name_en,E'[\n\r\t]','','g') else p_name_en end) ~ '[[:cntrl:]]'
  or (case when p_kind='item_description' then regexp_replace(p_name_es,E'[\n\r\t]','','g') else p_name_es end) ~ '[[:cntrl:]]' then
  raise exception using errcode='22023',message='room_translation_invalid';
 end if;
 if not exists(select 1 from fb_order_private.room_editorial_sources(h,outlet) s where s.kind=p_kind and s.id=p_id) then
  raise exception using errcode='42501',message='room_translation_scope_denied';
 end if;
 if p_kind='category' then
  select name into current_source from public.hotel_fb_categories where hotel_id=h and id=p_id for share;
 else
  select coalesce(short_description,full_description) into current_source from public.hotel_fb_items where hotel_id=h and id=p_id for share;
 end if;
 if current_source is distinct from p_source_name then raise exception using errcode='PT409',message='room_translation_source_changed';end if;
 if p_revision=0 then
  insert into fb_order_private.room_name_translations(hotel_id,outlet_id,kind,entity_id,source_name,name_en,name_es,revision)
   values(h,outlet,p_kind,p_id,current_source,nullif(btrim(p_name_en,E' \t\n\r'),''),nullif(btrim(p_name_es,E' \t\n\r'),''),1)
   on conflict do nothing returning revision into next_revision;
 else
  update fb_order_private.room_name_translations t set source_name=current_source,
   name_en=nullif(btrim(p_name_en,E' \t\n\r'),''),name_es=nullif(btrim(p_name_es,E' \t\n\r'),''),
   revision=t.revision+1,updated_at=clock_timestamp()
   where (t.hotel_id,t.outlet_id,t.kind,t.entity_id,t.revision)=(h,outlet,p_kind,p_id,p_revision)
   returning revision into next_revision;
 end if;
 if next_revision is null then raise exception using errcode='PT409',message='room_translation_conflict';end if;
 perform public.record_admin_audit_event(auth.uid(),h,'fb.room_translation_saved',p_kind,p_id,
  jsonb_build_object('languages',jsonb_build_array('en','es'),'revision',next_revision),null);
 return next_revision;
end $$;
revoke all on function public.save_current_bugan_room_text_translation(text,uuid,text,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function public.save_current_bugan_room_text_translation(text,uuid,text,integer,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
