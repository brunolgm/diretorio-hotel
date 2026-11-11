-- Universal administrative journey. No provisioning, grants, ordering or admission changes.
begin;
set local lock_timeout='5s';
create table fb_print_private.deployment_reviews (
 hotel_id uuid not null references public.hotels(id), printer_id uuid not null,
 printer_revision integer not null, job_id uuid not null, route_id uuid not null,
 route_revision integer not null, settings_revision integer not null,
 device_revision integer not null, destination_revision integer not null,
 completed_by uuid not null, completed_at timestamptz not null default clock_timestamp(),
 primary key(hotel_id,printer_id,printer_revision,job_id,route_id,route_revision,settings_revision,device_revision,destination_revision),
 foreign key(hotel_id,printer_id) references fb_print_private.printers(hotel_id,id),
 foreign key(hotel_id,job_id) references fb_print_private.jobs(hotel_id,id) on delete cascade,
 foreign key(hotel_id,route_id) references fb_print_private.routes(hotel_id,id)
);
alter table fb_print_private.deployment_reviews enable row level security;
alter table fb_print_private.deployment_reviews force row level security;
revoke all on fb_print_private.deployment_reviews from public,anon,authenticated,service_role;

alter function public.get_current_hotel_fb_commissioning() set schema fb_print_private;
alter function fb_print_private.get_current_hotel_fb_commissioning() rename to commissioning_before_v4;
revoke all on function fb_print_private.commissioning_before_v4() from public,anon,authenticated,service_role;

create function public.get_current_hotel_fb_commissioning() returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor(); base jsonb;outlets jsonb;begin
 perform fb_print_private.require_cap(h,'printing.configure');
 base:=fb_print_private.commissioning_before_v4();
 select coalesce(jsonb_agg(jsonb_build_object('outlet_id',os.id,'name',o.name,
  'accepting',os.accepting,'published',o.is_published,'pickup',os.pickup,'room_delivery',os.room_delivery,
  'open_now',fb_order_private.scope_available(h,'outlet',os.id,now()),
  'products_available',exists(select 1 from public.hotel_fb_outlet_menus om
   join public.hotel_fb_menus m on m.hotel_id=om.hotel_id and m.id=om.menu_id
   join public.hotel_fb_categories c on c.hotel_id=m.hotel_id and c.menu_id=m.id
   join public.hotel_fb_items i on i.hotel_id=c.hotel_id and i.category_id=c.id
   where om.hotel_id=h and om.outlet_id=os.id and m.is_published and c.is_published and i.is_published and i.is_available and i.price_amount_minor is not null and not i.price_on_request
   and fb_order_private.scope_available(h,'menu',m.id,now()) and fb_order_private.scope_available(h,'item',i.id,now())),
  'room_access',public.is_hotel_module_enabled(h,'rooms.qr') and exists(select 1 from public.hotel_room_links l where l.hotel_id=h and l.is_active)
 ) order by o.name,os.id),'[]') into outlets
 from fb_order_private.outlet_settings os join public.hotel_fb_outlets o on o.hotel_id=os.hotel_id and o.id=os.id
 where os.hotel_id=h and os.mode='native';
 return base||jsonb_build_object('actor_id',auth.uid(),'server_time',now(),
  'can_configure_orders',fb_order_private.can(h,'orders.configure'),
  'can_supervise',fb_order_private.can(h,'orders.supervise'),
  'sectors',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'active',active,'revision',revision) order by name,id) from fb_order_private.sectors where hotel_id=h),'[]'),
  'guest_readiness',jsonb_build_object('ordering',coalesce((select enabled from fb_order_private.hotel_settings where hotel_id=h),false),
    'modules',public.is_hotel_module_enabled(h,'fb.menu') and public.is_hotel_module_enabled(h,'core.directory'),'outlets',outlets,'journey_verified',false),
  'tests',coalesce((select jsonb_agg(x.payload order by x.created_at desc,x.id desc) from
   (select id,created_at,jsonb_build_object('job_id',id,'destination_id',destination_id,'sector_id',sector_id,'created_at',created_at,
    'state',state,'code',code,'receipt_at',receipt_at,'dispatch_at',dispatch_at,'revision',revision,
    'printer_id',routing_snapshot->'printer'->>'id','printer_revision',routing_snapshot->'printer'->'revision') payload
    from fb_print_private.jobs where hotel_id=h and kind='test' and retain_until>now() order by created_at desc,id desc limit 100) x),'[]'),
  'completed_reviews',coalesce((select jsonb_agg(to_jsonb(v)) from fb_print_private.deployment_reviews v where hotel_id=h),'[]'));
