-- C1 Cloud only. No devices, credentials, enabled hotels, schedules or physical I/O seeded.
begin;
set local lock_timeout='5s';
create schema fb_print_private;
revoke all on schema fb_print_private from public,anon,authenticated,service_role;

create table fb_print_private.settings(
 hotel_id uuid primary key references public.hotels(id) on delete restrict,
 enabled boolean not null default false,ticket_minutes integer not null default 15 check(ticket_minutes between 1 and 120),
 allow_room boolean not null default true,allow_notes boolean not null default true,allow_name boolean not null default false,
 fan_out boolean not null default false,min_protocol integer not null default 1 check(min_protocol=1),
 activation_id uuid,activated_at timestamptz,revision integer not null default 1 check(revision>0),updated_at timestamptz not null default clock_timestamp()
);
create table fb_print_private.grants(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete cascade,capability text not null check(capability in('printing.configure','printing.test','printing.reprint')),
 sector_id uuid,active boolean not null default true,revision integer not null default 1,
 foreign key(hotel_id,sector_id) references fb_order_private.sectors(hotel_id,id) on delete restrict,
 unique nulls not distinct(hotel_id,user_id,capability,sector_id),check(capability<>'printing.configure' or sector_id is null)
);
create index c1_grants_user on fb_print_private.grants(hotel_id,user_id,capability) where active;
create table fb_print_private.devices(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 120),active boolean not null default true,revoked_at timestamptz,
 software_version text,protocol_version integer,last_seen_at timestamptz,observed_state text check(observed_state in('unknown','online','degraded')),
 revision integer not null default 1,created_at timestamptz not null default clock_timestamp(),unique(hotel_id,id)
);
create table fb_print_private.credentials(
 id uuid primary key,hotel_id uuid not null,device_id uuid not null,digest text not null check(digest~'^[0-9a-f]{64}$'),
 issued_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,revoked_at timestamptz,
 foreign key(hotel_id,device_id) references fb_print_private.devices(hotel_id,id) on delete restrict,
 check(expires_at>issued_at),unique(hotel_id,id)
);
create index c1_credentials_device on fb_print_private.credentials(hotel_id,device_id);
create table fb_print_private.pairings(
 id uuid primary key,hotel_id uuid not null,device_id uuid not null,digest text not null check(digest~'^[0-9a-f]{64}$'),
 issued_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',consumed_at timestamptz,
 foreign key(hotel_id,device_id) references fb_print_private.devices(hotel_id,id) on delete restrict
);
create index c1_pairings_device on fb_print_private.pairings(hotel_id,device_id);
create table fb_print_private.destinations(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 120),active boolean not null default true,
 device_id uuid not null,backup_device_id uuid,priority integer not null default 0 check(priority between 0 and 1000),
 allow_room boolean not null default true,allow_notes boolean not null default true,allow_name boolean not null default false,
 revision integer not null default 1,unique(hotel_id,id),
 foreign key(hotel_id,device_id) references fb_print_private.devices(hotel_id,id) on delete restrict,
 foreign key(hotel_id,backup_device_id) references fb_print_private.devices(hotel_id,id) on delete restrict,
 check(backup_device_id is null or backup_device_id<>device_id)
);
create index c1_dest_device on fb_print_private.destinations(hotel_id,device_id);
create table fb_print_private.printers(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,device_id uuid not null,destination_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 120),adapter text not null default 'windows_spooler' check(adapter in('windows_spooler','raw_tcp','escpos')),
 config jsonb not null default '{}',active boolean not null default true,priority integer not null default 0 check(priority between 0 and 1000),
 observed_state text not null default 'unknown' check(observed_state in('unknown','ready','offline','paper_out','error')),
 observed_at timestamptz,revision integer not null default 1,unique(hotel_id,id),
 foreign key(hotel_id,device_id) references fb_print_private.devices(hotel_id,id) on delete restrict,
 foreign key(hotel_id,destination_id) references fb_print_private.destinations(hotel_id,id) on delete restrict,
 check(jsonb_typeof(config)='object' and octet_length(config::text)<=1024 and (config-array['queue_name','host','port','driver','profile'])='{}')
);
create index c1_printer_destination on fb_print_private.printers(hotel_id,destination_id,device_id);
create table fb_print_private.routes(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,sector_id uuid not null,destination_id uuid not null,
 role text not null default 'primary' check(role in('primary','backup')),active boolean not null default true,
 copy_number integer not null default 1 check(copy_number between 1 and 5),revision integer not null default 1,
 updated_at timestamptz not null default clock_timestamp(),unique(hotel_id,id),unique(hotel_id,sector_id,destination_id,copy_number),
 foreign key(hotel_id,sector_id) references fb_order_private.sectors(hotel_id,id) on delete restrict,
 foreign key(hotel_id,destination_id) references fb_print_private.destinations(hotel_id,id) on delete restrict
);
create index c1_routes_sector on fb_print_private.routes(hotel_id,sector_id) where active;
-- Logical B references deliberately have no restrictive FK: B's authorized retention remains independent.
create table fb_print_private.processing(
 hotel_id uuid not null references public.hotels(id) on delete restrict,source_event_id uuid not null,
 group_id uuid,activation_id uuid,status text not null check(status in('baseline','blocked','materialized','expired')),
 code text not null check(code in('before_activation','no_route','destination_unavailable','fan_out_disabled','materialized','ticket_expired','source_unavailable')),
 contract_version integer not null default 1,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 retain_until timestamptz not null default clock_timestamp()+interval '180 days',primary key(hotel_id,source_event_id)
);
create table fb_print_private.jobs(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null references public.hotels(id) on delete restrict,
 kind text not null check(kind in('order','test','reprint')),source_event_id uuid,order_id uuid,group_id uuid,sector_id uuid,
 destination_id uuid not null,copy_number integer not null default 1 check(copy_number between 1 and 5),original_job_id uuid,
 actor_user_id uuid,reason_code text,duplicate_risk boolean not null default false,
 state text not null default 'queued' check(state in('queued','leased','dispatching','submitted','confirmed','retry_wait','blocked','ambiguous','expired','cancelled')),
 code text,snapshot jsonb not null,snapshot_hash text not null check(snapshot_hash~'^[0-9a-f]{64}$'),routing_snapshot jsonb not null,
 protocol_version integer not null default 1 check(protocol_version=1),payload_version integer not null default 1 check(payload_version=1),renderer_version integer not null default 1 check(renderer_version=1),
 fence bigint not null default 0,owner_device_id uuid,lease_until timestamptz,receipt_at timestamptz,dispatch_at timestamptz,
 revision integer not null default 1,created_at timestamptz not null default clock_timestamp(),available_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,retain_until timestamptz not null default clock_timestamp()+interval '180 days',
 unique(hotel_id,id),foreign key(hotel_id,destination_id) references fb_print_private.destinations(hotel_id,id) on delete restrict,
 foreign key(hotel_id,owner_device_id) references fb_print_private.devices(hotel_id,id) on delete restrict,
 check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=1048576),
 check((kind='test' and order_id is null and source_event_id is null and original_job_id is null) or (kind='order' and order_id is not null and group_id is not null and source_event_id is not null and original_job_id is null) or (kind='reprint' and original_job_id is not null and actor_user_id is not null and reason_code is not null))
);
create unique index c1_job_event_original on fb_print_private.jobs(hotel_id,source_event_id,destination_id,copy_number) where kind='order';
create unique index c1_job_group_original on fb_print_private.jobs(hotel_id,group_id,destination_id,copy_number) where kind='order';
create index c1_job_claim on fb_print_private.jobs(hotel_id,destination_id,available_at,created_at,id) where state in('queued','retry_wait','leased');
create index c1_job_expiry on fb_print_private.jobs(expires_at) where state in('queued','leased','retry_wait','blocked');
create index c1_job_retention on fb_print_private.jobs(retain_until);
create index c1_job_dispatched_lease on fb_print_private.jobs(lease_until,id) where state='dispatching';
create table fb_print_private.attempts(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,job_id uuid not null,device_id uuid not null,fence bigint not null,
 created_at timestamptz not null default clock_timestamp(),unique(hotel_id,job_id,fence),unique(hotel_id,id),
 foreign key(hotel_id,job_id) references fb_print_private.jobs(hotel_id,id) on delete cascade,
 foreign key(hotel_id,device_id) references fb_print_private.devices(hotel_id,id) on delete restrict
);
create table fb_print_private.events(
 id uuid primary key default gen_random_uuid(),hotel_id uuid not null,job_id uuid,attempt_id uuid,device_id uuid,
 actor_kind text not null check(actor_kind in('device','staff','system')),actor_user_id uuid,
 action text not null check(action in('created','claimed','received','dispatch_authorized','submitted','pre_send_failed','ambiguous','blocked','reprinted','test_created','expired','cancelled','device_revoked')),
 state text,code text,created_at timestamptz not null default clock_timestamp(),
 foreign key(hotel_id,job_id) references fb_print_private.jobs(hotel_id,id) on delete cascade,
 foreign key(hotel_id,attempt_id) references fb_print_private.attempts(hotel_id,id) on delete cascade,
 foreign key(hotel_id,device_id) references fb_print_private.devices(hotel_id,id) on delete restrict
);
create unique index c1_event_effect on fb_print_private.events(hotel_id,attempt_id,action) where attempt_id is not null and action<>'pre_send_failed';
create index c1_events_job on fb_print_private.events(hotel_id,job_id,created_at,id);
create table fb_print_private.commands(
 hotel_id uuid not null,actor_id uuid not null,operation text not null,key uuid not null,fingerprint text not null,result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(hotel_id,actor_id,operation,key)
);
create table fb_print_private.http_buckets(
 action text not null,digest text not null check(digest~'^[0-9a-f]{64}$'),window_at timestamptz not null,used integer not null,
 primary key(action,digest,window_at)
);
create index c1_http_expiry on fb_print_private.http_buckets(window_at);
create index c1_accepted_source on fb_order_private.order_events(hotel_id,created_at,id) where action='orders.accepted';

