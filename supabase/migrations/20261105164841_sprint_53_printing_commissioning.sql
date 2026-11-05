-- Deployment productization. No tenant provisioning or activation; private metadata only.
begin;
set local lock_timeout='5s';
alter table fb_print_private.devices add column discovery_requested_at timestamptz,add column discovery_at timestamptz;
alter table fb_print_private.printers add column queue_key text,add column queue_fingerprint text;
alter table fb_print_private.settings add column technical_override_until timestamptz,add column technical_override_reason text;
create table fb_print_private.queue_catalog(
 hotel_id uuid not null,device_id uuid not null,queue_key text not null check(queue_key~'^[0-9a-f]{64}$'),
 queue_name text not null check(length(queue_name) between 1 and 120),driver_name text not null check(length(driver_name)<=160),
 fingerprint text not null,observation text not null check(observation in('unknown','offline','paper_out','error','unavailable')),
 present boolean not null,revision integer not null default 1,observed_at timestamptz not null,
 primary key(hotel_id,device_id,queue_key),foreign key(hotel_id,device_id) references fb_print_private.devices(hotel_id,id) on delete cascade);
create table fb_print_private.physical_test_verifications(
 hotel_id uuid not null,job_id uuid not null,printer_id uuid not null,printer_revision integer not null,
 verified_by uuid not null,verified_at timestamptz not null default clock_timestamp(),
 primary key(hotel_id,job_id),foreign key(hotel_id,job_id) references fb_print_private.jobs(hotel_id,id) on delete cascade);
alter table fb_print_private.queue_catalog enable row level security;
alter table fb_print_private.queue_catalog force row level security;
alter table fb_print_private.physical_test_verifications enable row level security;
alter table fb_print_private.physical_test_verifications force row level security;
revoke all on fb_print_private.queue_catalog,fb_print_private.physical_test_verifications from public,anon,authenticated,service_role;

create function public.report_fb_print_queues(p_credential_id uuid,p_digest text,p_protocol_version integer,p_queues jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d fb_print_private.devices%rowtype;q jsonb;k text;fp text;n text;driver text;state text;seen text[]:='{}';at timestamptz:=clock_timestamp();begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);
 if p_queues is null or jsonb_typeof(p_queues)<>'array' or jsonb_array_length(p_queues)>64 or octet_length(p_queues::text)>60000 then raise exception using errcode='22023',message='printing_discovery_invalid';end if;
 for q in select value from jsonb_array_elements(p_queues) loop
  if jsonb_typeof(q)<>'object' or (q-array['name','driver','state'])<>'{}' then raise exception using errcode='22023',message='printing_discovery_invalid';end if;
  n:=q->>'name';driver:=q->>'driver';state:=q->>'state';
  if n is null or n<>btrim(n) or length(n) not between 1 and 120 or n~'[[:cntrl:]\\/<>]' or driver is null or length(driver)>160 or driver~'[[:cntrl:]]' or state is null or state not in('unknown','offline','paper_out','error','unavailable') then raise exception using errcode='22023',message='printing_discovery_invalid';end if;
  k:=encode(sha256(convert_to(lower(n),'UTF8')),'hex');fp:=encode(sha256(convert_to(lower(n)||'|'||driver,'UTF8')),'hex');
  if k=any(seen) then raise exception using errcode='22023',message='printing_discovery_duplicate';end if;seen:=array_append(seen,k);
  insert into fb_print_private.queue_catalog(hotel_id,device_id,queue_key,queue_name,driver_name,fingerprint,observation,present,observed_at)
  values(d.hotel_id,d.id,k,n,driver,fp,state,true,at) on conflict(hotel_id,device_id,queue_key) do update set queue_name=excluded.queue_name,driver_name=excluded.driver_name,fingerprint=excluded.fingerprint,observation=excluded.observation,present=true,observed_at=at,revision=fb_print_private.queue_catalog.revision+case when fb_print_private.queue_catalog.fingerprint<>excluded.fingerprint or not fb_print_private.queue_catalog.present then 1 else 0 end;
 end loop;
 update fb_print_private.queue_catalog set present=false,observed_at=at,revision=revision+1 where hotel_id=d.hotel_id and device_id=d.id and present and not(queue_key=any(seen));
 update fb_print_private.devices set discovery_at=at,discovery_requested_at=null where hotel_id=d.hotel_id and id=d.id;
 return jsonb_build_object('device_id',d.id,'received',cardinality(seen),'server_time',at,'physical_ready',null);