end $$;
revoke all on function public.get_current_hotel_fb_commissioning() from public,anon,service_role;
grant execute on function public.get_current_hotel_fb_commissioning() to authenticated;

alter function public.execute_current_hotel_fb_commissioning(text,jsonb,uuid) set schema fb_print_private;
alter function fb_print_private.execute_current_hotel_fb_commissioning(text,jsonb,uuid) rename to execute_before_v4;
revoke all on function fb_print_private.execute_before_v4(text,jsonb,uuid) from public,anon,authenticated,service_role;

create function public.execute_current_hotel_fb_commissioning(p_operation text,p_body jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();b jsonb:=p_body;r jsonb;s fb_print_private.settings%rowtype;
 pr fb_print_private.printers%rowtype;rt fb_print_private.routes%rowtype;ds fb_print_private.destinations%rowtype;
 dv fb_print_private.devices%rowtype;j fb_print_private.jobs%rowtype;begin
 perform fb_print_private.require_cap(h,'printing.configure');
 -- actor() holds the tenant lock. Replay, authorization and mutation are serialized as in C1.
 if p_operation not in('sector','end_override','complete_deployment') then
  return fb_print_private.execute_before_v4(p_operation,p_body,p_key);
 end if;
 if b is null or jsonb_typeof(b)<>'object' or octet_length(b::text)>4096 or p_key is null then
  raise exception using errcode='22023',message='printing_command_invalid';end if;
 if p_operation='sector' then perform fb_order_private.require_cap(h,'orders.configure');end if;
 if p_operation='end_override' then perform fb_order_private.require_cap(h,'orders.supervise');end if;
 r:=fb_print_private.command(h,auth.uid(),'commission_'||p_operation,p_key,b);if r is not null then return r;end if;
 if p_operation='sector' then
  if (b-array['name'])<>'{}' or jsonb_typeof(b->'name') is distinct from 'string' then
   raise exception using errcode='22023',message='printing_sector_invalid';end if;
  r:=public.save_current_hotel_fb_order_config('sector',null,0,jsonb_build_object('name',b->>'name','active',true));
 elsif p_operation='end_override' then
  if (b-array['revision'])<>'{}' or jsonb_typeof(b->'revision') is distinct from 'number' or (b->>'revision')!~'^[0-9]+$' then
   raise exception using errcode='22023',message='printing_revision_required';end if;
  select * into s from fb_print_private.settings where hotel_id=h for update;
  if s.hotel_id is null or s.revision is distinct from (b->>'revision')::int then
   raise exception using errcode='PT409',message='printing_revision_conflict';end if;
  -- Removes only the exception. Does not activate printing, alter ordering, baseline or jobs.
  update fb_print_private.settings set technical_override_until=null,technical_override_reason=null,
   revision=revision+1,updated_at=clock_timestamp() where hotel_id=h returning * into s;
  r:=jsonb_build_object('revision',s.revision,'enabled',s.enabled,'override_ended',true,'ordering_unchanged',true);
 else
  if (b-array['printer_id','printer_revision','job_id','route_id','route_revision','settings_revision','device_revision','destination_revision'])<>'{}'
    or (select count(*) from jsonb_object_keys(b))<>8 then raise exception using errcode='22023',message='printing_review_invalid';end if;
  select * into pr from fb_print_private.printers where hotel_id=h and id=(b->>'printer_id')::uuid and active;
  select * into rt from fb_print_private.routes where hotel_id=h and id=(b->>'route_id')::uuid and active;
  select * into ds from fb_print_private.destinations where hotel_id=h and id=pr.destination_id and active;
  select * into dv from fb_print_private.devices where hotel_id=h and id=pr.device_id and active and revoked_at is null;
  select * into s from fb_print_private.settings where hotel_id=h;
  if pr.id is null or rt.id is null or ds.id is null or dv.id is null or not coalesce(s.enabled,false)
   or not exists(select 1 from fb_order_private.sectors se where se.hotel_id=h and se.id=rt.sector_id and se.active)
   or rt.destination_id is distinct from pr.destination_id or pr.device_id is distinct from ds.device_id
   or pr.revision is distinct from (b->>'printer_revision')::int or rt.revision is distinct from (b->>'route_revision')::int
   or s.revision is distinct from (b->>'settings_revision')::int or dv.revision is distinct from (b->>'device_revision')::int
   or ds.revision is distinct from (b->>'destination_revision')::int
   or dv.last_seen_at is null or dv.last_seen_at<now()-interval '90 seconds' or dv.protocol_version is distinct from 1
   or not coalesce(dv.software_version~'^(c2-|c2-lab-|fixture-)1[.]([3-9]|[1-9][0-9]+)[.]',false)
   or not exists(select 1 from fb_print_private.queue_catalog q where q.hotel_id=h and q.device_id=dv.id and q.queue_key=pr.queue_key
    and q.fingerprint=pr.queue_fingerprint and q.present and q.observation='unknown' and q.observed_at>now()-interval '3 minutes') then
   raise exception using errcode='PT409',message='printing_review_stale';end if;
  select * into j from fb_print_private.jobs where hotel_id=h and kind='test' and retain_until>now()
    and routing_snapshot->'printer'->>'id'=pr.id::text and (routing_snapshot->'printer'->>'revision')::int=pr.revision
    order by created_at desc,id desc limit 1;
  if j.id is distinct from (b->>'job_id')::uuid or j.state is distinct from 'submitted'
    or not exists(select 1 from fb_print_private.physical_test_verifications v where v.hotel_id=h and v.job_id=j.id and v.printer_id=pr.id and v.printer_revision=pr.revision) then
   raise exception using errcode='PT409',message='printing_paper_pending';end if;
  insert into fb_print_private.deployment_reviews(hotel_id,printer_id,printer_revision,job_id,route_id,route_revision,settings_revision,device_revision,destination_revision,completed_by)
   values(h,pr.id,pr.revision,j.id,rt.id,rt.revision,s.revision,dv.revision,ds.revision,auth.uid()) on conflict do nothing;
  r:=jsonb_build_object('completed',true,'printer_id',pr.id,'printer_revision',pr.revision,'job_id',j.id,'ordering_unchanged',true);
 end if;
 perform fb_print_private.audit(h,'printing.commission_'||p_operation,h);
 return fb_print_private.remember(h,auth.uid(),'commission_'||p_operation,p_key,b,r);
end $$;
revoke all on function public.execute_current_hotel_fb_commissioning(text,jsonb,uuid) from public,anon,service_role;
grant execute on function public.execute_current_hotel_fb_commissioning(text,jsonb,uuid) to authenticated;

-- Also protect the advanced/legacy test entry point. Replay must precede the pending-job gate.
alter function public.create_current_hotel_fb_print_job(text,uuid,uuid,uuid,text,uuid) set schema fb_print_private;
alter function fb_print_private.create_current_hotel_fb_print_job(text,uuid,uuid,uuid,text,uuid) rename to create_job_before_v4;
revoke all on function fb_print_private.create_job_before_v4(text,uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
create function public.create_current_hotel_fb_print_job(p_kind text,p_destination_id uuid,p_sector_id uuid,p_original_job_id uuid,p_reason_code text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();pr fb_print_private.printers%rowtype;r jsonb;begin
 if p_kind='test' then
  perform fb_print_private.require_cap(h,'printing.test',p_sector_id);
  r:=fb_print_private.command(h,auth.uid(),'test',p_key,jsonb_build_object('kind',p_kind,'destination',p_destination_id,'sector',p_sector_id,'original',p_original_job_id,'reason',p_reason_code));
  if r is not null then return fb_print_private.create_job_before_v4(p_kind,p_destination_id,p_sector_id,p_original_job_id,p_reason_code,p_key);end if;
  select p.* into pr from fb_print_private.printers p join fb_print_private.destinations d on d.hotel_id=p.hotel_id and d.id=p.destination_id
   where p.hotel_id=h and p.destination_id=p_destination_id and p.device_id=d.device_id and p.active order by p.priority,p.id limit 1;
  if exists(select 1 from fb_print_private.jobs j where j.hotel_id=h and j.kind='test' and j.destination_id=p_destination_id and j.retain_until>now()
   and j.routing_snapshot->'printer'->>'id'=pr.id::text and (j.routing_snapshot->'printer'->>'revision')::int=pr.revision
   and (j.state in('queued','leased','dispatching','retry_wait','ambiguous') or j.state='submitted' and not exists(select 1 from fb_print_private.physical_test_verifications v where v.hotel_id=h and v.job_id=j.id))) then
   raise exception using errcode='PT409',message='printing_test_pending';end if;
 end if;
 return fb_print_private.create_job_before_v4(p_kind,p_destination_id,p_sector_id,p_original_job_id,p_reason_code,p_key);
end $$;
revoke all on function public.create_current_hotel_fb_print_job(text,uuid,uuid,uuid,text,uuid) from public,anon,service_role;
grant execute on function public.create_current_hotel_fb_print_job(text,uuid,uuid,uuid,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