create function fb_print_private.equal_digest(a text,b text) returns boolean language plpgsql immutable set search_path='' as $$
declare x bytea;y bytea;n integer:=0;i integer;begin
 if a is null or b is null or a!~'^[0-9a-f]{64}$' or b!~'^[0-9a-f]{64}$' then return false;end if;
 x:=decode(a,'hex');y:=decode(b,'hex');for i in 0..31 loop n:=n|(get_byte(x,i)#get_byte(y,i));end loop;return n=0;
end $$;

create function public.create_current_hotel_fb_print_pairing(p_device_id uuid,p_pairing_id uuid,p_pairing_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$declare h uuid:=fb_print_private.actor();r fb_print_private.pairings%rowtype;begin
 perform fb_print_private.require_cap(h,'printing.configure');
 if p_pairing_id is null or p_pairing_digest is null or p_pairing_digest!~'^[0-9a-f]{64}$' then raise exception using errcode='22023',message='printing_digest_invalid';end if;
 if not exists(select 1 from fb_print_private.devices where hotel_id=h and id=p_device_id and active and revoked_at is null) then raise exception using errcode='42501',message='printing_device_forbidden';end if;
 if (select count(*) from fb_print_private.pairings where hotel_id=h and device_id=p_device_id and created_at>clock_timestamp()-interval '1 minute')>=5 then raise exception using errcode='PT429',message='printing_pairing_limited';end if;
 insert into fb_print_private.pairings(id,hotel_id,device_id,digest,issued_by) values(p_pairing_id,h,p_device_id,p_pairing_digest,auth.uid()) returning * into r;
 perform fb_print_private.audit(h,'printing.pairing_created',r.id);return jsonb_build_object('pairing_id',r.id,'device_id',p_device_id,'expires_at',r.expires_at);
end $$;
create function public.exchange_fb_print_pairing(p_pairing_id uuid,p_pairing_digest text,p_device_id uuid,p_credential_id uuid,p_credential_digest text,p_protocol_version integer,p_software_version text) returns jsonb
language plpgsql security definer set search_path='' as $$declare r fb_print_private.pairings%rowtype;d fb_print_private.devices%rowtype;k fb_print_private.credentials%rowtype;begin
 perform fb_order_private.service_only();select * into r from fb_print_private.pairings where id=p_pairing_id;
 if r.id is null then raise exception using errcode='42501',message='printing_pairing_invalid';end if;
 perform 1 from public.hotels where id=r.hotel_id for update;
 select * into r from fb_print_private.pairings where id=p_pairing_id for update;
 select * into d from fb_print_private.devices where hotel_id=r.hotel_id and id=r.device_id;
 if not fb_print_private.equal_digest(r.digest,p_pairing_digest) or r.device_id is distinct from p_device_id or r.consumed_at is not null or r.expires_at<=clock_timestamp() or not d.active or d.revoked_at is not null then raise exception using errcode='42501',message='printing_pairing_invalid';end if;
 if p_protocol_version is distinct from 1 or p_software_version is null or p_software_version!~'^[0-9A-Za-z.+_-]{1,40}$' or p_credential_id is null or p_credential_digest is null or p_credential_digest!~'^[0-9a-f]{64}$' then raise exception using errcode='22023',message='printing_exchange_invalid';end if;
 update fb_print_private.pairings set consumed_at=clock_timestamp() where id=r.id;
 update fb_print_private.credentials set revoked_at=clock_timestamp() where hotel_id=r.hotel_id and device_id=r.device_id and revoked_at is null;
 insert into fb_print_private.credentials(id,hotel_id,device_id,digest,expires_at) values(p_credential_id,r.hotel_id,r.device_id,p_credential_digest,clock_timestamp()+interval '90 days') returning * into k;
 update fb_print_private.devices set software_version=p_software_version,protocol_version=1,last_seen_at=clock_timestamp(),observed_state='online' where id=d.id;
 return jsonb_build_object('device_id',d.id,'credential_id',k.id,'expires_at',k.expires_at,'protocol_version',1);
end $$;
create function public.rotate_current_hotel_fb_print_credential(p_device_id uuid,p_credential_id uuid,p_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$declare h uuid:=fb_print_private.actor();k fb_print_private.credentials%rowtype;begin
 perform fb_print_private.require_cap(h,'printing.configure');
 if p_credential_id is null or p_digest is null or p_digest!~'^[0-9a-f]{64}$' then raise exception using errcode='22023',message='printing_digest_invalid';end if;
 if not exists(select 1 from fb_print_private.devices where hotel_id=h and id=p_device_id and active and revoked_at is null) then raise exception using errcode='42501',message='printing_device_forbidden';end if;
 update fb_print_private.credentials set revoked_at=clock_timestamp() where hotel_id=h and device_id=p_device_id and revoked_at is null;
 insert into fb_print_private.credentials(id,hotel_id,device_id,digest,expires_at) values(p_credential_id,h,p_device_id,p_digest,clock_timestamp()+interval '90 days') returning * into k;
 perform fb_print_private.audit(h,'printing.credential_rotated',k.id);return jsonb_build_object('credential_id',k.id,'device_id',p_device_id,'expires_at',k.expires_at);
end $$;
create function public.revoke_current_hotel_fb_print_device(p_device_id uuid,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$declare h uuid:=fb_print_private.actor();d fb_print_private.devices%rowtype;begin
 perform fb_print_private.require_cap(h,'printing.configure');select * into d from fb_print_private.devices where hotel_id=h and id=p_device_id;
 if d.id is null then raise exception using errcode='42501',message='printing_device_forbidden';end if;
 if d.revision is distinct from p_expected_revision then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
 update fb_print_private.devices set active=false,revoked_at=clock_timestamp(),revision=revision+1 where id=d.id returning * into d;
 update fb_print_private.credentials set revoked_at=clock_timestamp() where hotel_id=h and device_id=d.id and revoked_at is null;
 update fb_print_private.jobs set state='ambiguous',code='device_revoked_after_dispatch',revision=revision+1 where hotel_id=h and owner_device_id=d.id and state='dispatching';
 insert into fb_print_private.events(hotel_id,device_id,actor_kind,actor_user_id,action,code) values(h,d.id,'staff',auth.uid(),'device_revoked','revoked');
 perform fb_print_private.audit(h,'printing.device_revoked',d.id);return jsonb_build_object('device_id',d.id,'revision',d.revision,'revoked',true);
end $$;

create function fb_print_private.commercial(h uuid,o uuid,g uuid,e uuid) returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb;begin
 select jsonb_build_object('payload_version',1,'renderer_version',1,'reference',upper(left(t.id::text,8)),'order_id',t.id,'group_id',gr.id,'sector_id',gr.sector_id,'fulfilment',t.fulfilment,'timezone',t.timezone,'created_at',t.created_at,
 'sector_name',gr.sector_name,'source_event_id',e,'lines',coalesce((select jsonb_agg(jsonb_build_object(
 'line_id',l.id,'parent_id',l.parent_id,'kind',l.kind,'name',l.name,'quantity',l.quantity,
 'combo_context',case when l.parent_id is not null then (select p.name from fb_order_private.order_lines p where p.hotel_id=h and p.order_id=o and p.id=l.parent_id) end,
 'options',coalesce((select jsonb_agg(jsonb_build_object('kind',op.kind,'name',op.name,'group_name',op.group_name,'quantity',op.quantity) order by op.id) from fb_order_private.order_line_options op where op.hotel_id=h and op.order_id=o and op.line_id=l.id),'[]')) order by l.position)
 from fb_order_private.order_lines l where l.hotel_id=h and l.order_id=o and l.group_id=g),'[]')) into result
 from fb_order_private.orders t join fb_order_private.order_groups gr on gr.hotel_id=t.hotel_id and gr.order_id=t.id and gr.id=g
 where t.hotel_id=h and t.id=o and t.retain_until>clock_timestamp();
 return result;
end $$;
create function fb_print_private.reconcile(h uuid,batch integer) returns jsonb language plpgsql set search_path='' as $$
declare cfg fb_print_private.settings%rowtype;e record;r record;payload jsonb;count_routes integer;n integer:=0;blocked integer:=0;expired integer:=0;begin
 if batch is null or batch not between 1 and 100 then raise exception using errcode='22023',message='printing_batch_invalid';end if;
 select * into cfg from fb_print_private.settings where hotel_id=h;
 if cfg.hotel_id is null or not cfg.enabled then return jsonb_build_object('materialized',0,'blocked',0,'expired',0,'enabled',false);end if;
 for e in select ev.* from fb_order_private.order_events ev left join fb_print_private.processing p on p.hotel_id=ev.hotel_id and p.source_event_id=ev.id
 where ev.hotel_id=h and ev.action='orders.accepted' and ev.group_id is not null and (p.source_event_id is null or p.status='blocked') order by coalesce(p.updated_at,ev.created_at),ev.created_at,ev.id limit batch loop
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
  payload:=fb_print_private.commercial(h,e.order_id,e.group_id,e.id);
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
create function public.reconcile_current_hotel_fb_printing(p_batch integer default 50) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();begin perform fb_print_private.require_cap(h,'printing.configure');return fb_print_private.reconcile(h,p_batch);end $$;
create function fb_print_private.actor() returns uuid language plpgsql security definer set search_path='' as $$
begin return fb_order_private.drain_actor();end $$;
create function fb_print_private.can(h uuid,c text,s uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select fb_order_private.operational_role(h) and (c<>'printing.configure' or public.has_active_hotel_role(h,'editor')) and exists(
 select 1 from fb_print_private.grants where hotel_id=h and user_id=auth.uid() and active and capability=c and (sector_id is null or sector_id=s));
$$;
create function fb_print_private.require_cap(h uuid,c text,s uuid default null) returns void language plpgsql set search_path='' as $$begin
 if not fb_print_private.can(h,c,s) then raise exception using errcode='42501',message='printing_forbidden';end if;
end $$;
create function fb_print_private.audit(h uuid,c text,id uuid) returns void language plpgsql set search_path='' as $$begin
 perform public.record_admin_audit_event(auth.uid(),h,c,'fb_printing',id,jsonb_build_object(
  'printing_revision',(select revision from fb_print_private.settings where hotel_id=h),
  'name_enabled',coalesce((select allow_name from fb_print_private.settings where hotel_id=h),false)),null);
end $$;
create function fb_print_private.command(h uuid,a uuid,op text,k uuid,v jsonb) returns jsonb language plpgsql set search_path='' as $$
declare r fb_print_private.commands%rowtype;begin
 if k is null then raise exception using errcode='22023',message='printing_key_required';end if;
 select * into r from fb_print_private.commands where hotel_id=h and actor_id=a and operation=op and key=k;
 if found and r.fingerprint<>encode(sha256(convert_to(v::text,'UTF8')),'hex') then raise exception using errcode='PT409',message='printing_intent_conflict';end if;
 return r.result;
end $$;
create function fb_print_private.remember(h uuid,a uuid,op text,k uuid,v jsonb,r jsonb) returns jsonb language plpgsql set search_path='' as $$begin
 -- Dedup retains technical proof only; commercial/private payloads never outlive their job here.
 insert into fb_print_private.commands(hotel_id,actor_id,operation,key,fingerprint,result) values(h,a,op,k,encode(sha256(convert_to(v::text,'UTF8')),'hex'),r-array['snapshot','snapshot_canonical','routing','private']);return r;
end $$;
create function fb_print_private.machine(c uuid,d text,p integer) returns fb_print_private.devices language plpgsql security definer set search_path='' as $$
declare k fb_print_private.credentials%rowtype;v fb_print_private.devices%rowtype;begin
 perform fb_order_private.service_only();select * into k from fb_print_private.credentials where id=c;
 if k.id is null then raise exception using errcode='42501',message='printing_credential_invalid';end if;
 perform 1 from public.hotels where id=k.hotel_id for update;
 select * into k from fb_print_private.credentials where id=c;
 select * into v from fb_print_private.devices where hotel_id=k.hotel_id and id=k.device_id;
 if not fb_print_private.equal_digest(k.digest,d) or k.revoked_at is not null or k.expires_at<=clock_timestamp() or not v.active or v.revoked_at is not null then raise exception using errcode='42501',message='printing_credential_invalid';end if;
 if p is distinct from 1 then raise exception using errcode='PT409',message='printing_incompatible_version';end if;
 return v;
end $$;

create function public.grant_current_hotel_fb_print_capability(p_user_id uuid,p_capability text,p_sector_id uuid,p_active boolean,p_expected_revision integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$declare h uuid:=fb_print_private.actor();u public.profiles%rowtype;r fb_print_private.grants%rowtype;begin
 if not public.has_active_hotel_role(h,'administrador') then raise exception using errcode='42501',message='printing_admin_required';end if;
 if p_capability not in('printing.configure','printing.test','printing.reprint') or p_active is null or p_expected_revision is null then raise exception using errcode='22023',message='printing_input_invalid';end if;
 select * into u from public.profiles where hotel_id=h and id=p_user_id and is_active;
 if u.id is null or lower(btrim(u.role)) not in('operador','editor','administrador','admin','owner') or (p_capability='printing.configure' and lower(btrim(u.role)) not in('editor','administrador','admin','owner')) then raise exception using errcode='42501',message='printing_grant_role_invalid';end if;
 select * into r from fb_print_private.grants where hotel_id=h and user_id=p_user_id and capability=p_capability and sector_id is not distinct from p_sector_id;
 if coalesce(r.revision,0)<>p_expected_revision then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
 if r.id is null then insert into fb_print_private.grants(hotel_id,user_id,capability,sector_id,active) values(h,p_user_id,p_capability,p_sector_id,p_active) returning * into r;
 else update fb_print_private.grants set active=p_active,revision=revision+1 where id=r.id returning * into r;end if;
 perform fb_print_private.audit(h,'printing.grant_changed',r.id);return to_jsonb(r);
end $$;

create function public.save_current_hotel_fb_print_config(p_kind text,p_id uuid,p_expected_revision integer,p_values jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();tbl text;allowed text[];prev jsonb;candidate jsonb;entity uuid;k text;cols text;r jsonb;begin
 perform fb_print_private.require_cap(h,'printing.configure');
 case p_kind
 when 'settings' then tbl:='settings';allowed:=array['ticket_minutes','allow_room','allow_notes','allow_name','fan_out'];
 when 'device' then tbl:='devices';allowed:=array['name','active'];
 when 'destination' then tbl:='destinations';allowed:=array['name','active','device_id','backup_device_id','priority','allow_room','allow_notes','allow_name'];
 when 'printer' then tbl:='printers';allowed:=array['name','device_id','destination_id','adapter','config','active','priority'];
 when 'route' then tbl:='routes';allowed:=array['sector_id','destination_id','role','active','copy_number'];
 else raise exception using errcode='22023',message='printing_kind_invalid';end case;
 if p_values is null or jsonb_typeof(p_values)<>'object' or p_values='{}' or (p_values-allowed)<>'{}' or octet_length(p_values::text)>2048 or p_expected_revision is null then raise exception using errcode='22023',message='printing_input_invalid';end if;
 if p_kind='settings' then
  select to_jsonb(s) into prev from fb_print_private.settings s where hotel_id=h;
  if prev is null then
   if p_expected_revision<>0 then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
   insert into fb_print_private.settings(hotel_id) values(h) returning to_jsonb(settings) into prev;
   p_expected_revision:=1;
  end if;
 else
  if p_id is not null then execute format('select to_jsonb(t) from fb_print_private.%I t where hotel_id=$1 and id=$2',tbl) into prev using h,p_id;
   if prev is null then raise exception using errcode='42501',message='printing_entity_forbidden';end if;
  end if;
 end if;
 if coalesce((prev->>'revision')::int,0)<>p_expected_revision then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
 candidate:=coalesce(prev,'{}')||p_values;
 for k in select jsonb_object_keys(p_values) loop
  if k in('active','allow_room','allow_notes','allow_name','fan_out') and jsonb_typeof(p_values->k)<>'boolean' then raise exception using errcode='22023',message='printing_boolean_invalid';end if;
  if k in('name','adapter','role') and (jsonb_typeof(p_values->k)<>'string' or fb_order_private.valid_text(p_values->>k,120,true) is null) then raise exception using errcode='22023',message='printing_text_invalid';end if;
  if k in('ticket_minutes','priority','copy_number') and (jsonb_typeof(p_values->k)<>'number' or (p_values->>k)!~'^[0-9]+$') then raise exception using errcode='22023',message='printing_number_invalid';end if;
  if k in('device_id','backup_device_id','destination_id','sector_id') and not (k='backup_device_id' and p_values->k='null'::jsonb) and (jsonb_typeof(p_values->k)<>'string' or (p_values->>k)!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception using errcode='22023',message='printing_id_invalid';end if;
 end loop;
 if p_kind='printer' then
  if jsonb_typeof(candidate->'config')<>'object' then raise exception using errcode='22023',message='printing_printer_config_invalid';end if;
  for k in select jsonb_object_keys(candidate->'config') loop
   if k not in('queue_name','host','port','driver','profile') or jsonb_typeof(candidate->'config'->k) not in('string','number') or (candidate->'config'->>k)~'[[:cntrl:]<>]' then raise exception using errcode='22023',message='printing_printer_config_invalid';end if;
  end loop;
  if not exists(select 1 from fb_print_private.destinations where hotel_id=h and id=(candidate->>'destination_id')::uuid and ((candidate->>'device_id')::uuid=device_id or (candidate->>'device_id')::uuid=backup_device_id)) then raise exception using errcode='42501',message='printing_device_destination_mismatch';end if;
 end if;
 if prev is not null and p_kind='route' and exists(select 1 from unnest(array['sector_id','destination_id','copy_number']) f where p_values?f and p_values->f is distinct from prev->f) then raise exception using errcode='22023',message='printing_route_parent_immutable';end if;
 if p_kind='settings' then
  select string_agg(format('%I=(jsonb_populate_record(null::fb_print_private.settings,$2)).%I',key,key),',') into cols from jsonb_object_keys(p_values) key;
  execute 'update fb_print_private.settings set '||cols||',revision=revision+1,updated_at=clock_timestamp() where hotel_id=$1 returning to_jsonb(settings)' into r using h,p_values;
 elsif prev is null then
  entity:=gen_random_uuid();select string_agg(format('%I',key),',') into cols from jsonb_object_keys(p_values) key;
  execute format('insert into fb_print_private.%I(id,hotel_id,%s) select $1,$2,%s from jsonb_populate_record(null::fb_print_private.%I,$3) t returning to_jsonb(%I)',tbl,cols,cols,tbl,tbl) into r using entity,h,p_values;
 else
  select string_agg(format('%I=(jsonb_populate_record(null::fb_print_private.%I,$3)).%I',key,tbl,key),',') into cols from jsonb_object_keys(p_values) key;
  execute format('update fb_print_private.%I set %s,revision=revision+1 where hotel_id=$1 and id=$2 returning to_jsonb(%I)',tbl,cols,tbl) into r using h,p_id,p_values;
 end if;
 perform fb_print_private.audit(h,'printing.config_changed',coalesce((r->>'id')::uuid,h));return r;
end $$;

create function public.activate_current_hotel_fb_printing(p_enabled boolean,p_expected_revision integer) returns jsonb
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
  where e.hotel_id=h and e.action='orders.accepted' on conflict(hotel_id,source_event_id) do update
  set status='baseline',code='before_activation',activation_id=excluded.activation_id,updated_at=clock_timestamp()
  where fb_print_private.processing.status='blocked';
 end if;
 update fb_print_private.settings set enabled=p_enabled,activation_id=case when p_enabled and not s.enabled then activation else activation_id end,
 activated_at=case when p_enabled and not s.enabled then clock_timestamp() else activated_at end,revision=revision+1,updated_at=clock_timestamp() where hotel_id=h returning * into s;
 perform fb_print_private.audit(h,'printing.activation_changed',h);return to_jsonb(s);
end $$;

create function fb_print_private.job_view(j fb_print_private.jobs) returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('job_id',j.id,'kind',j.kind,'state',j.state,'revision',j.revision,'fence',j.fence,
 'order_id',j.order_id,'group_id',j.group_id,'sector_id',j.sector_id,'destination_id',j.destination_id,'copy_number',j.copy_number,
 'attempt_id',(select id from fb_print_private.attempts where hotel_id=j.hotel_id and job_id=j.id and fence=j.fence),
 'lease_until',j.lease_until,'received',j.receipt_at is not null,'dispatch_recorded',j.dispatch_at is not null,
 'dispatch_authorized',j.state='dispatching' and j.dispatch_at is not null and j.lease_until>clock_timestamp() and j.expires_at>clock_timestamp(),
 'protocol_version',j.protocol_version,'payload_version',j.payload_version,'renderer_version',j.renderer_version,
 'expires_at',j.expires_at,'snapshot',j.snapshot,'snapshot_canonical',j.snapshot::text,'snapshot_hash',j.snapshot_hash,'routing',j.routing_snapshot,
 'reprint',j.kind='reprint','duplicate_risk',j.duplicate_risk);
$$;
create function public.heartbeat_fb_print_device(p_credential_id uuid,p_digest text,p_protocol_version integer,p_software_version text,p_observed_state text default 'online') returns jsonb
language plpgsql security definer set search_path='' as $$declare d fb_print_private.devices%rowtype;begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);
 if p_software_version is null or p_software_version!~'^[0-9A-Za-z.+_-]{1,40}$' or p_observed_state not in('online','unknown','degraded') or p_observed_state is null then raise exception using errcode='22023',message='printing_heartbeat_invalid';end if;
 update fb_print_private.devices set last_seen_at=clock_timestamp(),software_version=p_software_version,protocol_version=p_protocol_version,observed_state=p_observed_state where id=d.id;
 return jsonb_build_object('device_id',d.id,'server_time',clock_timestamp(),'compatible',true,'printer_ready',null);
end $$;
create function public.claim_fb_print_job(p_credential_id uuid,p_digest text,p_protocol_version integer,p_key uuid) returns jsonb
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
 where jb.hotel_id=d.hotel_id and ds.device_id=d.id and ds.active and jb.available_at<=clock_timestamp() and jb.expires_at>clock_timestamp() and jb.retain_until>clock_timestamp()
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
create function fb_print_private.owned(d fb_print_private.devices,id uuid,f bigint) returns fb_print_private.jobs language plpgsql set search_path='' as $$
declare j fb_print_private.jobs%rowtype;begin
 select * into j from fb_print_private.jobs where hotel_id=d.hotel_id and jobs.id=owned.id and retain_until>clock_timestamp() for update;
 if j.id is null then raise exception using errcode='42501',message='printing_job_forbidden';end if;
 if j.owner_device_id is distinct from d.id or j.fence is distinct from f then raise exception using errcode='PT409',message='printing_stale_fence';end if;
 return j;
end $$;
create function public.receipt_fb_print_job(p_credential_id uuid,p_digest text,p_protocol_version integer,p_job_id uuid,p_fence bigint,p_expected_revision integer,p_snapshot_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$declare d fb_print_private.devices%rowtype;j fb_print_private.jobs%rowtype;a uuid;begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);j:=fb_print_private.owned(d,p_job_id,p_fence);
 if not fb_print_private.equal_digest(j.snapshot_hash,p_snapshot_hash) then raise exception using errcode='PT409',message='printing_payload_mismatch';end if;
 if j.receipt_at is not null then return fb_print_private.job_view(j);end if;
 if j.state<>'leased' or j.lease_until<=clock_timestamp() or j.expires_at<=clock_timestamp() then raise exception using errcode='PT410',message='printing_lease_expired';end if;
 if j.revision is distinct from p_expected_revision then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
 update fb_print_private.jobs set receipt_at=clock_timestamp(),revision=revision+1 where id=j.id returning * into j;
 select id into a from fb_print_private.attempts where hotel_id=d.hotel_id and job_id=j.id and fence=j.fence;
 insert into fb_print_private.events(hotel_id,job_id,attempt_id,device_id,actor_kind,action,state) values(d.hotel_id,j.id,a,d.id,'device','received','leased');return fb_print_private.job_view(j);
end $$;
create function fb_print_private.private_projection(j fb_print_private.jobs) returns jsonb language plpgsql stable set search_path='' as $$
declare p fb_order_private.order_private_data%rowtype;cfg fb_print_private.settings%rowtype;ds fb_print_private.destinations%rowtype;result jsonb:='{}';notes jsonb;until_at timestamptz;begin
 if j.kind='test' then return jsonb_build_object('expired',false,'line_notes','[]'::jsonb);end if;
 select * into p from fb_order_private.order_private_data where hotel_id=j.hotel_id and order_id=j.order_id and expires_at>clock_timestamp();
 select * into cfg from fb_print_private.settings where hotel_id=j.hotel_id;select * into ds from fb_print_private.destinations where hotel_id=j.hotel_id and id=j.destination_id;
 if p.order_id is null then return jsonb_build_object('expired',true,'line_notes','[]'::jsonb);end if;
 until_at:=least(p.expires_at,clock_timestamp()+interval '24 hours',j.expires_at);
 if cfg.allow_room and ds.allow_room and (j.routing_snapshot->>'allow_room')::boolean and j.snapshot->>'fulfilment'='room_delivery' then result:=result||jsonb_build_object('room_label',p.room_label);end if;
 if cfg.allow_name and ds.allow_name and (j.routing_snapshot->>'allow_name')::boolean then result:=result||jsonb_build_object('first_name',p.first_name,'last_name',p.last_name);end if;
 if cfg.allow_notes and ds.allow_notes and (j.routing_snapshot->>'allow_notes')::boolean then
  result:=result||jsonb_build_object('note',p.note);
  select coalesce(jsonb_agg(jsonb_build_object('line_id',n.line_id,'note',n.note) order by n.line_id),'[]'),least(until_at,min(n.expires_at)) into notes,until_at
  from fb_order_private.order_line_notes n where n.hotel_id=j.hotel_id and n.order_id=j.order_id and n.expires_at>clock_timestamp() and exists(
   select 1 from fb_order_private.order_lines l where l.hotel_id=j.hotel_id and l.order_id=j.order_id and l.group_id=j.group_id and (l.id=n.line_id or l.parent_id=n.line_id));
  result:=result||jsonb_build_object('line_notes',notes);
 end if;
 return result||jsonb_build_object('expired',false,'expires_at',until_at,'name_enabled',cfg.allow_name and ds.allow_name and (j.routing_snapshot->>'allow_name')::boolean);
end $$;
create function public.authorize_fb_print_dispatch(p_credential_id uuid,p_digest text,p_protocol_version integer,p_job_id uuid,p_fence bigint,p_expected_revision integer,p_snapshot_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$declare d fb_print_private.devices%rowtype;j fb_print_private.jobs%rowtype;ds fb_print_private.destinations%rowtype;pr fb_print_private.printers%rowtype;private jsonb;a uuid;begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);j:=fb_print_private.owned(d,p_job_id,p_fence);
 if not fb_print_private.equal_digest(j.snapshot_hash,p_snapshot_hash) then raise exception using errcode='PT409',message='printing_payload_mismatch';end if;
 if j.state not in('leased','dispatching') or j.receipt_at is null or j.lease_until<=clock_timestamp() or j.expires_at<=clock_timestamp() then raise exception using errcode='PT410',message='printing_dispatch_not_eligible';end if;
 if j.state='leased' and j.revision is distinct from p_expected_revision then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
 if not coalesce((select enabled from fb_print_private.settings where hotel_id=d.hotel_id),false) then raise exception using errcode='42501',message='printing_disabled';end if;
 select * into ds from fb_print_private.destinations where hotel_id=d.hotel_id and id=j.destination_id and active;
 select * into pr from fb_print_private.printers where hotel_id=d.hotel_id and id=(j.routing_snapshot->'printer'->>'id')::uuid and active;
 if ds.id is null or ds.device_id<>d.id or ds.revision<>(j.routing_snapshot->>'destination_revision')::int or pr.id is null or pr.device_id<>d.id or pr.destination_id<>j.destination_id or pr.revision<>(j.routing_snapshot->'printer'->>'revision')::int then raise exception using errcode='PT409',message='printing_destination_changed';end if;
 if j.kind='order' and not exists(select 1 from fb_order_private.orders o join fb_order_private.order_groups g on g.hotel_id=o.hotel_id and g.order_id=o.id and g.id=j.group_id where o.hotel_id=d.hotel_id and o.id=j.order_id and o.retain_until>clock_timestamp() and g.status not in('registered','cancelled','delivered')) then
  if j.state='dispatching' then raise exception using errcode='PT410',message='printing_source_not_printable';end if;
  update fb_print_private.jobs set state='cancelled',code='source_not_printable',revision=revision+1 where id=j.id returning * into j;return fb_print_private.job_view(j);
 end if;
 private:=fb_print_private.private_projection(j);
 if j.snapshot->>'fulfilment'='room_delivery' and (j.routing_snapshot->>'allow_room')::boolean and (private->>'expired')::boolean then raise exception using errcode='PT410',message='printing_private_expired';end if;
 if j.state='dispatching' then return fb_print_private.job_view(j)||jsonb_build_object('private',private);end if;
 update fb_print_private.jobs set state='dispatching',dispatch_at=clock_timestamp(),revision=revision+1 where id=j.id returning * into j;
 select id into a from fb_print_private.attempts where hotel_id=d.hotel_id and job_id=j.id and fence=j.fence;
 insert into fb_print_private.events(hotel_id,job_id,attempt_id,device_id,actor_kind,action,state) values(d.hotel_id,j.id,a,d.id,'device','dispatch_authorized','dispatching');
 return fb_print_private.job_view(j)||jsonb_build_object('private',private);
end $$;
create function public.report_fb_print_result(p_credential_id uuid,p_digest text,p_protocol_version integer,p_job_id uuid,p_fence bigint,p_expected_revision integer,p_key uuid,p_result text,p_code text,p_no_io boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d fb_print_private.devices%rowtype;j fb_print_private.jobs%rowtype;a uuid;r jsonb;v jsonb;target text;action text;begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);j:=fb_print_private.owned(d,p_job_id,p_fence);
 if p_result is null or p_result not in('submitted','pre_send_failed','ambiguous') or p_code is null or p_code not in('spooler_accepted','transport_accepted','no_io','connection_unavailable','unknown_after_send') or p_no_io is null then raise exception using errcode='22023',message='printing_result_invalid';end if;
 v:=jsonb_build_object('job_id',p_job_id,'fence',p_fence,'result',p_result,'code',p_code,'no_io',p_no_io);
 r:=fb_print_private.command(d.hotel_id,d.id,'result',p_key,v);if r is not null then return fb_print_private.job_view(j);end if;
 if j.revision is distinct from p_expected_revision then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
 if p_result='pre_send_failed' then
  if not p_no_io or p_code not in('no_io','connection_unavailable') or j.state not in('leased','dispatching') or j.receipt_at is null then raise exception using errcode='PT409',message='printing_no_io_proof_required';end if;
  target:='retry_wait';action:='pre_send_failed';
 elsif p_result='submitted' then
  if j.dispatch_at is null or j.state not in('dispatching','ambiguous') or p_code not in('spooler_accepted','transport_accepted') or p_no_io then raise exception using errcode='PT409',message='printing_result_out_of_order';end if;
  target:='submitted';action:='submitted';
 else
  if j.dispatch_at is null or j.state<>'dispatching' or p_code<>'unknown_after_send' or p_no_io then raise exception using errcode='PT409',message='printing_result_out_of_order';end if;
  target:='ambiguous';action:='ambiguous';
 end if;
 update fb_print_private.jobs set state=target,code=p_code,available_at=case when target='retry_wait' then clock_timestamp()+interval '5 seconds' else available_at end,revision=revision+1 where id=j.id returning * into j;
 select id into a from fb_print_private.attempts where hotel_id=d.hotel_id and job_id=j.id and fence=j.fence;
 insert into fb_print_private.events(hotel_id,job_id,attempt_id,device_id,actor_kind,action,state,code) values(d.hotel_id,j.id,a,d.id,'device',action,target,p_code);
 r:=fb_print_private.job_view(j);return fb_print_private.remember(d.hotel_id,d.id,'result',p_key,v,r);
end $$;

create function public.create_current_hotel_fb_print_job(p_kind text,p_destination_id uuid,p_sector_id uuid,p_original_job_id uuid,p_reason_code text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();cfg fb_print_private.settings%rowtype;ds fb_print_private.destinations%rowtype;pr fb_print_private.printers%rowtype;
 original fb_print_private.jobs%rowtype;j fb_print_private.jobs%rowtype;v jsonb;r jsonb;payload jsonb;sector uuid;begin
 if p_kind not in('test','reprint') or p_kind is null then raise exception using errcode='22023',message='printing_kind_invalid';end if;
 sector:=p_sector_id;
 if p_kind='reprint' then
  select * into original from fb_print_private.jobs where hotel_id=h and id=p_original_job_id and kind<>'test' and retain_until>clock_timestamp();
  if original.id is null then raise exception using errcode='42501',message='printing_original_forbidden';end if;
  sector:=original.sector_id;
  if not fb_order_private.can(h,'orders.read',sector) then raise exception using errcode='42501',message='printing_read_required';end if;
  perform fb_print_private.require_cap(h,'printing.reprint',sector);
  if p_reason_code is null or p_reason_code not in('paper_damage','unreadable','operational','ambiguous_review') or p_destination_id is distinct from original.destination_id then raise exception using errcode='22023',message='printing_reprint_reason_invalid';end if;
 else
  perform fb_print_private.require_cap(h,'printing.test',sector);
  if p_original_job_id is not null or p_reason_code is not null or sector is null or not exists(select 1 from fb_print_private.routes where hotel_id=h and sector_id=sector and destination_id=p_destination_id and active) then raise exception using errcode='22023',message='printing_test_scope_invalid';end if;
 end if;
 v:=jsonb_build_object('kind',p_kind,'destination',p_destination_id,'sector',sector,'original',p_original_job_id,'reason',p_reason_code);
 r:=fb_print_private.command(h,auth.uid(),p_kind,p_key,v);if r is not null then return r;end if;
 select * into cfg from fb_print_private.settings where hotel_id=h;
 select * into ds from fb_print_private.destinations where hotel_id=h and id=p_destination_id and active;
 if cfg.hotel_id is null or not cfg.enabled or ds.id is null or not exists(select 1 from fb_print_private.devices where hotel_id=h and id=ds.device_id and active and revoked_at is null) then raise exception using errcode='42501',message='printing_destination_unavailable';end if;
 select * into pr from fb_print_private.printers where hotel_id=h and destination_id=ds.id and device_id=ds.device_id and active order by priority,id limit 1;
 if pr.id is null then raise exception using errcode='22023',message='printing_printer_required';end if;
 if p_kind='test' then payload:=jsonb_build_object('payload_version',1,'renderer_version',1,'label','TESTE DE IMPRESSÃO','fulfilment','pickup','lines','[]'::jsonb);
 else payload:=original.snapshot||jsonb_build_object('label','REIMPRESSÃO');end if;
 insert into fb_print_private.jobs(hotel_id,kind,source_event_id,order_id,group_id,sector_id,destination_id,copy_number,original_job_id,actor_user_id,reason_code,duplicate_risk,snapshot,snapshot_hash,routing_snapshot,expires_at,retain_until)
 values(h,p_kind,original.source_event_id,original.order_id,original.group_id,sector,ds.id,coalesce(original.copy_number,1),original.id,auth.uid(),p_reason_code,
 coalesce(original.state in('dispatching','submitted','confirmed','ambiguous'),false),payload,encode(sha256(convert_to(payload::text,'UTF8')),'hex'),
 jsonb_build_object('destination_revision',ds.revision,'device_id',ds.device_id,'printer',to_jsonb(pr),'allow_room',cfg.allow_room and ds.allow_room,'allow_notes',cfg.allow_notes and ds.allow_notes,'allow_name',cfg.allow_name and ds.allow_name),
 least(clock_timestamp()+make_interval(mins=>cfg.ticket_minutes),coalesce(original.retain_until,clock_timestamp()+interval '180 days')),coalesce(original.retain_until,clock_timestamp()+interval '180 days')) returning * into j;
 insert into fb_print_private.events(hotel_id,job_id,actor_kind,actor_user_id,action,state,code) values(h,j.id,'staff',auth.uid(),case when p_kind='test' then 'test_created' else 'reprinted' end,j.state,case when j.duplicate_risk then 'duplicate_risk_acknowledged' else null end);
 perform fb_print_private.audit(h,'printing.'||p_kind||'_created',j.id);
 r:=jsonb_build_object('job_id',j.id,'kind',j.kind,'state',j.state,'duplicate_risk',j.duplicate_risk);return fb_print_private.remember(h,auth.uid(),p_kind,p_key,v,r);
end $$;
create function public.get_current_hotel_fb_print_jobs(p_limit integer default 50,p_after_created timestamptz default null,p_after_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$declare h uuid:=fb_print_private.actor();r jsonb;begin
 if p_limit is null or p_limit not between 1 and 50 or (p_after_created is null)<>(p_after_id is null) then raise exception using errcode='22023',message='printing_page_invalid';end if;
 if not exists(select 1 from fb_order_private.operator_grants where hotel_id=h and user_id=auth.uid() and active and capability='orders.read') then raise exception using errcode='42501',message='printing_read_required';end if;
 select coalesce(jsonb_agg(jsonb_build_object('job_id',j.id,'order_id',j.order_id,'group_id',j.group_id,'sector_id',j.sector_id,'kind',j.kind,'state',j.state,'code',j.code,'revision',j.revision,'duplicate_risk',j.duplicate_risk,'created_at',j.created_at,'expires_at',j.expires_at) order by j.created_at,j.id),'[]') into r
 from(select * from fb_print_private.jobs jb where hotel_id=h and retain_until>clock_timestamp() and fb_order_private.can(h,'orders.read',sector_id)
 and (p_after_id is null or (created_at,id)>(p_after_created,p_after_id)) order by created_at,id limit p_limit)j;
 return r;
end $$;
create function public.get_current_hotel_fb_print_config() returns jsonb
language plpgsql security definer set search_path='' as $$declare h uuid:=fb_print_private.actor();r jsonb:='{}';tbl text;p jsonb;begin
 perform fb_print_private.require_cap(h,'printing.configure');
 foreach tbl in array array['settings','devices','destinations','printers','routes','grants'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]'') from fb_print_private.%I t where hotel_id=$1',tbl) into p using h;r:=r||jsonb_build_object(tbl,p);
 end loop;return r;
end $$;
create function public.admit_fb_print_http(p_action text,p_digest text) returns boolean
language plpgsql security definer set search_path='' as $$declare lim integer;n integer;begin
 perform fb_order_private.service_only();
 lim:=case p_action when 'pair' then 20 when 'device' then 300 when 'bootstrap' then 1200 else 0 end;
 if lim=0 or p_digest is null or p_digest!~'^[0-9a-f]{64}$' then raise exception using errcode='22023',message='printing_rate_context_invalid';end if;
 insert into fb_print_private.http_buckets(action,digest,window_at,used) values(p_action,p_digest,date_trunc('minute',clock_timestamp()),1)
 on conflict(action,digest,window_at) do update set used=fb_print_private.http_buckets.used+1 where fb_print_private.http_buckets.used<lim returning used into n;
 return n is not null;
end $$;

create table fb_print_private.maintenance_runs(
 id uuid primary key default gen_random_uuid(),created_at timestamptz not null default clock_timestamp(),status text not null check(status in('succeeded','failed')),
 counts jsonb not null default '{}',error_code text check(error_code is null or error_code~'^[0-9A-Z]{5}$')
);
create function public.run_fb_print_maintenance(p_batch integer default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n integer;counts jsonb:='{}';run_status text:='succeeded';failure text;begin
 perform fb_order_private.service_only();
 if p_batch is null or p_batch not between 1 and 1000 then raise exception using errcode='22023',message='printing_batch_invalid';end if;
 if not pg_try_advisory_xact_lock(530005,1) then return jsonb_build_object('status','skipped','counts','{}'::jsonb);end if;
 begin
  perform set_config('fb_print.retention','on',true);
  with x as(select id from fb_print_private.jobs where state='dispatching' and lease_until<=clock_timestamp() order by lease_until,id limit p_batch for update skip locked)
  update fb_print_private.jobs j set state='ambiguous',code='dispatch_result_missing',revision=revision+1 from x where j.id=x.id;get diagnostics n=row_count;counts:=counts||jsonb_build_object('ambiguous',n);
  with x as(select id from fb_print_private.jobs where state in('queued','leased','retry_wait','blocked') and (expires_at<=clock_timestamp() or retain_until<=clock_timestamp()) order by expires_at,id limit p_batch for update skip locked)
  update fb_print_private.jobs j set state='expired',code='ticket_expired',revision=revision+1 from x where j.id=x.id;get diagnostics n=row_count;counts:=counts||jsonb_build_object('expired',n);
  with x as(select id from fb_print_private.jobs where retain_until<=clock_timestamp() order by retain_until,id limit p_batch for update skip locked)
  delete from fb_print_private.jobs j using x where j.id=x.id;get diagnostics n=row_count;counts:=counts||jsonb_build_object('jobs',n);
  with x as(select hotel_id,source_event_id from fb_print_private.processing where retain_until<=clock_timestamp() order by retain_until limit p_batch)
  delete from fb_print_private.processing p using x where p.hotel_id=x.hotel_id and p.source_event_id=x.source_event_id;get diagnostics n=row_count;counts:=counts||jsonb_build_object('processing',n);
  with x as(select hotel_id,actor_id,operation,key from fb_print_private.commands where created_at<clock_timestamp()-interval '180 days' order by created_at limit p_batch)
  delete from fb_print_private.commands p using x where (p.hotel_id,p.actor_id,p.operation,p.key)=(x.hotel_id,x.actor_id,x.operation,x.key);get diagnostics n=row_count;counts:=counts||jsonb_build_object('commands',n);
  with x as(select id from fb_print_private.pairings where expires_at<clock_timestamp()-interval '1 day' order by expires_at limit p_batch)
  delete from fb_print_private.pairings p using x where p.id=x.id;get diagnostics n=row_count;counts:=counts||jsonb_build_object('pairings',n);
  with x as(select id from fb_print_private.credentials where issued_at<clock_timestamp()-interval '180 days' and (expires_at<=clock_timestamp() or revoked_at is not null) order by issued_at,id limit p_batch)
  delete from fb_print_private.credentials p using x where p.id=x.id;get diagnostics n=row_count;counts:=counts||jsonb_build_object('credentials',n);
  with x as(select ctid from fb_print_private.http_buckets where window_at<clock_timestamp()-interval '2 hours' order by window_at limit p_batch)
  delete from fb_print_private.http_buckets p using x where p.ctid=x.ctid;get diagnostics n=row_count;counts:=counts||jsonb_build_object('correlators',n);
  perform set_config('fb_print.retention','off',true);
 exception when others then run_status:='failed';failure:=sqlstate;counts:='{}';end;
 insert into fb_print_private.maintenance_runs(status,counts,error_code) values(run_status,counts,failure);
 delete from fb_print_private.maintenance_runs where id in(select id from fb_print_private.maintenance_runs where created_at<clock_timestamp()-interval '30 days' order by created_at limit p_batch);
 return jsonb_build_object('status',run_status,'counts',counts,'code',case when run_status='failed' then 'printing_maintenance_failed' else 'printing_maintenance_completed' end);
end $$;
create function fb_print_private.immutable() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' and current_setting('fb_print.retention',true)='on' then return old;end if;
 raise exception using errcode='42501',message='printing_history_immutable';
end $$;
create function fb_print_private.job_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then
  if current_setting('fb_print.retention',true)='on' then return old;end if;
  raise exception using errcode='42501',message='printing_job_immutable';
 end if;
 if (to_jsonb(new)-array['state','code','fence','owner_device_id','lease_until','receipt_at','dispatch_at','revision','available_at']) is distinct from (to_jsonb(old)-array['state','code','fence','owner_device_id','lease_until','receipt_at','dispatch_at','revision','available_at']) then raise exception using errcode='42501',message='printing_snapshot_immutable';end if;
 if new.state<>old.state and not (
  (old.state in('queued','retry_wait') and new.state in('leased','expired','blocked','cancelled')) or
  (old.state='leased' and new.state in('dispatching','retry_wait','blocked','expired','cancelled')) or
  (old.state='dispatching' and new.state in('submitted','retry_wait','ambiguous')) or
  (old.state='ambiguous' and new.state='submitted') or
  (old.state='blocked' and new.state in('expired','cancelled'))
 ) then raise exception using errcode='PT409',message='printing_transition_invalid';end if;
 return new;
end $$;
create trigger c1_job_guard before update or delete on fb_print_private.jobs for each row execute function fb_print_private.job_guard();
create trigger c1_attempt_immutable before update or delete on fb_print_private.attempts for each row execute function fb_print_private.immutable();
create trigger c1_event_immutable before update or delete on fb_print_private.events for each row execute function fb_print_private.immutable();
do $$declare t text;f record;begin
 for t in select tablename from pg_tables where schemaname='fb_print_private' loop
  execute format('alter table fb_print_private.%I enable row level security',t);
  execute format('revoke all on table fb_print_private.%I from public,anon,authenticated,service_role',t);
 end loop;
 revoke all on all functions in schema fb_print_private from public,anon,authenticated,service_role;
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(
 'grant_current_hotel_fb_print_capability','save_current_hotel_fb_print_config','activate_current_hotel_fb_printing','create_current_hotel_fb_print_pairing',
 'exchange_fb_print_pairing','rotate_current_hotel_fb_print_credential','revoke_current_hotel_fb_print_device','reconcile_current_hotel_fb_printing',
 'heartbeat_fb_print_device','claim_fb_print_job','receipt_fb_print_job','authorize_fb_print_dispatch','report_fb_print_result',
 'create_current_hotel_fb_print_job','get_current_hotel_fb_print_jobs','get_current_hotel_fb_print_config','admit_fb_print_http','run_fb_print_maintenance') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.oid::regprocedure);
  execute format('grant execute on function %s to %I',f.oid::regprocedure,case when f.proname like '%current_hotel%' then 'authenticated' else 'service_role' end);
 end loop;
end $$;
commit;
