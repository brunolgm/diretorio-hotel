begin;

-- Existing saves were human-reviewed. Automatic saves can only update automatic rows.
alter table fb_order_private.room_name_translations add column origin text not null default 'reviewed'
 check(origin in('reviewed','automatic'));

-- Child IDs now survive draft edits/reordering, preserving the reviewed translation links.
-- The existing parent CAS, draft-only guard, outlet boundary and pricing validation remain.
create or replace function public.get_current_bugan_room_commercial()
returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid; outlet uuid;
begin
 select ctx.hotel_id,ctx.outlet_id into h,outlet from fb_order_private.bugan_commercial_context() ctx;
 return jsonb_build_object(
  'menus',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name) order by m.sort_order,m.id)
   from public.hotel_fb_outlet_menus l join public.hotel_fb_menus m on (m.hotel_id,m.id)=(l.hotel_id,l.menu_id)
   where l.hotel_id=h and l.outlet_id=outlet and m.is_published),'[]'),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'menu_id',m.id,'amount_minor',i.price_amount_minor) order by i.name,i.id)
   from public.hotel_fb_outlet_menus l join public.hotel_fb_menus m on (m.hotel_id,m.id)=(l.hotel_id,l.menu_id)
   join public.hotel_fb_categories ca on (ca.hotel_id,ca.menu_id)=(m.hotel_id,m.id)
   join public.hotel_fb_items i on (i.hotel_id,i.category_id)=(ca.hotel_id,ca.id)
   where l.hotel_id=h and l.outlet_id=outlet and m.is_published and ca.is_published and i.is_published
     and i.currency='BRL' and i.price_amount_minor is not null and not i.price_on_request),'[]'),
  'combos',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'amount_minor',c.amount_minor,
   'active',c.is_published,'revision',c.revision,'menu_id',(select m.menu_id from fb_order_private.combo_menus m where m.hotel_id=h and m.combo_id=c.id order by m.id limit 1),
   'slots',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'choices',coalesce(
    (select jsonb_agg(a.item_id order by a.id) from fb_order_private.combo_choices a where a.hotel_id=h and a.slot_id=s.id),'[]')) order by s.sort_order,s.id)
    from fb_order_private.combo_slots s where s.hotel_id=h and s.combo_id=c.id),'[]')) order by c.name,c.id)
   from fb_order_private.combos c where c.hotel_id=h and c.room_outlet_id=outlet),'[]'),
  'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'item_id',g.item_id,
   'max_selected',g.max_selected,'active',g.active,'revision',g.revision,'options',coalesce(
   (select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'amount_minor',a.amount_minor) order by a.sort_order,a.id)
    from fb_order_private.modifier_options a where a.hotel_id=h and a.group_id=g.id),'[]')) order by g.name,g.id)
   from fb_order_private.modifier_groups g where g.hotel_id=h and g.room_outlet_id=outlet),'[]')
 );
end $$;

