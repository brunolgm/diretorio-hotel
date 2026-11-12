
begin;

-- Null preserves the hotel-wide behavior of existing order configuration.
alter table fb_order_private.combos add column room_outlet_id uuid;
alter table fb_order_private.combo_slots add column sort_order integer not null default 0;
alter table fb_order_private.modifier_groups add column room_outlet_id uuid;
alter table fb_order_private.combos add constraint combos_room_outlet_fk
 foreign key (hotel_id,room_outlet_id) references public.hotel_fb_outlets(hotel_id,id) on delete restrict;
alter table fb_order_private.modifier_groups add constraint modifier_groups_room_outlet_fk
 foreign key (hotel_id,room_outlet_id) references public.hotel_fb_outlets(hotel_id,id) on delete restrict;
create index combos_room_outlet_idx on fb_order_private.combos(hotel_id,room_outlet_id) where room_outlet_id is not null;
create index modifiers_room_outlet_idx on fb_order_private.modifier_groups(hotel_id,room_outlet_id) where room_outlet_id is not null;

create function fb_order_private.matches_room_commercial_scope(h uuid, requested uuid, configured uuid)
returns boolean language sql stable set search_path='' as $$
 select configured is null or (configured=requested and exists(
  select 1 from public.hotel_fb_outlets o join public.hotels hotel on hotel.id=o.hotel_id
  where o.hotel_id=h and o.id=configured and hotel.slug='bugan-recife'
    and o.type='room_service' and o.is_published and o.action_type<>'external_url'
 ));
$$;
revoke all on function fb_order_private.matches_room_commercial_scope(uuid,uuid,uuid) from public,anon,authenticated,service_role;

-- Preserve the installed pricing, offer and confirmation paths. Fail closed on an unexpected definition.
do $commercial_scope$
declare spec text[]; definition text;
begin
 foreach spec slice 1 in array array[
  array['fb_order_private.public_item(uuid,uuid,uuid,uuid,text,timestamp with time zone)',
   'g.hotel_id=h and g.item_id=item and g.active;',
   'g.hotel_id=h and g.item_id=item and g.active and fb_order_private.matches_room_commercial_scope(h,outlet,g.room_outlet_id);'],
  array['fb_order_private.item_price(uuid,uuid,uuid,uuid,jsonb,integer,text,timestamp with time zone)',
   'from fb_order_private.modifier_groups where hotel_id=h and item_id=item and active loop',
   'from fb_order_private.modifier_groups where hotel_id=h and item_id=item and active and fb_order_private.matches_room_commercial_scope(h,outlet,room_outlet_id) loop'],
  array['fb_order_private.item_price(uuid,uuid,uuid,uuid,jsonb,integer,text,timestamp with time zone)',
   'mg.item_id=item and o.currency=i.currency;',
   'mg.item_id=item and o.currency=i.currency and fb_order_private.matches_room_commercial_scope(h,outlet,mg.room_outlet_id);'],
  array['fb_order_private.price(uuid,uuid,jsonb,timestamp with time zone)',
   'cb.is_published and m.id=menu and m.is_published and om.outlet_id=outlet;',
   'cb.is_published and m.id=menu and m.is_published and om.outlet_id=outlet and fb_order_private.matches_room_commercial_scope(h,outlet,cb.room_outlet_id);'],
  array['fb_order_private.offer_before_commissioning(text,text)',
   'combo_id=combo.id order by id loop',
   'combo_id=combo.id order by sort_order,id loop'],
  array['fb_order_private.offer_before_commissioning(text,text)',
   'l.menu_id=m.id and t.is_published order by t.id loop',
   'l.menu_id=m.id and t.is_published and fb_order_private.matches_room_commercial_scope(h,o.id,t.room_outlet_id) order by t.id loop']
 ] loop
  definition:=pg_get_functiondef(spec[1]::regprocedure);
  if (length(definition)-length(replace(definition,spec[2],'')))/length(spec[2])<>1 then
   raise exception 'Unexpected commercial scope anchor in %', spec[1];
  end if;
  execute replace(definition,spec[2],spec[3]);
 end loop;
end $commercial_scope$;

-- Old single-row configuration can keep managing legacy rows. It cannot activate or edit scoped drafts.
create function fb_order_private.is_scoped_commercial_target(h uuid, kind text, target uuid, fields jsonb)
returns boolean language plpgsql stable set search_path='' as $$
begin
 case kind
 when 'combo' then return exists(select 1 from fb_order_private.combos c where c.hotel_id=h and c.id=target and c.room_outlet_id is not null);
 when 'combo_slot' then return exists(select 1 from fb_order_private.combos c
  where c.hotel_id=h and c.room_outlet_id is not null and
   (c.id=(fields->>'combo_id')::uuid or c.id=(select s.combo_id from fb_order_private.combo_slots s where s.hotel_id=h and s.id=target)));
 when 'combo_menu' then return exists(select 1 from fb_order_private.combos c
  where c.hotel_id=h and c.room_outlet_id is not null and
   (c.id=(fields->>'combo_id')::uuid or c.id=(select m.combo_id from fb_order_private.combo_menus m where m.hotel_id=h and m.id=target)));
 when 'combo_choice' then return exists(select 1 from fb_order_private.combo_slots s join fb_order_private.combos c on (c.hotel_id,c.id)=(s.hotel_id,s.combo_id)
  where s.hotel_id=h and c.room_outlet_id is not null and
   (s.id=(fields->>'slot_id')::uuid or s.id=(select a.slot_id from fb_order_private.combo_choices a where a.hotel_id=h and a.id=target)));
 when 'modifier_group' then return exists(select 1 from fb_order_private.modifier_groups g where g.hotel_id=h and g.id=target and g.room_outlet_id is not null);
 when 'modifier_option' then return exists(select 1 from fb_order_private.modifier_groups g
  where g.hotel_id=h and g.room_outlet_id is not null and
   (g.id=(fields->>'group_id')::uuid or g.id=(select a.group_id from fb_order_private.modifier_options a where a.hotel_id=h and a.id=target)));
 else return false;
 end case;
