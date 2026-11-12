-- Additive, opt-in KDS. No changes to order/printing triggers or tenant provisioning.
begin;
create schema fb_kds_private;
revoke all on schema fb_kds_private from public,anon,authenticated,service_role;
create table fb_kds_private.screens (
 id uuid primary key default gen_random_uuid(), hotel_id uuid not null references public.hotels(id),
 name text not null check(length(btrim(name)) between 1 and 100), location text not null default '' check(length(location)<=160),
 mode text not null check(mode in('monitor','operational','dispatch')),active boolean not null default true,
 revision integer not null default 1, settings jsonb not null,created_by uuid not null references public.profiles(id),
 pair_digest text unique,pair_expires_at timestamptz,session_digest text unique,session_expires_at timestamptz,
 device_name text check(length(device_name)<=100),last_seen_at timestamptz,unique(hotel_id,id)
);
create table fb_kds_private.screen_sectors (
 hotel_id uuid not null,screen_id uuid not null,sector_id uuid not null,
 primary key(screen_id,sector_id),foreign key(hotel_id,screen_id) references fb_kds_private.screens(hotel_id,id) on delete cascade,
 foreign key(hotel_id,sector_id) references fb_order_private.sectors(hotel_id,id)
);
alter table fb_kds_private.screens enable row level security;
alter table fb_kds_private.screen_sectors enable row level security;
revoke all on all tables in schema fb_kds_private from public,anon,authenticated,service_role;

create function fb_kds_private.actor() returns uuid language plpgsql set search_path='' as $$
declare h uuid:=fb_order_private.actor();begin
 if not public.is_hotel_module_enabled(h,'core.directory') or not public.is_hotel_module_enabled(h,'fb.menu') then
  raise exception using errcode='42501',message='kds_module_required';
 end if;
 return h;
end $$;

create function fb_kds_private.settings_valid(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(v)<>'object' or (select count(*) from jsonb_object_keys(v))<>12 or
 exists(select 1 from jsonb_object_keys(v) k where k not in('layout','theme','contrast','font_size','ticket_limit','sort','states','show_code','show_items','attention_minutes','critical_minutes','sound')) then return false;end if;
 -- Explicit presence checks avoid SQL NULL accepting malformed settings.
 return coalesce(v->>'layout' in('kanban','compact','tickets') and v->>'theme' in('dark','light') and v->>'sort' in('oldest','newest')
 and jsonb_typeof(v->'font_size')='number' and jsonb_typeof(v->'ticket_limit')='number'
 and (v->>'font_size')::int between 16 and 36 and (v->>'ticket_limit')::int between 1 and 100
 and jsonb_typeof(v->'contrast')='boolean' and jsonb_typeof(v->'show_code')='boolean' and jsonb_typeof(v->'show_items')='boolean' and jsonb_typeof(v->'sound')='boolean'
 and jsonb_typeof(v->'states')='array' and jsonb_array_length(v->'states') between 1 and 6
 and jsonb_array_length(v->'states')=(select count(distinct x) from jsonb_array_elements_text(v->'states') x)
 and not exists(select 1 from jsonb_array_elements_text(v->'states') x where x not in('registered','accepted','preparing','ready','out_for_delivery','delivered'))
 and (v->'attention_minutes'='null'::jsonb or jsonb_typeof(v->'attention_minutes')='number' and (v->>'attention_minutes')::int between 1 and 1440)
 and (v->'critical_minutes'='null'::jsonb or jsonb_typeof(v->'critical_minutes')='number' and (v->>'critical_minutes')::int between 1 and 1440)
 and (v->'attention_minutes'='null'::jsonb or v->'critical_minutes'='null'::jsonb or (v->>'critical_minutes')::int>(v->>'attention_minutes')::int),false);
exception when others then return false;
end $$;
alter table fb_kds_private.screens add constraint kds_settings_valid check(fb_kds_private.settings_valid(settings));

create function fb_kds_private.screen_json(s fb_kds_private.screens) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',s.id,'hotel_id',s.hotel_id,'name',s.name,'location',s.location,'mode',s.mode,'active',s.active,'revision',s.revision,
 'settings',s.settings,'device_name',s.device_name,'last_seen_at',s.last_seen_at,'paired',s.session_digest is not null and s.session_expires_at>clock_timestamp(),
 'sector_ids',coalesce((select jsonb_agg(sector_id order by sector_id) from fb_kds_private.screen_sectors where screen_id=s.id),'[]'));
