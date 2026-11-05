-- Approved replacement: registration outbox and staff-only cancellation V1.
-- No backfill, tenant activation or remote provisioning. Historical migrations remain intact.
begin;
set local lock_timeout='5s';
create table fb_print_private.registration_facts(
 source_event_id uuid primary key references fb_order_private.order_events(id) on delete cascade,
 hotel_id uuid not null,order_id uuid not null,group_id uuid not null,sector_id uuid not null,
 kind text not null check(kind in('order','cancellation')),snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=1048576),
 order_revision integer not null,contract_version integer not null default 1 check(contract_version=1),occurred_at timestamptz not null,retain_until timestamptz not null,
 foreign key(hotel_id,order_id,group_id) references fb_order_private.order_groups(hotel_id,order_id,id) on delete cascade,
 unique(hotel_id,group_id,kind));
alter table fb_print_private.registration_facts enable row level security;
alter table fb_print_private.registration_facts force row level security;
revoke all on fb_print_private.registration_facts from public,anon,authenticated,service_role;
create index registration_facts_retention on fb_print_private.registration_facts(retain_until);
create index c1_registration_cancellation_source on fb_order_private.order_events(hotel_id,created_at,id) where group_id is not null and action in('orders.group_registered','orders.group_cancelled');
create trigger registration_fact_immutable before update or delete on fb_print_private.registration_facts for each row execute function fb_order_private.immutable_fact();

-- Parent event is inserted only after every group/line/option/access row in confirm_fb_order.
-- The trigger and per-group snapshot commit/rollback with that exact transaction.
create function fb_print_private.capture_order_fact() returns trigger language plpgsql security definer set search_path='' as $$
declare g record;event_id uuid;payload jsonb;reason text;begin
 if new.group_id is not null or new.action not in('orders.registered','orders.cancelled') then return new;end if;
 if new.action='orders.cancelled' then reason:=new.metadata->>'reason_code';if reason is null or reason not in('guest_request','unavailable','operational','other') then raise exception using errcode='22023',message='orders_reason_invalid';end if;end if;
 for g in select gr.*,o.retain_until from fb_order_private.order_groups gr join fb_order_private.orders o on o.hotel_id=gr.hotel_id and o.id=gr.order_id where gr.hotel_id=new.hotel_id and gr.order_id=new.order_id order by gr.id loop
  event_id:=fb_order_private.event(new.hotel_id,new.order_id,g.id,case when new.action='orders.registered' then 'orders.group_registered' else 'orders.group_cancelled' end,'system',jsonb_build_object('contract_version',1));
  if new.action='orders.registered' then payload:=fb_print_private.commercial(new.hotel_id,new.order_id,g.id,event_id);
  else select snapshot into payload from fb_print_private.registration_facts where hotel_id=new.hotel_id and group_id=g.id and kind='order';if payload is null then payload:=fb_print_private.commercial(new.hotel_id,new.order_id,g.id,event_id);end if;payload:=payload||jsonb_build_object('document_kind','cancellation','label','CANCELAMENTO','cancelled_at',new.created_at,'cancellation_reason_code',reason);end if;
  if payload is null or jsonb_array_length(payload->'lines')=0 then raise exception using errcode='22023',message='orders_group_fact_missing';end if;
  insert into fb_print_private.registration_facts(source_event_id,hotel_id,order_id,group_id,sector_id,kind,snapshot,order_revision,occurred_at,retain_until) values(event_id,new.hotel_id,new.order_id,g.id,g.sector_id,case when new.action='orders.registered' then 'order' else 'cancellation' end,payload,new.order_revision,new.created_at,g.retain_until);
 end loop;return new;
end $$;
revoke all on function fb_print_private.capture_order_fact() from public,anon,authenticated,service_role;
create trigger printing_durable_order_fact after insert on fb_order_private.order_events for each row execute function fb_print_private.capture_order_fact();