end $$;
revoke all on function fb_order_private.is_scoped_commercial_target(uuid,text,uuid,jsonb) from public,anon,authenticated,service_role;

do $guard_legacy$
declare definition text; anchor text:=' return fb_order_private.save_config_before_commissioning(p_kind,p_id,p_expected_revision,p_values);';
begin
 definition:=pg_get_functiondef('public.save_current_hotel_fb_order_config(text,uuid,integer,jsonb)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
  raise exception 'Unexpected legacy order configuration definition';
 end if;
 execute replace(definition,anchor,
  ' if fb_order_private.is_scoped_commercial_target(h,p_kind,p_id,p_values) then raise exception using errcode=''42501'',message=''commercial_scope_required'';end if;'||chr(10)||anchor);
end $guard_legacy$;

create function fb_order_private.bugan_commercial_context()
returns table(hotel_id uuid,outlet_id uuid) language plpgsql set search_path='' as $$
begin
 hotel_id:=fb_order_private.actor();
 perform fb_order_private.require_cap(hotel_id,'orders.configure');
 if not public.is_hotel_module_enabled(hotel_id,'fb.menu') then
  raise exception using errcode='42501',message='orders_module_required';
 end if;
 select o.id into outlet_id
 from public.hotel_fb_outlets o join public.hotels h on h.id=o.hotel_id
 where o.hotel_id=bugan_commercial_context.hotel_id and h.slug='bugan-recife'
   and o.type='room_service' and o.is_published and o.action_type<>'external_url'
 order by o.sort_order,o.id limit 1;
 if outlet_id is null then raise exception using errcode='42501',message='commercial_room_scope_unavailable';end if;
 return next;
end $$;
revoke all on function fb_order_private.bugan_commercial_context() from public,anon,authenticated,service_role;

create function public.get_current_bugan_room_commercial()
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
   'slots',coalesce((select jsonb_agg(jsonb_build_object('name',s.name,'choices',coalesce(
    (select jsonb_agg(a.item_id order by a.id) from fb_order_private.combo_choices a where a.hotel_id=h and a.slot_id=s.id),'[]')) order by s.sort_order,s.id)
    from fb_order_private.combo_slots s where s.hotel_id=h and s.combo_id=c.id),'[]')) order by c.name,c.id)
   from fb_order_private.combos c where c.hotel_id=h and c.room_outlet_id=outlet),'[]'),
  'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'item_id',g.item_id,
   'max_selected',g.max_selected,'active',g.active,'revision',g.revision,'options',coalesce(
   (select jsonb_agg(jsonb_build_object('name',a.name,'amount_minor',a.amount_minor) order by a.sort_order,a.id)
    from fb_order_private.modifier_options a where a.hotel_id=h and a.group_id=g.id),'[]')) order by g.name,g.id)
   from fb_order_private.modifier_groups g where g.hotel_id=h and g.room_outlet_id=outlet),'[]')
 );
end $$;

create function public.save_current_bugan_room_commercial_draft(p_kind text,p_id uuid,p_revision integer,p_draft jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; outlet uuid; menu uuid; item uuid; entity uuid; slot uuid;
 draft_row jsonb; component jsonb; choice jsonb; idx integer:=0; max_choices integer;
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
  delete from fb_order_private.combo_slots where hotel_id=h and combo_id=entity;
  delete from fb_order_private.combo_menus where hotel_id=h and combo_id=entity;
  perform fb_order_private.save_config_before_commissioning('combo_menu',null,0,jsonb_build_object('combo_id',entity,'menu_id',menu));
  for component in select value from jsonb_array_elements(p_draft->'slots') loop
   if jsonb_typeof(component) is distinct from 'object' or (component-array['name','choices'])<>'{}'
     or jsonb_typeof(component->'choices') is distinct from 'array'
     or jsonb_array_length(component->'choices') not between 1 and 8 then raise exception using errcode='22023',message='commercial_choices_invalid';end if;
   draft_row:=fb_order_private.save_config_before_commissioning('combo_slot',null,0,
     jsonb_build_object('combo_id',entity,'name',component->'name','min_selected',1,'max_selected',1,'multiplicity',1));
   slot:=(draft_row->>'id')::uuid;
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
  delete from fb_order_private.modifier_options where hotel_id=h and group_id=entity;
  for component in select value from jsonb_array_elements(p_draft->'options') loop
   if jsonb_typeof(component) is distinct from 'object' or (component-array['name','amount_minor'])<>'{}'
   then raise exception using errcode='22023',message='commercial_option_invalid';end if;
   idx:=idx+1;
   perform fb_order_private.save_config_before_commissioning('modifier_option',null,0,
     jsonb_build_object('group_id',entity,'name',component->'name','amount_minor',component->'amount_minor',
       'currency','BRL','active',true,'sort_order',idx));
  end loop;
 end if;
 return entity;
end $$;
revoke all on function public.get_current_bugan_room_commercial(),public.save_current_bugan_room_commercial_draft(text,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.get_current_bugan_room_commercial(),public.save_current_bugan_room_commercial_draft(text,uuid,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