$$;
create function public.get_current_hotel_fb_kds_admin() returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_kds_private.actor();begin
 perform fb_order_private.require_cap(h,'orders.configure');
 return jsonb_build_object('hotel_id',h,'hotel_name',(select name from public.hotels where id=h),
 'screens',coalesce((select jsonb_agg(fb_kds_private.screen_json(s) order by name,id) from fb_kds_private.screens s where hotel_id=h),'[]'),
 'sectors',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by sort_order,name) from fb_order_private.sectors where hotel_id=h and active and fb_order_private.can(h,'orders.read',id)),'[]'));
end $$;
create function public.save_current_hotel_fb_kds_screen(p_id uuid,p_revision integer,p_name text,p_location text,p_mode text,p_active boolean,p_sector_ids uuid[],p_settings jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_kds_private.actor();s fb_kds_private.screens;entity uuid;begin
 perform fb_order_private.require_cap(h,'orders.configure');
 if p_revision is null or p_name is null or p_location is null or p_mode is null or p_active is null or p_sector_ids is null or p_settings is null
 or cardinality(p_sector_ids) not between 1 and 32 or not fb_kds_private.settings_valid(p_settings)
 or exists(select 1 from unnest(p_sector_ids) x where x is null or not exists(select 1 from fb_order_private.sectors where hotel_id=h and id=x and active) or not fb_order_private.can(h,'orders.read',x))
 then raise exception using errcode='22023',message='kds_invalid';end if;
 if p_id is null then
  if p_revision<>0 or (select count(*) from fb_kds_private.screens where hotel_id=h)>=100 then raise exception using errcode='22023',message='kds_invalid';end if;
  insert into fb_kds_private.screens(hotel_id,name,location,mode,active,settings,created_by) values(h,btrim(p_name),btrim(p_location),p_mode,p_active,p_settings,auth.uid()) returning id into entity;
 else
  select * into s from fb_kds_private.screens where hotel_id=h and id=p_id for update;
  if s.id is null then raise exception using errcode='42501',message='kds_denied';end if;
  if s.revision<>p_revision then raise exception using errcode='PT409',message='kds_revision';end if;
  entity:=s.id;
  update fb_kds_private.screens set name=btrim(p_name),location=btrim(p_location),mode=p_mode,active=p_active,settings=p_settings,revision=revision+1,
   pair_digest=null,pair_expires_at=null,session_digest=null,session_expires_at=null,device_name=null,created_by=auth.uid() where id=entity;
  delete from fb_kds_private.screen_sectors where screen_id=entity;
 end if;
 insert into fb_kds_private.screen_sectors select distinct h,entity,x from unnest(p_sector_ids) x;
 perform fb_order_private.audit(h,'fb.kds.screen_saved',entity);
 select * into s from fb_kds_private.screens where id=entity;
 return fb_kds_private.screen_json(s);
end $$;
create function public.rotate_current_hotel_fb_kds_access(p_id uuid,p_revision integer,p_pair_digest text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_kds_private.actor();s fb_kds_private.screens;begin
 perform fb_order_private.require_cap(h,'orders.configure');
 select * into s from fb_kds_private.screens where hotel_id=h and id=p_id for update;
 if s.id is null then raise exception using errcode='42501',message='kds_denied';end if;
 if p_revision is null or s.revision<>p_revision then raise exception using errcode='PT409',message='kds_revision';end if;
 if p_pair_digest is not null and (not s.active or p_pair_digest!~'^[0-9a-f]{64}$') then raise exception using errcode='22023',message='kds_invalid';end if;
 update fb_kds_private.screens set pair_digest=p_pair_digest,pair_expires_at=case when p_pair_digest is not null then clock_timestamp()+interval '10 minutes' end,
 session_digest=null,session_expires_at=null,device_name=null,revision=revision+1,created_by=auth.uid() where id=s.id;
 perform fb_order_private.audit(h,case when p_pair_digest is null then 'fb.kds.access_revoked' else 'fb.kds.pairing_issued' end,s.id);
 return jsonb_build_object('expires_at',(select pair_expires_at from fb_kds_private.screens where id=s.id));
end $$;
create function public.redeem_fb_kds_pairing(p_code text,p_session_digest text,p_device_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s fb_kds_private.screens;begin
 perform fb_order_private.service_only();
 if p_code is null or p_code!~'^[A-Za-z0-9_-]{24}$' or p_session_digest is null or p_session_digest!~'^[0-9a-f]{64}$' or p_device_name is null or length(p_device_name) not between 1 and 100
 then raise exception using errcode='42501',message='kds_denied';end if;
 select * into s from fb_kds_private.screens where pair_digest=fb_order_private.hash(p_code) and pair_expires_at>clock_timestamp() and active for update;
 if s.id is null then raise exception using errcode='42501',message='kds_denied';end if;
 update fb_kds_private.screens set pair_digest=null,pair_expires_at=null,session_digest=p_session_digest,session_expires_at=clock_timestamp()+interval '30 days',device_name=p_device_name,revision=revision+1 where id=s.id;
 perform public.record_admin_audit_event(s.created_by,s.hotel_id,'fb.kds.paired','fb_orders',s.id,'{}',null);
 return jsonb_build_object('screen_id',s.id);
end $$;

create function fb_kds_private.session(p_secret text) returns fb_kds_private.screens language plpgsql set search_path='' as $$
declare s fb_kds_private.screens;begin
 if p_secret is null or p_secret!~'^[A-Za-z0-9_-]{43}$' then raise exception using errcode='42501',message='kds_denied';end if;
 select * into s from fb_kds_private.screens where session_digest=fb_order_private.hash(p_secret) and session_expires_at>clock_timestamp() and active for update;
 if s.id is null or not exists(select 1 from public.hotels where id=s.hotel_id and platform_status<>'archived')
 or not public.is_hotel_module_enabled(s.hotel_id,'core.directory') or not public.is_hotel_module_enabled(s.hotel_id,'fb.menu')
 or not exists(select 1 from public.profiles p join fb_order_private.operator_grants g on g.user_id=p.id and g.hotel_id=p.hotel_id
 where p.id=s.created_by and p.hotel_id=s.hotel_id and p.is_active and lower(btrim(coalesce(p.role,''))) in('editor','administrador','admin','owner') and g.active and g.capability='orders.configure')
 or exists(select 1 from fb_kds_private.screen_sectors x where x.screen_id=s.id and (not exists(select 1 from fb_order_private.sectors where id=x.sector_id and hotel_id=s.hotel_id and active)
 or not exists(select 1 from fb_order_private.operator_grants where hotel_id=s.hotel_id and user_id=s.created_by and active and capability='orders.read' and (sector_id is null or sector_id=x.sector_id))))
 then raise exception using errcode='42501',message='kds_denied';end if;
 return s;
end $$;
create function public.get_fb_kds_snapshot(p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s fb_kds_private.screens;tickets jsonb;total integer;begin
 perform fb_order_private.service_only();s:=fb_kds_private.session(p_secret);
 update fb_kds_private.screens set last_seen_at=clock_timestamp() where id=s.id;
 select count(*) into total from fb_order_private.order_groups g join fb_order_private.orders o on o.hotel_id=g.hotel_id and o.id=g.order_id
 where g.hotel_id=s.hotel_id and exists(select 1 from fb_kds_private.screen_sectors where screen_id=s.id and sector_id=g.sector_id)
 and s.settings->'states' ? g.status and o.retain_until>clock_timestamp() and (o.terminal_at is null or o.terminal_at>clock_timestamp()-interval '24 hours');
 select coalesce(jsonb_agg(t.ticket order by t.position),'[]') into tickets from (
 select row_number() over(order by case when s.settings->>'sort'='oldest' then o.created_at end asc,case when s.settings->>'sort'='newest' then o.created_at end desc,g.id) position,
 jsonb_build_object('id',g.id,'order_id',o.id,'sector_id',g.sector_id,'sector_name',g.sector_name,'status',g.status,'revision',g.revision,'created_at',o.created_at,'fulfilment',o.fulfilment,'can_transition',false,
 'lines',case when (s.settings->>'show_items')::boolean then coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'quantity',l.quantity,
 'options',coalesce((select jsonb_agg(op.group_name||': '||op.name order by op.id) from fb_order_private.order_line_options op where op.hotel_id=s.hotel_id and op.line_id=l.id),'[]')) order by l.position)
 from fb_order_private.order_lines l where l.hotel_id=s.hotel_id and l.group_id=g.id),'[]') else '[]'::jsonb end) ticket
 from fb_order_private.order_groups g join fb_order_private.orders o on o.hotel_id=g.hotel_id and o.id=g.order_id
 where g.hotel_id=s.hotel_id and exists(select 1 from fb_kds_private.screen_sectors where screen_id=s.id and sector_id=g.sector_id)
 and s.settings->'states' ? g.status and o.retain_until>clock_timestamp() and (o.terminal_at is null or o.terminal_at>clock_timestamp()-interval '24 hours')
 order by position limit (s.settings->>'ticket_limit')::integer)t;
 return jsonb_build_object('screen',fb_kds_private.screen_json(s),'hotel_name',(select name from public.hotels where id=s.hotel_id),'tickets',tickets,'total',total,'updated_at',clock_timestamp());