create or replace function public.save_current_bugan_room_commercial_draft(p_kind text,p_id uuid,p_revision integer,p_draft jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; outlet uuid; menu uuid; item uuid; entity uuid; slot uuid;
 draft_row jsonb; component jsonb; choice jsonb; idx integer:=0; max_choices integer;
 child uuid; child_revision integer; kept uuid[]:='{}'; original_ids uuid[];
begin
 select ctx.hotel_id,ctx.outlet_id into h,outlet from fb_order_private.bugan_commercial_context() ctx;
 if p_kind is null or p_kind not in ('combo','group') or jsonb_typeof(p_draft) is distinct from 'object'
  or octet_length(p_draft::text)>12000 or p_revision is null or p_revision<0 then
  raise exception using errcode='22023',message='commercial_draft_invalid';
 end if;
 if p_kind='combo' then
  if (p_draft-array['name','amount_minor','menu_id','slots'])<>'{}' or jsonb_typeof(p_draft->'slots') is distinct from 'array'
   or jsonb_array_length(p_draft->'slots') not between 2 and 8 then raise exception using errcode='22023',message='commercial_slots_invalid';end if;
  menu:=(p_draft->>'menu_id')::uuid;
  if not exists(select 1 from public.hotel_fb_outlet_menus l join public.hotel_fb_menus m on (m.hotel_id,m.id)=(l.hotel_id,l.menu_id)
   where l.hotel_id=h and l.outlet_id=outlet and m.id=menu and m.is_published) then
   raise exception using errcode='22023',message='commercial_menu_invalid';
  end if;
  if p_id is not null and not exists(select 1 from fb_order_private.combos c where c.hotel_id=h and c.room_outlet_id=outlet and c.id=p_id and not c.is_published) then
   raise exception using errcode='42501',message='commercial_draft_only';
  end if;
  draft_row:=fb_order_private.save_config_before_commissioning('combo',p_id,p_revision,
    jsonb_build_object('name',p_draft->'name','amount_minor',p_draft->'amount_minor','currency','BRL','is_published',false));
  entity:=(draft_row->>'id')::uuid;
  update fb_order_private.combos set room_outlet_id=outlet where hotel_id=h and id=entity;
  select array_agg(id order by sort_order,id) into original_ids from fb_order_private.combo_slots where hotel_id=h and combo_id=entity;
  delete from fb_order_private.combo_menus where hotel_id=h and combo_id=entity;
  perform fb_order_private.save_config_before_commissioning('combo_menu',null,0,jsonb_build_object('combo_id',entity,'menu_id',menu));
  for component in select value from jsonb_array_elements(p_draft->'slots') loop
   if jsonb_typeof(component) is distinct from 'object' or (component-array['id','name','choices'])<>'{}'
     or jsonb_typeof(component->'choices') is distinct from 'array'
     or jsonb_array_length(component->'choices') not between 1 and 8 then raise exception using errcode='22023',message='commercial_choices_invalid';end if;
   child:=case when component ? 'id' then (component->>'id')::uuid else original_ids[idx+1] end;
   child_revision:=0;
   if child is not null then
    select s.revision into child_revision from fb_order_private.combo_slots s where s.hotel_id=h and s.combo_id=entity and s.id=child;
    if child_revision is null or child=any(kept) then raise exception using errcode='22023',message='commercial_child_invalid';end if;
   end if;
   draft_row:=fb_order_private.save_config_before_commissioning('combo_slot',child,child_revision,
     jsonb_build_object('combo_id',entity,'name',component->'name','min_selected',1,'max_selected',1,'multiplicity',1));
   slot:=(draft_row->>'id')::uuid;
   kept:=array_append(kept,slot);
   delete from fb_order_private.combo_choices where hotel_id=h and slot_id=slot;
   update fb_order_private.combo_slots set sort_order=idx where hotel_id=h and id=slot;
   idx:=idx+1;
   for choice in select value from jsonb_array_elements(component->'choices') loop
    item:=(choice#>>'{}')::uuid;
    if not exists(select 1 from public.hotel_fb_items i join public.hotel_fb_categories ca on (ca.hotel_id,ca.id)=(i.hotel_id,i.category_id)
     where i.hotel_id=h and i.id=item and ca.menu_id=menu and ca.is_published and i.is_published
       and i.currency='BRL' and i.price_amount_minor is not null and not i.price_on_request) then
     raise exception using errcode='22023',message='commercial_choice_item_invalid';
    end if;
    perform fb_order_private.save_config_before_commissioning('combo_choice',null,0,
      jsonb_build_object('slot_id',slot,'item_id',item,'extra_minor',0,'active',true));
   end loop;
  end loop;
  delete from fb_order_private.combo_slots where hotel_id=h and combo_id=entity and not(id=any(kept));
 else
  if (p_draft-array['name','item_id','max_selected','options'])<>'{}'
   or jsonb_typeof(p_draft->'options') is distinct from 'array'
   or jsonb_array_length(p_draft->'options') not between 1 and 12
   or jsonb_typeof(p_draft->'max_selected') is distinct from 'number'
   or (p_draft->>'max_selected')!~'^[1-9][0-9]?$' then raise exception using errcode='22023',message='commercial_options_invalid';end if;
  item:=(p_draft->>'item_id')::uuid;
  max_choices:=(p_draft->>'max_selected')::int;
  if max_choices>jsonb_array_length(p_draft->'options') or not exists(
   select 1 from public.hotel_fb_items i join public.hotel_fb_categories ca on (ca.hotel_id,ca.id)=(i.hotel_id,i.category_id)
   join public.hotel_fb_menus m on (m.hotel_id,m.id)=(ca.hotel_id,ca.menu_id)
   join public.hotel_fb_outlet_menus l on (l.hotel_id,l.menu_id)=(m.hotel_id,m.id)
   where i.hotel_id=h and i.id=item and l.outlet_id=outlet and i.is_published and ca.is_published and m.is_published
    and i.currency='BRL' and i.price_amount_minor is not null and not i.price_on_request) then
   raise exception using errcode='22023',message='commercial_modifier_item_invalid';
  end if;
  if p_id is not null and not exists(select 1 from fb_order_private.modifier_groups g where g.hotel_id=h and g.room_outlet_id=outlet and g.id=p_id and not g.active) then
   raise exception using errcode='42501',message='commercial_draft_only';
  end if;
  draft_row:=fb_order_private.save_config_before_commissioning('modifier_group',p_id,p_revision,
    jsonb_build_object('name',p_draft->'name','item_id',item,'selection',case when max_choices=1 then 'single' else 'multi' end,
      'min_selected',0,'max_selected',max_choices,'active',false));
  entity:=(draft_row->>'id')::uuid;
  update fb_order_private.modifier_groups set room_outlet_id=outlet where hotel_id=h and id=entity;
  select array_agg(id order by sort_order,id) into original_ids from fb_order_private.modifier_options where hotel_id=h and group_id=entity;
  for component in select value from jsonb_array_elements(p_draft->'options') loop
   if jsonb_typeof(component) is distinct from 'object' or (component-array['id','name','amount_minor'])<>'{}'
   then raise exception using errcode='22023',message='commercial_option_invalid';end if;
   idx:=idx+1;
   child:=case when component ? 'id' then (component->>'id')::uuid else original_ids[idx] end;
   child_revision:=0;
   if child is not null then
    select a.revision into child_revision from fb_order_private.modifier_options a where a.hotel_id=h and a.group_id=entity and a.id=child;
    if child_revision is null or child=any(kept) then raise exception using errcode='22023',message='commercial_child_invalid';end if;
   end if;
   draft_row:=fb_order_private.save_config_before_commissioning('modifier_option',child,child_revision,
     jsonb_build_object('group_id',entity,'name',component->'name','amount_minor',component->'amount_minor',
       'currency','BRL','active',true,'sort_order',idx));
   kept:=array_append(kept,(draft_row->>'id')::uuid);
  end loop;
  delete from fb_order_private.modifier_options where hotel_id=h and group_id=entity and not(id=any(kept));
 end if;
 return entity;
end $$;

create or replace function fb_order_private.room_name_rows(h uuid,outlet uuid) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('hotel_id',h,'outlet_id',outlet,'kind',s.kind,'id',s.id,
  'source_name',s.source_name,'context_name',s.context_name,'parent_id',s.parent_id,
  'fallback_en',case when s.kind='item' then e.fields->>'name' end,
  'fallback_es',case when s.kind='item' then es.fields->>'name' end,
  'origin',t.origin,'saved_source_name',t.source_name,'name_en',t.name_en,'name_es',t.name_es,'revision',coalesce(t.revision,0))
  order by s.kind,s.context_name,s.source_name,s.id),'[]'::jsonb)
 from fb_order_private.room_name_sources(h,outlet) s left join fb_order_private.room_name_translations t
  on (t.hotel_id,t.outlet_id,t.kind,t.entity_id)=(h,outlet,s.kind,s.id)
 left join public.hotel_fb_items i on s.kind='item' and i.hotel_id=h and i.id=s.id
 left join public.hotel_fb_items_translations e on (e.hotel_id,e.entity_id,e.language,e.source_revision)=(h,i.id,'en',i.source_revision)
 left join public.hotel_fb_items_translations es on (es.hotel_id,es.entity_id,es.language,es.source_revision)=(h,i.id,'es',i.source_revision);