do $$declare c record;begin for c in select conname from pg_constraint where conrelid='fb_print_private.jobs'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%kind%' loop execute format('alter table fb_print_private.jobs drop constraint %I',c.conname);end loop;end $$;
alter table fb_print_private.jobs add constraint jobs_kind_v2 check(kind in('order','test','reprint','cancellation'));
alter table fb_print_private.jobs add constraint jobs_identity_v2 check((kind='test' and order_id is null and source_event_id is null and original_job_id is null) or (kind='order' and order_id is not null and group_id is not null and source_event_id is not null and original_job_id is null) or (kind='reprint' and original_job_id is not null and actor_user_id is not null and reason_code is not null) or (kind='cancellation' and order_id is not null and group_id is not null and source_event_id is not null and original_job_id is not null and reason_code in('guest_request','unavailable','operational','other')));
create unique index cancellation_job_once on fb_print_private.jobs(hotel_id,source_event_id,original_job_id) where kind='cancellation';


create or replace function fb_print_private.reconcile(h uuid,batch integer) returns jsonb language plpgsql set search_path='' as $$
declare cfg fb_print_private.settings%rowtype;e record;r record;payload jsonb;count_routes integer;n integer:=0;blocked integer:=0;expired integer:=0;begin
 if batch is null or batch not between 1 and 100 then raise exception using errcode='22023',message='printing_batch_invalid';end if;
 select * into cfg from fb_print_private.settings where hotel_id=h;
 if cfg.hotel_id is null or not cfg.enabled then return jsonb_build_object('materialized',0,'blocked',0,'expired',0,'enabled',false);end if;
 for e in select ev.*,f.kind source_kind,f.snapshot frozen_snapshot from fb_order_private.order_events ev join fb_print_private.registration_facts f on f.hotel_id=ev.hotel_id and f.source_event_id=ev.id left join fb_print_private.processing p on p.hotel_id=ev.hotel_id and p.source_event_id=ev.id
 where ev.hotel_id=h and ev.action in('orders.group_registered','orders.group_cancelled') and ev.group_id is not null and (p.source_event_id is null or p.status='blocked') order by coalesce(p.updated_at,ev.created_at),ev.created_at,ev.id limit batch loop
  if e.source_kind='cancellation' then
   if not exists(select 1 from fb_print_private.jobs where hotel_id=h and group_id=e.group_id and kind='order') then
    insert into fb_print_private.processing(hotel_id,source_event_id,group_id,activation_id,status,code) values(h,e.id,e.group_id,cfg.activation_id,'blocked','source_unavailable') on conflict(hotel_id,source_event_id) do update set status='blocked',code='source_unavailable',updated_at=clock_timestamp();blocked:=blocked+1;continue;
   end if;
   if e.created_at+make_interval(mins=>cfg.ticket_minutes)<=clock_timestamp() then
    insert into fb_print_private.processing(hotel_id,source_event_id,group_id,activation_id,status,code) values(h,e.id,e.group_id,cfg.activation_id,'expired','ticket_expired') on conflict(hotel_id,source_event_id) do update set status='expired',code='ticket_expired',updated_at=clock_timestamp();expired:=expired+1;continue;
   end if;
   for r in select * from fb_print_private.jobs where hotel_id=h and group_id=e.group_id and kind='order' order by created_at,id loop
    payload:=r.snapshot||jsonb_build_object('document_kind','cancellation','label','CANCELAMENTO','cancelled_at',e.frozen_snapshot->'cancelled_at','cancellation_reason_code',e.frozen_snapshot->'cancellation_reason_code');
    with made as(insert into fb_print_private.jobs(hotel_id,kind,source_event_id,order_id,group_id,sector_id,destination_id,copy_number,original_job_id,reason_code,snapshot,snapshot_hash,routing_snapshot,expires_at,retain_until)
    values(h,'cancellation',e.id,e.order_id,e.group_id,r.sector_id,r.destination_id,r.copy_number,r.id,e.frozen_snapshot->>'cancellation_reason_code',payload,encode(sha256(convert_to(payload::text,'UTF8')),'hex'),r.routing_snapshot,least(e.created_at+make_interval(mins=>cfg.ticket_minutes),r.retain_until),r.retain_until) on conflict do nothing returning hotel_id,id)
    insert into fb_print_private.events(hotel_id,job_id,actor_kind,action,state) select hotel_id,id,'system','created','queued' from made;
   end loop;
   insert into fb_print_private.processing(hotel_id,source_event_id,group_id,activation_id,status,code) values(h,e.id,e.group_id,cfg.activation_id,'materialized','materialized') on conflict(hotel_id,source_event_id) do update set status='materialized',code='materialized',updated_at=clock_timestamp();n:=n+1;continue;
  end if;
  if e.created_at+make_interval(mins=>cfg.ticket_minutes)<=clock_timestamp() then
   insert into fb_print_private.processing(hotel_id,source_event_id,group_id,activation_id,status,code) values(h,e.id,e.group_id,cfg.activation_id,'expired','ticket_expired')
   on conflict(hotel_id,source_event_id) do update set status='expired',code='ticket_expired',updated_at=clock_timestamp();expired:=expired+1;continue;
  end if;
  select count(*) into count_routes from fb_print_private.routes rt join fb_order_private.order_groups gr on gr.hotel_id=rt.hotel_id and gr.sector_id=rt.sector_id
  where rt.hotel_id=h and gr.id=e.group_id and gr.order_id=e.order_id and rt.active and rt.role='primary';
  if count_routes=0 or (not cfg.fan_out and (count_routes>1 or exists(select 1 from fb_print_private.routes rt join fb_order_private.order_groups gr on gr.hotel_id=rt.hotel_id and gr.sector_id=rt.sector_id where rt.hotel_id=h and gr.id=e.group_id and rt.active and rt.role='primary' and rt.copy_number<>1))) then
   insert into fb_print_private.processing(hotel_id,source_event_id,group_id,activation_id,status,code) values(h,e.id,e.group_id,cfg.activation_id,'blocked',case when count_routes=0 then 'no_route' else 'fan_out_disabled' end)
   on conflict(hotel_id,source_event_id) do update set status='blocked',code=excluded.code,updated_at=clock_timestamp();blocked:=blocked+1;continue;
  end if;
  if exists(select 1 from fb_print_private.routes rt join fb_order_private.order_groups gr on gr.hotel_id=rt.hotel_id and gr.sector_id=rt.sector_id
    join fb_print_private.destinations d on d.hotel_id=rt.hotel_id and d.id=rt.destination_id join fb_print_private.devices dev on dev.hotel_id=d.hotel_id and dev.id=d.device_id
    where rt.hotel_id=h and gr.id=e.group_id and rt.active and rt.role='primary' and (not d.active or not dev.active or dev.revoked_at is not null or not exists(select 1 from fb_print_private.printers pr where pr.hotel_id=h and pr.destination_id=d.id and pr.device_id=d.device_id and pr.active))) then
   insert into fb_print_private.processing(hotel_id,source_event_id,group_id,activation_id,status,code) values(h,e.id,e.group_id,cfg.activation_id,'blocked','destination_unavailable')
   on conflict(hotel_id,source_event_id) do update set status='blocked',code='destination_unavailable',updated_at=clock_timestamp();blocked:=blocked+1;continue;
  end if;
  payload:=e.frozen_snapshot;
  if payload is null or jsonb_array_length(payload->'lines')=0 then
   insert into fb_print_private.processing(hotel_id,source_event_id,group_id,activation_id,status,code) values(h,e.id,e.group_id,cfg.activation_id,'blocked','source_unavailable')
   on conflict(hotel_id,source_event_id) do update set status='blocked',code='source_unavailable',updated_at=clock_timestamp();blocked:=blocked+1;continue;
  end if;
  for r in select rt.*,d.device_id,d.revision destination_revision,d.allow_room,d.allow_notes,d.allow_name,
   (select to_jsonb(pr) from fb_print_private.printers pr where pr.hotel_id=h and pr.destination_id=d.id and pr.device_id=d.device_id and pr.active order by pr.priority,pr.id limit 1) printer
   from fb_print_private.routes rt join fb_order_private.order_groups gr on gr.hotel_id=rt.hotel_id and gr.sector_id=rt.sector_id
   join fb_print_private.destinations d on d.hotel_id=rt.hotel_id and d.id=rt.destination_id
   where rt.hotel_id=h and gr.id=e.group_id and gr.order_id=e.order_id and rt.active and rt.role='primary' order by rt.id loop
   with created as(insert into fb_print_private.jobs(hotel_id,kind,source_event_id,order_id,group_id,sector_id,destination_id,copy_number,snapshot,snapshot_hash,routing_snapshot,expires_at,retain_until)
   values(h,'order',e.id,e.order_id,e.group_id,r.sector_id,r.destination_id,r.copy_number,payload,encode(sha256(convert_to(payload::text,'UTF8')),'hex'),
    jsonb_build_object('route_id',r.id,'route_revision',r.revision,'destination_revision',r.destination_revision,'device_id',r.device_id,
    'printer',r.printer,'allow_room',cfg.allow_room and r.allow_room,'allow_notes',cfg.allow_notes and r.allow_notes,'allow_name',cfg.allow_name and r.allow_name,
    'backups',coalesce((select jsonb_agg(jsonb_build_object('destination_id',b.destination_id,'revision',b.revision)) from fb_print_private.routes b where b.hotel_id=h and b.sector_id=r.sector_id and b.role='backup' and b.active),'[]')),
    least(e.created_at+make_interval(mins=>cfg.ticket_minutes),(select retain_until from fb_order_private.orders where hotel_id=h and id=e.order_id)),(select retain_until from fb_order_private.orders where hotel_id=h and id=e.order_id)) on conflict do nothing returning hotel_id,id)
   insert into fb_print_private.events(hotel_id,job_id,actor_kind,action,state) select hotel_id,id,'system','created','queued' from created;
  end loop;
  insert into fb_print_private.processing(hotel_id,source_event_id,group_id,activation_id,status,code) values(h,e.id,e.group_id,cfg.activation_id,'materialized','materialized')
  on conflict(hotel_id,source_event_id) do update set status='materialized',code='materialized',updated_at=clock_timestamp();n:=n+1;
 end loop;
 return jsonb_build_object('materialized',n,'blocked',blocked,'expired',expired,'enabled',true);