end $$;
create function public.authorize_current_hotel_fb_kds(p_secret text,p_group_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_kds_private.actor();s fb_kds_private.screens;sector uuid;begin
 s:=fb_kds_private.session(p_secret);
 if s.hotel_id<>h then raise exception using errcode='42501',message='kds_denied';end if;
 if p_group_id is not null then
  select g.sector_id into sector from fb_order_private.order_groups g join fb_kds_private.screen_sectors x on x.hotel_id=g.hotel_id and x.sector_id=g.sector_id
  where g.hotel_id=h and g.id=p_group_id and x.screen_id=s.id;
  if s.mode='monitor' or sector is null then raise exception using errcode='42501',message='kds_denied';end if;
  perform fb_order_private.require_cap(h,'orders.read',sector);perform fb_order_private.require_cap(h,'orders.transition',sector);
 end if;
 return jsonb_build_object('hotel_id',h,'mode',s.mode);
end $$;
create function public.transition_current_hotel_fb_kds_group(p_secret text,p_group_id uuid,p_revision integer,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s fb_kds_private.screens;result jsonb;begin
 -- Session row remains share-locked through canonical transition: revocation cannot race an operation.
 perform public.authorize_current_hotel_fb_kds(p_secret,p_group_id);
 s:=fb_kds_private.session(p_secret);
 if s.mode='dispatch' and p_status not in('out_for_delivery','delivered') then raise exception using errcode='42501',message='kds_dispatch_only';end if;
 result:=public.transition_current_hotel_fb_order_group_v2(p_group_id,p_revision,p_status);
 perform fb_order_private.audit(s.hotel_id,'fb.kds.group_transition',p_group_id);
 return result;
end $$;
revoke all on all functions in schema fb_kds_private from public,anon,authenticated,service_role;
do $$ declare f record;begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(
 'get_current_hotel_fb_kds_admin','save_current_hotel_fb_kds_screen','rotate_current_hotel_fb_kds_access','redeem_fb_kds_pairing','get_fb_kds_snapshot','authorize_current_hotel_fb_kds','transition_current_hotel_fb_kds_group') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.oid::regprocedure);
 execute format('grant execute on function %s to %I',f.oid::regprocedure,case when f.proname in('redeem_fb_kds_pairing','get_fb_kds_snapshot') then 'service_role' else 'authenticated' end);
 end loop;
end $$;
commit;