$$;

create or replace function public.save_current_bugan_room_name_translation(
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
   name_es=nullif(btrim(p_name_es),''),origin='reviewed',revision=t.revision+1,updated_at=clock_timestamp()
   where (t.hotel_id,t.outlet_id,t.kind,t.entity_id,t.revision)=(h,outlet,p_kind,p_id,p_revision)
   returning t.revision into next_revision;
 end if;
 if next_revision is null then raise exception using errcode='PT409',message='room_translation_conflict';end if;
 perform public.record_admin_audit_event(auth.uid(),h,'fb.room_translation_saved',p_kind,p_id,
  jsonb_build_object('languages',jsonb_build_array('en','es'),'revision',next_revision),null);
 return next_revision;
end $$;

create function public.get_current_bugan_room_commercial_translation_targets(p_kind text,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid; outlet uuid; root_kind text; child_kind text; result jsonb;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='room_translation_access_denied';end if;
 select c.hotel_id,c.outlet_id into h,outlet from fb_order_private.bugan_commercial_context() c;
 if not public.has_active_hotel_role(h,'editor') then raise exception using errcode='42501',message='room_translation_access_denied';end if;
 root_kind:=case p_kind when 'combo' then 'combo' when 'group' then 'modifier_group' end;
 child_kind:=case p_kind when 'combo' then 'combo_slot' when 'group' then 'modifier_option' end;
 if root_kind is null or not exists(select 1 from fb_order_private.room_name_sources(h,outlet) s where s.kind=root_kind and s.id=p_id) then
  raise exception using errcode='42501',message='room_translation_scope_denied';
 end if;
 select coalesce(jsonb_agg(r),'[]') into result from jsonb_array_elements(fb_order_private.room_name_rows(h,outlet)) r
 where (r->>'kind'=root_kind and (r->>'id')::uuid=p_id) or (r->>'kind'=child_kind and (r->>'parent_id')::uuid=p_id);
 return result;
end $$;

-- Names-only API. No commercial/configuration fields or arbitrary hotel/outlet arguments.
create function public.save_current_bugan_room_automatic_translation(
 p_kind text,p_id uuid,p_source_name text,p_revision integer,p_name_en text,p_name_es text
) returns boolean language plpgsql security definer set search_path='' as $$
declare h uuid; outlet uuid; tbl text; current_name text; next_revision integer;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='room_translation_access_denied';end if;
 select c.hotel_id,c.outlet_id into h,outlet from fb_order_private.bugan_commercial_context() c;
 if not public.has_active_hotel_role(h,'editor') then raise exception using errcode='42501',message='room_translation_access_denied';end if;
 if not public.is_hotel_module_enabled(h,'content.languages') then return false;end if;
 tbl:=case p_kind when 'combo' then 'fb_order_private.combos' when 'combo_slot' then 'fb_order_private.combo_slots'
  when 'modifier_group' then 'fb_order_private.modifier_groups' when 'modifier_option' then 'fb_order_private.modifier_options' end;
 if tbl is null or p_id is null or p_revision is null or p_revision<0 or p_source_name is null
  or length(p_source_name) not between 1 and 160
  or (p_name_en is not null and (length(btrim(p_name_en)) not between 1 and 160 or p_name_en ~ '[[:cntrl:]]'))
  or (p_name_es is not null and (length(btrim(p_name_es)) not between 1 and 160 or p_name_es ~ '[[:cntrl:]]')) then
  raise exception using errcode='22023',message='room_translation_invalid';
 end if;
 if not exists(select 1 from fb_order_private.room_name_sources(h,outlet) s where s.kind=p_kind and s.id=p_id) then
  raise exception using errcode='42501',message='room_translation_scope_denied';
 end if;
 execute format('select name from %s where hotel_id=$1 and id=$2 for share',tbl) into current_name using h,p_id;
 if current_name is distinct from p_source_name or (p_name_en is null and p_name_es is null) then return false;end if;
 if p_revision=0 then
  insert into fb_order_private.room_name_translations(hotel_id,outlet_id,kind,entity_id,source_name,name_en,name_es,revision,origin)
   values(h,outlet,p_kind,p_id,current_name,btrim(p_name_en),btrim(p_name_es),1,'automatic')
   on conflict do nothing returning revision into next_revision;
 else
  update fb_order_private.room_name_translations t set source_name=current_name,
   name_en=coalesce(btrim(p_name_en),case when t.source_name=current_name then t.name_en end),
   name_es=coalesce(btrim(p_name_es),case when t.source_name=current_name then t.name_es end),
   revision=t.revision+1,updated_at=clock_timestamp()
   where (t.hotel_id,t.outlet_id,t.kind,t.entity_id,t.revision)=(h,outlet,p_kind,p_id,p_revision) and t.origin='automatic'
   returning t.revision into next_revision;
 end if;
 if next_revision is null then return false;end if;
 perform public.record_admin_audit_event(auth.uid(),h,'fb.room_translation_generated',p_kind,p_id,
  jsonb_build_object('origin','automatic','revision',next_revision),null);
 return true;
end $$;
revoke all on function public.get_current_bugan_room_commercial_translation_targets(text,uuid),
 public.save_current_bugan_room_automatic_translation(text,uuid,text,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function public.get_current_bugan_room_commercial_translation_targets(text,uuid),
 public.save_current_bugan_room_automatic_translation(text,uuid,text,integer,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