end $$;

create or replace function public.activate_current_hotel_fb_printing(p_enabled boolean,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$declare h uuid:=fb_print_private.actor();s fb_print_private.settings%rowtype;activation uuid:=gen_random_uuid();begin
 perform fb_print_private.require_cap(h,'printing.configure');
 if p_enabled is null or p_expected_revision is null then raise exception using errcode='22023',message='printing_input_invalid';end if;
 select * into s from fb_print_private.settings where hotel_id=h;
 if s.hotel_id is null then raise exception using errcode='22023',message='printing_settings_required';end if;
 if s.revision<>p_expected_revision then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
 if p_enabled and not s.enabled then
  -- B's acceptance also holds this hotel row lock. Commit order, not clock/cursor, defines baseline.
  insert into fb_print_private.processing(hotel_id,source_event_id,group_id,activation_id,status,code)
  select h,e.id,e.group_id,activation,'baseline','before_activation' from fb_order_private.order_events e
  where e.hotel_id=h and e.action in('orders.group_registered','orders.group_cancelled') on conflict(hotel_id,source_event_id) do update
  set status='baseline',code='before_activation',activation_id=excluded.activation_id,updated_at=clock_timestamp()
  where fb_print_private.processing.status='blocked';
 end if;
 update fb_print_private.settings set enabled=p_enabled,activation_id=case when p_enabled and not s.enabled then activation else activation_id end,
 activated_at=case when p_enabled and not s.enabled then clock_timestamp() else activated_at end,revision=revision+1,updated_at=clock_timestamp() where hotel_id=h returning * into s;
 perform fb_print_private.audit(h,'printing.activation_changed',h);return to_jsonb(s);
end $$;

create or replace function public.claim_fb_print_job(p_credential_id uuid,p_digest text,p_protocol_version integer,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d fb_print_private.devices%rowtype;j fb_print_private.jobs%rowtype;a uuid;r jsonb;v jsonb:='{}';begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);
 r:=fb_print_private.command(d.hotel_id,d.id,'claim',p_key,v);if r is not null then
  if r->>'job_id' is null then return r;end if;
  select * into j from fb_print_private.jobs where hotel_id=d.hotel_id and id=(r->>'job_id')::uuid;
  if j.id is null or j.retain_until<=clock_timestamp() then raise exception using errcode='PT410',message='printing_job_expired';end if;
  if j.fence is distinct from (r->>'fence')::bigint or j.owner_device_id is distinct from d.id then raise exception using errcode='PT409',message='printing_stale_fence';end if;
  return fb_print_private.job_view(j);
 end if;
 if not coalesce((select enabled from fb_print_private.settings where hotel_id=d.hotel_id),false) then return fb_print_private.remember(d.hotel_id,d.id,'claim',p_key,v,jsonb_build_object('job_id',null,'enabled',false));end if;
 perform fb_print_private.reconcile(d.hotel_id,50);
 with chosen as(select id from fb_print_private.jobs where hotel_id=d.hotel_id and state='dispatching' and lease_until<=clock_timestamp() order by lease_until,id limit 100),
 changed as(update fb_print_private.jobs target_job set state='ambiguous',code='dispatch_result_missing',revision=revision+1 from chosen where target_job.id=chosen.id returning target_job.*)
 insert into fb_print_private.events(hotel_id,job_id,attempt_id,actor_kind,action,state,code) select c.hotel_id,c.id,attempt.id,'system','ambiguous',c.state,c.code from changed c left join fb_print_private.attempts attempt on attempt.hotel_id=c.hotel_id and attempt.job_id=c.id and attempt.fence=c.fence;
 with chosen as(select id from fb_print_private.jobs where hotel_id=d.hotel_id and state in('queued','retry_wait','leased','blocked') and (expires_at<=clock_timestamp() or retain_until<=clock_timestamp()) order by expires_at,id limit 100),
 changed as(update fb_print_private.jobs target_job set state='expired',code='ticket_expired',revision=revision+1 from chosen where target_job.id=chosen.id returning target_job.*)
 insert into fb_print_private.events(hotel_id,job_id,attempt_id,actor_kind,action,state,code) select c.hotel_id,c.id,attempt.id,'system','expired',c.state,c.code from changed c left join fb_print_private.attempts attempt on attempt.hotel_id=c.hotel_id and attempt.job_id=c.id and attempt.fence=c.fence;
 with chosen as(select jb.id from fb_print_private.jobs jb where jb.hotel_id=d.hotel_id and jb.state in('queued','retry_wait','leased') and jb.dispatch_at is null and not exists(
  select 1 from fb_print_private.destinations ds join fb_print_private.devices dv on dv.hotel_id=ds.hotel_id and dv.id=ds.device_id
  join fb_print_private.printers pr on pr.hotel_id=ds.hotel_id and pr.destination_id=ds.id and pr.device_id=dv.id
  where ds.hotel_id=jb.hotel_id and ds.id=jb.destination_id and ds.active and dv.active and dv.revoked_at is null and pr.active
  and ds.revision=(jb.routing_snapshot->>'destination_revision')::int and dv.id::text=jb.routing_snapshot->>'device_id'
  and pr.id::text=jb.routing_snapshot->'printer'->>'id' and pr.revision=(jb.routing_snapshot->'printer'->>'revision')::int) order by jb.created_at,jb.id limit 100),
 changed as(update fb_print_private.jobs target_job set state='blocked',code='destination_changed',revision=revision+1 from chosen where target_job.id=chosen.id returning target_job.*)
 insert into fb_print_private.events(hotel_id,job_id,attempt_id,actor_kind,action,state,code) select c.hotel_id,c.id,attempt.id,'system','blocked',c.state,c.code from changed c left join fb_print_private.attempts attempt on attempt.hotel_id=c.hotel_id and attempt.job_id=c.id and attempt.fence=c.fence;
 select jb.* into j from fb_print_private.jobs jb join fb_print_private.destinations ds on ds.hotel_id=jb.hotel_id and ds.id=jb.destination_id
 where jb.hotel_id=d.hotel_id and ((jb.kind<>'cancellation' and coalesce(jb.snapshot->>'document_kind','')<>'cancellation') or coalesce(d.software_version,'')~'^(c2-|c2-lab-|fixture-)1[.]([2-9]|[1-9][0-9]+)[.][0-9]+([+_-][A-Za-z0-9._-]+)?$') and ds.device_id=d.id and ds.active and jb.available_at<=clock_timestamp() and jb.expires_at>clock_timestamp() and jb.retain_until>clock_timestamp()
 and (jb.state in('queued','retry_wait') or (jb.state='leased' and jb.lease_until<=clock_timestamp()))
 and jb.routing_snapshot->>'device_id'=d.id::text
 and (jb.routing_snapshot->>'destination_revision')::int=ds.revision
 order by ds.priority,jb.created_at,jb.id limit 1 for update of jb;
 if j.id is null then return fb_print_private.remember(d.hotel_id,d.id,'claim',p_key,v,jsonb_build_object('job_id',null,'enabled',true));end if;
 if j.protocol_version<>p_protocol_version or j.payload_version<>1 or j.renderer_version<>1 then raise exception using errcode='PT409',message='printing_incompatible_version';end if;
 update fb_print_private.jobs set state='leased',fence=fence+1,owner_device_id=d.id,lease_until=clock_timestamp()+interval '60 seconds',receipt_at=null,dispatch_at=null,revision=revision+1,code=null where id=j.id returning * into j;
 insert into fb_print_private.attempts(hotel_id,job_id,device_id,fence) values(d.hotel_id,j.id,d.id,j.fence) returning id into a;
 insert into fb_print_private.events(hotel_id,job_id,attempt_id,device_id,actor_kind,action,state) values(d.hotel_id,j.id,a,d.id,'device','claimed','leased');
 r:=fb_print_private.job_view(j);return fb_print_private.remember(d.hotel_id,d.id,'claim',p_key,v,r);
end $$;

create or replace function public.authorize_fb_print_dispatch(p_credential_id uuid,p_digest text,p_protocol_version integer,p_job_id uuid,p_fence bigint,p_expected_revision integer,p_snapshot_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$declare d fb_print_private.devices%rowtype;j fb_print_private.jobs%rowtype;ds fb_print_private.destinations%rowtype;pr fb_print_private.printers%rowtype;private jsonb;a uuid;begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);j:=fb_print_private.owned(d,p_job_id,p_fence);
 if not fb_print_private.equal_digest(j.snapshot_hash,p_snapshot_hash) then raise exception using errcode='PT409',message='printing_payload_mismatch';end if;
 if j.state not in('leased','dispatching') or j.receipt_at is null or j.lease_until<=clock_timestamp() or j.expires_at<=clock_timestamp() then raise exception using errcode='PT410',message='printing_dispatch_not_eligible';end if;
 if j.state='leased' and j.revision is distinct from p_expected_revision then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
 if not coalesce((select enabled from fb_print_private.settings where hotel_id=d.hotel_id),false) then raise exception using errcode='42501',message='printing_disabled';end if;
 select * into ds from fb_print_private.destinations where hotel_id=d.hotel_id and id=j.destination_id and active;
 select * into pr from fb_print_private.printers where hotel_id=d.hotel_id and id=(j.routing_snapshot->'printer'->>'id')::uuid and active;
 if ds.id is null or ds.device_id<>d.id or ds.revision<>(j.routing_snapshot->>'destination_revision')::int or pr.id is null or pr.device_id<>d.id or pr.destination_id<>j.destination_id or pr.revision<>(j.routing_snapshot->'printer'->>'revision')::int then raise exception using errcode='PT409',message='printing_destination_changed';end if;
 if j.kind='order' and not exists(select 1 from fb_order_private.orders o join fb_order_private.order_groups g on g.hotel_id=o.hotel_id and g.order_id=o.id and g.id=j.group_id where o.hotel_id=d.hotel_id and o.id=j.order_id and o.retain_until>clock_timestamp() and g.status not in('cancelled','delivered')) then
  if j.state='dispatching' then raise exception using errcode='PT410',message='printing_source_not_printable';end if;
  update fb_print_private.jobs set state='cancelled',code='source_not_printable',revision=revision+1 where id=j.id returning * into j;return fb_print_private.job_view(j);
 end if;
 private:=fb_print_private.private_projection(j);
 if j.kind='cancellation' and not exists(select 1 from fb_print_private.registration_facts f where f.hotel_id=j.hotel_id and f.source_event_id=j.source_event_id and f.kind='cancellation' and f.group_id=j.group_id and f.retain_until>clock_timestamp()) then raise exception using errcode='PT410',message='printing_cancellation_source_missing';end if;
 if j.kind<>'cancellation' and coalesce(j.snapshot->>'document_kind','')<>'cancellation' and j.snapshot->>'fulfilment'='room_delivery' and (j.routing_snapshot->>'allow_room')::boolean and (private->>'expired')::boolean then raise exception using errcode='PT410',message='printing_private_expired';end if;
 if j.state='dispatching' then return fb_print_private.job_view(j)||jsonb_build_object('private',private);end if;
 update fb_print_private.jobs set state='dispatching',dispatch_at=clock_timestamp(),revision=revision+1 where id=j.id returning * into j;
 select id into a from fb_print_private.attempts where hotel_id=d.hotel_id and job_id=j.id and fence=j.fence;
 insert into fb_print_private.events(hotel_id,job_id,attempt_id,device_id,actor_kind,action,state) values(d.hotel_id,j.id,a,d.id,'device','dispatch_authorized','dispatching');
 return fb_print_private.job_view(j)||jsonb_build_object('private',private);
end $$;

create or replace function public.get_current_hotel_fb_print_console(p_limit integer default 25,p_after_created timestamptz default null,p_after_id uuid default null,p_state text default null,p_sector uuid default null,p_kind text default null,p_destination uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();a jsonb:=public.get_current_hotel_fb_print_access();cfg jsonb:='{}';q jsonb;last_row jsonb;more boolean;health jsonb;begin
 if p_limit is null or p_limit not between 1 and 50 or (p_after_created is null)<>(p_after_id is null) or (p_state is not null and p_state not in('queued','leased','dispatching','submitted','confirmed','retry_wait','blocked','ambiguous','expired','cancelled')) or (p_kind is not null and p_kind not in('order','test','reprint','cancellation')) then raise exception using errcode='22023',message='printing_filter_invalid';end if;
 if (a->>'configure')::boolean then cfg:=public.get_current_hotel_fb_print_config();end if;
 if (a->>'manage_grants')::boolean then cfg:=cfg||jsonb_build_object('users',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',full_name,'role',role)) from public.profiles where hotel_id=h and is_active),'[]'),'grants',coalesce((select jsonb_agg(to_jsonb(g)) from fb_print_private.grants g where hotel_id=h),'[]'));end if;
 with visible as(select * from fb_print_private.jobs j where hotel_id=h and retain_until>clock_timestamp() and fb_order_private.can(h,'orders.read',sector_id)
 and (p_state is null or state=p_state) and (p_sector is null or sector_id=p_sector) and (p_kind is null or kind=p_kind) and (p_destination is null or destination_id=p_destination)
 and (p_after_id is null or (created_at,id)>(p_after_created,p_after_id)) order by created_at,id limit p_limit+1)
 select coalesce(jsonb_agg(fb_print_private.admin_job(v::fb_print_private.jobs) order by created_at,id),'[]') into q from (select * from visible order by created_at,id limit p_limit) v;
 select count(*)>p_limit into more from(select id from fb_print_private.jobs where hotel_id=h and retain_until>clock_timestamp() and fb_order_private.can(h,'orders.read',sector_id)
 and (p_state is null or state=p_state) and (p_sector is null or sector_id=p_sector) and (p_kind is null or kind=p_kind) and (p_destination is null or destination_id=p_destination)
 and (p_after_id is null or (created_at,id)>(p_after_created,p_after_id)) order by created_at,id limit p_limit+1)t;
 select jsonb_build_object('backlog',count(*) filter(where state in('queued','leased','retry_wait','blocked')),'ambiguous',count(*) filter(where state='ambiguous'),
 'oldest_at',min(created_at) filter(where state in('queued','leased','retry_wait','blocked')),'last_error',(array_agg(code order by created_at desc,id desc) filter(where code is not null and state in('ambiguous','blocked','retry_wait')))[1]) into health from fb_print_private.jobs where hotel_id=h and retain_until>clock_timestamp() and fb_order_private.can(h,'orders.read',sector_id);
 last_row:=q->(jsonb_array_length(q)-1);
 return jsonb_build_object('access',a,'config',cfg,'jobs',q,'health',health,'server_time',clock_timestamp(),'next',case when more then jsonb_build_object('created_at',last_row->'created_at','id',last_row->'job_id') else null end);
end $$;


-- Guest HTTP and direct service-RPC entrypoints both fail closed. History/old decisions remain.
create or replace function public.request_fb_order_cancellation(p_hotel_slug text,p_access_secret text,p_expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$begin perform fb_order_private.service_only();raise exception using errcode='42501',message='orders_guest_cancellation_disabled';end $$;

create function public.cancel_current_hotel_fb_order_v1(p_order_id uuid,p_expected_revision integer,p_reason_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.drain_actor();o fb_order_private.orders%rowtype;begin
 select * into o from fb_order_private.orders where hotel_id=h and id=p_order_id and retain_until>clock_timestamp() for update;
 if o.id is null or not exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o.id) or exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o.id and (not fb_order_private.can(h,'orders.read',sector_id) or not fb_order_private.can(h,'orders.cancel',sector_id))) then raise exception using errcode='42501',message='orders_cancel_denied';end if;
 if p_reason_code is null or p_reason_code not in('guest_request','unavailable','operational','other') then raise exception using errcode='22023',message='orders_reason_invalid';end if;
 if o.status='cancelled' then return jsonb_build_object('status','cancelled','revision',o.revision);end if;
 if o.revision is distinct from p_expected_revision then raise exception using errcode='PT409',message='orders_revision_conflict';end if;
 if o.status='delivered' or exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o.id and status='delivered') then raise exception using errcode='22023',message='orders_cancel_delivered';end if;
 if exists(select 1 from fb_order_private.order_groups where hotel_id=h and order_id=o.id and status='out_for_delivery') then perform fb_order_private.require_cap(h,'orders.supervise');end if;
 perform fb_order_private.cancel_order(h,o.id,'staff',p_reason_code);
 return jsonb_build_object('status','cancelled','revision',(select revision from fb_order_private.orders where hotel_id=h and id=o.id));
end $$;
revoke all on function public.cancel_current_hotel_fb_order_v1(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.cancel_current_hotel_fb_order_v1(uuid,integer,text) to authenticated;

create function public.get_fb_order_contact_sources(p_hotel_slug text,p_access_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o fb_order_private.orders%rowtype;begin
 perform fb_order_private.service_only();select * into o from fb_order_private.orders where id=fb_order_private.token_order(p_hotel_slug,p_access_secret);
 return jsonb_build_object('specific',(select jsonb_build_object('label',s.title,'description',s.content,'url',s.url) from public.hotel_fb_service_links l join public.hotel_sections s on s.hotel_id=l.hotel_id and s.id=l.service_id where l.hotel_id=o.hotel_id and l.outlet_id=o.outlet_origin_id and s.enabled limit 1),'departments',coalesce((select jsonb_agg(jsonb_build_object('label',name,'description',description,'url',url) order by name,id) from public.hotel_departments where hotel_id=o.hotel_id and enabled),'[]'));
end $$;
revoke all on function public.get_fb_order_contact_sources(text,text) from public,anon,authenticated,service_role;
grant execute on function public.get_fb_order_contact_sources(text,text) to service_role;
commit;