end $$;

create function fb_print_private.preflight(h uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare items jsonb:='[]';r record;j record;blocked integer;warnings integer;begin
 items:=items||jsonb_build_array(jsonb_build_object('code','catalog','status',case when exists(select 1 from public.hotel_fb_menus where hotel_id=h and is_published) then 'PASS' else 'BLOCKER' end,'detail','Cardápio publicado'));
 items:=items||jsonb_build_array(jsonb_build_object('code','entitlements','status',case when public.is_hotel_module_enabled(h,'fb.menu') and public.is_hotel_module_enabled(h,'core.directory') then 'PASS' else 'BLOCKER' end,'detail','Módulos de catálogo e diretório'));
 items:=items||jsonb_build_array(jsonb_build_object('code','mode','status',case when exists(select 1 from fb_order_private.hotel_settings where hotel_id=h) then 'PASS' else 'BLOCKER' end,'detail','Modo operacional configurado'));
 items:=items||jsonb_build_array(jsonb_build_object('code','native_outlet','status',case when exists(select 1 from fb_order_private.outlet_settings where hotel_id=h and mode='native' and accepting and (pickup or room_delivery)) then 'PASS' else 'BLOCKER' end,'detail','Estabelecimento nativo e modalidades de atendimento'));
 for r in select s.id,s.name,rt.id route_id,ds.id destination_id,ds.active destination_active,dv.id device_id,dv.active device_active,dv.revoked_at,dv.last_seen_at,dv.software_version,dv.protocol_version,pr.id printer_id,pr.revision printer_revision,pr.active printer_active,pr.queue_key,pr.queue_fingerprint,pr.config,q.present,q.observed_at,q.fingerprint,q.observation
 from fb_order_private.sectors s
 left join fb_print_private.routes rt on rt.hotel_id=h and rt.sector_id=s.id and rt.active and rt.role='primary'
 left join fb_print_private.destinations ds on ds.hotel_id=h and ds.id=rt.destination_id
 left join fb_print_private.devices dv on dv.hotel_id=h and dv.id=ds.device_id
 left join fb_print_private.printers pr on pr.hotel_id=h and pr.destination_id=ds.id and pr.device_id=dv.id and pr.active
 left join fb_print_private.queue_catalog q on q.hotel_id=h and q.device_id=dv.id and q.queue_key=pr.queue_key
 where s.hotel_id=h and s.active and (exists(select 1 from fb_order_private.item_fulfilment f join fb_order_private.outlet_settings os on os.hotel_id=f.hotel_id and os.id=f.outlet_id where f.hotel_id=h and f.sector_id=s.id and os.mode='native' and os.accepting) or exists(select 1 from fb_order_private.outlet_settings os where os.hotel_id=h and os.default_sector_id=s.id and os.mode='native' and os.accepting)) loop
  items:=items||jsonb_build_array(jsonb_build_object('code','routing','sector',r.name,'status',case when r.route_id is not null and r.destination_active and r.printer_active then 'PASS' else 'BLOCKER' end,'detail','Setor, destino e impressora associados'));
  items:=items||jsonb_build_array(jsonb_build_object('code','bridge','sector',r.name,'status',case when r.device_active and r.revoked_at is null and r.last_seen_at>now()-interval '90 seconds' and r.protocol_version=1 and coalesce(r.software_version,'')~'^(c2-|c2-lab-|fixture-)1[.]([3-9]|[1-9][0-9]+)[.]' then 'PASS' else 'BLOCKER' end,'detail','Bridge pareada, versão compatível e heartbeat recente'));
  items:=items||jsonb_build_array(jsonb_build_object('code','queue','sector',r.name,'status',case when r.present and r.observed_at>now()-interval '3 minutes' and r.fingerprint=r.queue_fingerprint and r.observation='unknown' then 'PASS' else 'BLOCKER' end,'detail','Fila detectada, atual e sem falha técnica observada'));
  select pj.id into j from fb_print_private.jobs pj where pj.hotel_id=h and pj.kind='test' and pj.destination_id=r.destination_id and pj.state='submitted' and pj.created_at>now()-interval '7 days' and pj.routing_snapshot->'printer'->>'id'=r.printer_id::text and (pj.routing_snapshot->'printer'->>'revision')::int=r.printer_revision order by pj.created_at desc limit 1;
  items:=items||jsonb_build_array(jsonb_build_object('code','test','sector',r.name,'status',case when j.id is not null then 'PASS' else 'BLOCKER' end,'detail','Teste submetido nesta configuração (não comprova papel)'));
  items:=items||jsonb_build_array(jsonb_build_object('code','physical_verification','sector',r.name,'status',case when exists(select 1 from fb_print_private.physical_test_verifications v where v.hotel_id=h and v.job_id=j.id and v.printer_id=r.printer_id and v.printer_revision=r.printer_revision) then 'PASS' else 'WARNING' end,'detail','Teste físico verificado por operador'));
 end loop;
 if not exists(select 1 from jsonb_array_elements(items) i where i->>'code'='routing') then items:=items||jsonb_build_array(jsonb_build_object('code','sectors','status','BLOCKER','detail','Configure os setores necessários ao atendimento'));end if;
 select count(*) filter(where value->>'status'='BLOCKER'),count(*) filter(where value->>'status'='WARNING') into blocked,warnings from jsonb_array_elements(items);
 return jsonb_build_object('checks',items,'blockers',blocked,'warnings',warnings,'ready',blocked=0,'mode',case when coalesce((select enabled from fb_order_private.hotel_settings where hotel_id=h),false) then 'ordering' else 'catalog_only' end,'server_time',now());
end $$;

create function public.get_current_hotel_fb_commissioning() returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();begin perform fb_print_private.require_cap(h,'printing.configure');return fb_print_private.preflight(h)||jsonb_build_object('order_revision',coalesce((select revision from fb_order_private.hotel_settings where hotel_id=h),0),'override', (select jsonb_build_object('until',technical_override_until,'reason',technical_override_reason) from fb_print_private.settings where hotel_id=h),'tests',coalesce((select jsonb_agg(jsonb_build_object('job_id',x.id,'destination_id',x.destination_id,'created_at',x.created_at)) from (select * from fb_print_private.jobs where hotel_id=h and kind='test' and state='submitted' and created_at>now()-interval '7 days' order by created_at desc limit 50)x),'[]'),'queues',coalesce((select jsonb_agg(to_jsonb(q) order by device_id,queue_name) from fb_print_private.queue_catalog q where hotel_id=h),'[]'),'human_verifications',coalesce((select jsonb_agg(to_jsonb(v)) from fb_print_private.physical_test_verifications v where hotel_id=h),'[]'));end $$;

create function public.execute_current_hotel_fb_commissioning(p_operation text,p_body jsonb,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();b jsonb:=p_body;r jsonb;q fb_print_private.queue_catalog%rowtype;pr fb_print_private.printers%rowtype;j fb_print_private.jobs%rowtype;rev integer;begin
 perform fb_print_private.require_cap(h,'printing.configure');
 if b is null or jsonb_typeof(b)<>'object' or octet_length(b::text)>4096 or p_key is null then raise exception using errcode='22023',message='printing_command_invalid';end if;
 r:=fb_print_private.command(h,auth.uid(),'commission_'||p_operation,p_key,b);if r is not null then return r;end if;
 if p_operation='refresh' then
  if (b-array['device_id'])<>'{}' then raise exception using errcode='22023',message='printing_command_invalid';end if;
  update fb_print_private.devices set discovery_requested_at=clock_timestamp() where hotel_id=h and id=(b->>'device_id')::uuid and active and revoked_at is null;
  if not found then raise exception using errcode='42501',message='printing_device_forbidden';end if;r:=jsonb_build_object('requested',true);
 elsif p_operation='select_queue' then
  if (b-array['printer_id','revision','name','device_id','destination_id','queue_key','queue_revision'])<>'{}' then raise exception using errcode='22023',message='printing_command_invalid';end if;
  select * into q from fb_print_private.queue_catalog where hotel_id=h and device_id=(b->>'device_id')::uuid and queue_key=b->>'queue_key' and present and observed_at>clock_timestamp()-interval '3 minutes';
  if q.queue_key is null or q.revision is distinct from (b->>'queue_revision')::int then raise exception using errcode='PT409',message='printing_discovery_stale';end if;
  r:=public.save_current_hotel_fb_print_config('printer',(b->>'printer_id')::uuid,(b->>'revision')::int,jsonb_build_object('name',b->>'name','device_id',b->>'device_id','destination_id',b->>'destination_id','adapter','windows_spooler','active',true,'config',jsonb_build_object('queue_name',q.queue_name)));
  update fb_print_private.printers set queue_key=q.queue_key,queue_fingerprint=q.fingerprint where hotel_id=h and id=(r->>'id')::uuid;
 elsif p_operation='verify_test' then
  if (b-array['job_id'])<>'{}' then raise exception using errcode='22023',message='printing_command_invalid';end if;
  select * into j from fb_print_private.jobs where hotel_id=h and id=(b->>'job_id')::uuid and kind='test' and state='submitted' and retain_until>clock_timestamp();
  if j.id is null then raise exception using errcode='22023',message='printing_test_not_submitted';end if;
  insert into fb_print_private.physical_test_verifications(hotel_id,job_id,printer_id,printer_revision,verified_by) values(h,j.id,(j.routing_snapshot->'printer'->>'id')::uuid,(j.routing_snapshot->'printer'->>'revision')::int,auth.uid()) on conflict do nothing;
  r:=jsonb_build_object('human_verified',true,'job_id',j.id,'physical_state_unchanged',true);
 elsif p_operation='mode' then
  perform fb_order_private.require_cap(h,'orders.configure');
  if (b-array['mode','revision'])<>'{}' or (b->>'mode' is null or b->>'mode' not in('catalog_only','ordering')) then raise exception using errcode='22023',message='printing_mode_invalid';end if;
  if b->>'mode'='ordering' and not (fb_print_private.preflight(h)->>'ready')::boolean then raise exception using errcode='PT409',message='printing_preflight_blockers';end if;
  select revision into rev from fb_print_private.settings where hotel_id=h;
  if rev is not null then perform public.activate_current_hotel_fb_printing(b->>'mode'='ordering',rev);elsif b->>'mode'='ordering' then raise exception using errcode='22023',message='printing_settings_required';end if;
  r:=public.save_current_hotel_fb_order_config('hotel',null,(b->>'revision')::int,jsonb_build_object('enabled',b->>'mode'='ordering'));
 elsif p_operation='technical_override' then
  perform fb_order_private.require_cap(h,'orders.supervise');
  if (b-array['reason','enabled','revision'])<>'{}' or (b->>'reason' is null or b->>'reason' not in('isolated_contract_validation','supervised_maintenance','urgent_operational_recovery')) then raise exception using errcode='22023',message='printing_override_reason_required';end if;
  r:=fb_print_private.activate_raw((b->>'enabled')::boolean,(b->>'revision')::int);
  update fb_print_private.settings set technical_override_until=clock_timestamp()+interval '2 hours',technical_override_reason=b->>'reason' where hotel_id=h;
 else raise exception using errcode='22023',message='printing_operation_invalid';end if;
 perform fb_print_private.audit(h,'printing.commission_'||p_operation,h);
 return fb_print_private.remember(h,auth.uid(),'commission_'||p_operation,p_key,b,r);
end $$;

-- Remaining wrappers are copied from the preserved candidate with narrow guarded changes.

create or replace function fb_print_private.activate_raw(p_enabled boolean,p_expected_revision integer) returns jsonb
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

create or replace function fb_print_private.authorize_raw(p_credential_id uuid,p_digest text,p_protocol_version integer,p_job_id uuid,p_fence bigint,p_expected_revision integer,p_snapshot_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$declare d fb_print_private.devices%rowtype;j fb_print_private.jobs%rowtype;ds fb_print_private.destinations%rowtype;pr fb_print_private.printers%rowtype;private jsonb;a uuid;begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);j:=fb_print_private.owned(d,p_job_id,p_fence);
 if not fb_print_private.equal_digest(j.snapshot_hash,p_snapshot_hash) then raise exception using errcode='PT409',message='printing_payload_mismatch';end if;
 if j.state not in('leased','dispatching') or j.receipt_at is null or j.lease_until<=clock_timestamp() or j.expires_at<=clock_timestamp() then raise exception using errcode='PT410',message='printing_dispatch_not_eligible';end if;
 if j.state='leased' and j.revision is distinct from p_expected_revision then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
 if j.kind<>'test' and not coalesce((select enabled from fb_print_private.settings where hotel_id=d.hotel_id),false) then raise exception using errcode='42501',message='printing_disabled';end if;
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
 where jb.hotel_id=d.hotel_id and (jb.kind='test' or coalesce((select enabled from fb_print_private.settings where hotel_id=d.hotel_id),false)) and ((jb.kind<>'cancellation' and coalesce(jb.snapshot->>'document_kind','')<>'cancellation') or coalesce(d.software_version,'')~'^(c2-|c2-lab-|fixture-)1[.]([2-9]|[1-9][0-9]+)[.][0-9]+([+_-][A-Za-z0-9._-]+)?$') and ds.device_id=d.id and ds.active and jb.available_at<=clock_timestamp() and jb.expires_at>clock_timestamp() and jb.retain_until>clock_timestamp()
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

create or replace function public.heartbeat_fb_print_device(p_credential_id uuid,p_digest text,p_protocol_version integer,p_software_version text,p_observed_state text default 'online') returns jsonb
language plpgsql security definer set search_path='' as $$declare d fb_print_private.devices%rowtype;begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);
 if p_software_version is null or p_software_version!~'^[0-9A-Za-z.+_-]{1,40}$' or p_observed_state not in('online','unknown','degraded') or p_observed_state is null then raise exception using errcode='22023',message='printing_heartbeat_invalid';end if;
 update fb_print_private.devices set last_seen_at=clock_timestamp(),software_version=p_software_version,protocol_version=p_protocol_version,observed_state=p_observed_state where id=d.id;
 return jsonb_build_object('device_id',d.id,'server_time',clock_timestamp(),'compatible',true,'printer_ready',null,'discovery_requested',d.discovery_requested_at is not null);
end $$;

do $copy$ declare definition text;begin
 definition:=pg_get_functiondef('public.save_current_hotel_fb_order_config(text,uuid,integer,jsonb)'::regprocedure);
 definition:=replace(definition,'FUNCTION public.save_current_hotel_fb_order_config(', 'FUNCTION fb_order_private.save_config_before_commissioning(');
 execute definition;
end $copy$;

create or replace function public.activate_current_hotel_fb_printing(p_enabled boolean,p_expected_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();r jsonb;begin perform fb_print_private.require_cap(h,'printing.configure');if p_enabled and not (fb_print_private.preflight(h)->>'ready')::boolean then raise exception using errcode='PT409',message='printing_preflight_blockers';end if;r:=fb_print_private.activate_raw(p_enabled,p_expected_revision);update fb_print_private.settings set technical_override_until=null,technical_override_reason=null where hotel_id=h;return r;end $$;
create or replace function public.authorize_fb_print_dispatch(p_credential_id uuid,p_digest text,p_protocol_version integer,p_job_id uuid,p_fence bigint,p_expected_revision integer,p_snapshot_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d fb_print_private.devices%rowtype;j fb_print_private.jobs%rowtype;p fb_print_private.printers%rowtype;begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);j:=fb_print_private.owned(d,p_job_id,p_fence);
 select * into p from fb_print_private.printers where hotel_id=d.hotel_id and id=(j.routing_snapshot->'printer'->>'id')::uuid;
 if p.queue_key is null then
  if not exists(select 1 from fb_print_private.settings where hotel_id=d.hotel_id and technical_override_until>clock_timestamp()) then raise exception using errcode='PT409',message='printing_queue_not_discovered';end if;
 elsif not exists(select 1 from fb_print_private.queue_catalog q where q.hotel_id=d.hotel_id and q.device_id=d.id and q.queue_key=p.queue_key and q.fingerprint=p.queue_fingerprint and lower(q.queue_name)=lower(p.config->>'queue_name') and q.present and q.observed_at>clock_timestamp()-interval '3 minutes' and q.observation='unknown') then raise exception using errcode='PT409',message='printing_discovered_queue_changed';end if;
 return fb_print_private.authorize_raw(p_credential_id,p_digest,p_protocol_version,p_job_id,p_fence,p_expected_revision,p_snapshot_hash);
end $$;
create or replace function public.save_current_hotel_fb_order_config(p_kind text,p_id uuid,p_expected_revision integer,p_values jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_order_private.actor();begin
 if p_kind='hotel' and coalesce((p_values->>'enabled')::boolean,false) and not coalesce((select enabled from fb_order_private.hotel_settings where hotel_id=h),false) and not coalesce((fb_print_private.preflight(h)->>'ready')::boolean,false) and not exists(select 1 from fb_print_private.settings where hotel_id=h and technical_override_until>clock_timestamp()) then raise exception using errcode='PT409',message='printing_preflight_blockers';end if;
 return fb_order_private.save_config_before_commissioning(p_kind,p_id,p_expected_revision,p_values);
end $$;
revoke all on function fb_print_private.activate_raw(boolean,integer),fb_print_private.authorize_raw(uuid,text,integer,uuid,bigint,integer,text),fb_print_private.preflight(uuid),fb_order_private.save_config_before_commissioning(text,uuid,integer,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.report_fb_print_queues(uuid,text,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.report_fb_print_queues(uuid,text,integer,jsonb) to service_role;
revoke all on function public.get_current_hotel_fb_commissioning(),public.execute_current_hotel_fb_commissioning(text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_current_hotel_fb_commissioning(),public.execute_current_hotel_fb_commissioning(text,jsonb,uuid) to authenticated;
-- A commissioning TESTE must be creatable before normal order printing activation.
-- Preserve the current C1/hotfix definition, changing only that single gate.
do $allow_commissioning_test$ declare definition text;begin
 select pg_get_functiondef('public.create_current_hotel_fb_print_job(text,uuid,uuid,uuid,text,uuid)'::regprocedure) into definition;
 if position('cfg.hotel_id is null or not cfg.enabled or ds.id is null' in definition)=0 then raise exception 'commissioning_test_definition_changed';end if;
 definition:=replace(definition,'cfg.hotel_id is null or not cfg.enabled or ds.id is null','cfg.hotel_id is null or (not cfg.enabled and p_kind<>''test'') or ds.id is null');
 execute definition;
end $allow_commissioning_test$;
-- Catalog-only keeps A's published catalogue and removes the native cart/checkout
-- projection. Native availability/hour closures while ordering is ON are unchanged.
do $copy_offer$ declare definition text;begin
 select pg_get_functiondef('public.get_fb_order_offer(text,text)'::regprocedure) into definition;
 definition:=replace(definition,'FUNCTION public.get_fb_order_offer(','FUNCTION fb_order_private.offer_before_commissioning(');
 execute definition;
end $copy_offer$;
create or replace function public.get_fb_order_offer(p_hotel_slug text,p_language text default 'pt') returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid;begin
 perform fb_order_private.service_only();
 if p_language is null or p_language not in('pt','en','es') then raise exception using errcode='22023',message='orders_language_invalid';end if;
 select id into h from public.hotels where slug=p_hotel_slug and platform_status='active';
 if h is null or not fb_order_private.native_hotel(h) then return jsonb_build_object('outlets','[]'::jsonb);end if;
 return fb_order_private.offer_before_commissioning(p_hotel_slug,p_language);
end $$;
revoke all on function fb_order_private.offer_before_commissioning(text,text) from public,anon,authenticated,service_role;
revoke all on function public.get_fb_order_offer(text,text) from public,anon,authenticated;
grant execute on function public.get_fb_order_offer(text,text) to service_role;
notify pgrst,'reload schema';
commit;
