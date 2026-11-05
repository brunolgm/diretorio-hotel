-- C3 is additive: existing C1/C2 protocols, tables and historical migrations stay intact.
begin;
set local lock_timeout='5s';
create index c3_jobs_admin_page on fb_print_private.jobs(hotel_id,created_at,id);

create function public.get_current_hotel_fb_print_access() returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();configure boolean;manage boolean;r jsonb;begin
 configure:=fb_print_private.can(h,'printing.configure');manage:=public.has_active_hotel_role(h,'administrador');
 if not configure and not manage and not exists(select 1 from fb_order_private.operator_grants where hotel_id=h and user_id=auth.uid() and active and capability='orders.read') and not exists(select 1 from fb_print_private.grants where hotel_id=h and user_id=auth.uid() and active) then raise exception using errcode='42501',message='printing_forbidden';end if;
 select jsonb_build_object('hotel_id',h,'configure',configure,'manage_grants',manage,
 'capabilities',coalesce((select jsonb_agg(jsonb_build_object('capability',capability,'sector_id',sector_id)) from fb_print_private.grants where hotel_id=h and user_id=auth.uid() and active),'[]'),
 'order_scopes',coalesce((select jsonb_agg(jsonb_build_object('sector_id',sector_id)) from fb_order_private.operator_grants where hotel_id=h and user_id=auth.uid() and active and capability='orders.read'),'[]'),
 'destinations',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'sector_id',r.sector_id)) from fb_print_private.destinations d join fb_print_private.routes r on r.hotel_id=d.hotel_id and r.destination_id=d.id where d.hotel_id=h and d.active and r.active and (configure or fb_order_private.can(h,'orders.read',r.sector_id) or fb_print_private.can(h,'printing.test',r.sector_id))),'[]'),
 'sectors',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name,s.id) from fb_order_private.sectors s where s.hotel_id=h and (configure or manage or fb_order_private.can(h,'orders.read',s.id) or fb_print_private.can(h,'printing.test',s.id) or fb_print_private.can(h,'printing.reprint',s.id))),'[]')) into r;
 return r;
end $$;

create function fb_print_private.admin_job(j fb_print_private.jobs) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('job_id',j.id,'order_id',j.order_id,'group_id',j.group_id,'sector_id',j.sector_id,'source_event_id',j.source_event_id,
 'sector_name',(select name from fb_order_private.sectors where hotel_id=j.hotel_id and id=j.sector_id),
 'destination_id',j.destination_id,'destination_name',(select name from fb_print_private.destinations where hotel_id=j.hotel_id and id=j.destination_id),
 'bridge_name',(select name from fb_print_private.devices where hotel_id=j.hotel_id and id=j.owner_device_id),
 'kind',j.kind,'state',j.state,'code',j.code,'revision',j.revision,'fence',j.fence,'copy_number',j.copy_number,'original_job_id',j.original_job_id,'duplicate_risk',j.duplicate_risk,
 'created_at',j.created_at,'expires_at',j.expires_at,'lease_until',j.lease_until,'receipt_at',j.receipt_at,'dispatch_at',j.dispatch_at,
 'protocol_version',j.protocol_version,'payload_version',j.payload_version,'renderer_version',j.renderer_version,'snapshot_hash',j.snapshot_hash,
 'can_reprint',j.kind<>'test' and fb_order_private.can(j.hotel_id,'orders.read',j.sector_id) and fb_print_private.can(j.hotel_id,'printing.reprint',j.sector_id));
$$;

create function public.get_current_hotel_fb_print_console(p_limit integer default 25,p_after_created timestamptz default null,p_after_id uuid default null,p_state text default null,p_sector uuid default null,p_kind text default null,p_destination uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();a jsonb:=public.get_current_hotel_fb_print_access();cfg jsonb:='{}';q jsonb;last_row jsonb;more boolean;health jsonb;begin
 if p_limit is null or p_limit not between 1 and 50 or (p_after_created is null)<>(p_after_id is null) or (p_state is not null and p_state not in('queued','leased','dispatching','submitted','confirmed','retry_wait','blocked','ambiguous','expired','cancelled')) or (p_kind is not null and p_kind not in('order','test','reprint')) then raise exception using errcode='22023',message='printing_filter_invalid';end if;
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

create function public.get_current_hotel_fb_print_detail(p_job_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();j fb_print_private.jobs%rowtype;begin
 select * into j from fb_print_private.jobs where hotel_id=h and id=p_job_id and retain_until>clock_timestamp();
 if j.id is null or not fb_order_private.can(h,'orders.read',j.sector_id) then raise exception using errcode='42501',message='printing_job_forbidden';end if;
 return jsonb_build_object('job',fb_print_private.admin_job(j),
 'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'device_id',device_id,'fence',fence,'created_at',created_at) order by fence) from fb_print_private.attempts where hotel_id=h and job_id=j.id),'[]'),
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',id,'action',action,'state',state,'code',code,'created_at',created_at,'attempt_id',attempt_id) order by created_at,id) from fb_print_private.events where hotel_id=h and job_id=j.id),'[]'));
end $$;

create function public.get_current_hotel_fb_print_groups(p_group_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$declare h uuid:=fb_print_private.actor();r jsonb;begin
 if p_group_ids is null or cardinality(p_group_ids)>500 then raise exception using errcode='22023',message='printing_groups_invalid';end if;
 select coalesce(jsonb_agg(jsonb_build_object('group_id',group_id,'job_id',id,'kind',kind,'state',state,'copy_number',copy_number) order by created_at,id),'[]') into r from fb_print_private.jobs where hotel_id=h and group_id=any(p_group_ids) and retain_until>clock_timestamp() and fb_order_private.can(h,'orders.read',sector_id);return r;
end $$;

create function public.execute_current_hotel_fb_print_admin(p_operation text,p_body jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h uuid:=fb_print_private.actor();b jsonb:=p_body;r jsonb;j fb_print_private.jobs%rowtype;revision integer;begin
 if b is null or jsonb_typeof(b)<>'object' or octet_length(b::text)>4096 or p_key is null then raise exception using errcode='22023',message='printing_command_invalid';end if;
 if p_operation in('config','activate','pairing','rotate','revoke','reconcile') then perform fb_print_private.require_cap(h,'printing.configure');
 elsif p_operation='grant' then if not public.has_active_hotel_role(h,'administrador') then raise exception using errcode='42501',message='printing_admin_required';end if;
 elsif p_operation='test' then perform fb_print_private.require_cap(h,'printing.test',(b->>'sector_id')::uuid);
 elsif p_operation='reprint' then
  select * into j from fb_print_private.jobs where hotel_id=h and id=(b->>'original_job_id')::uuid and retain_until>clock_timestamp();
  if j.id is null or not fb_order_private.can(h,'orders.read',j.sector_id) then raise exception using errcode='42501',message='printing_job_forbidden';end if;
  perform fb_print_private.require_cap(h,'printing.reprint',j.sector_id);
 else raise exception using errcode='22023',message='printing_operation_invalid';end if;
 r:=fb_print_private.command(h,auth.uid(),'c3_'||p_operation,p_key,b);if r is not null then return r;end if;
 case p_operation
 when 'config' then r:=public.save_current_hotel_fb_print_config(b->>'kind',(b->>'id')::uuid,(b->>'revision')::integer,b->'values');
 when 'activate' then r:=public.activate_current_hotel_fb_printing((b->>'enabled')::boolean,(b->>'revision')::integer);
 when 'grant' then r:=public.grant_current_hotel_fb_print_capability((b->>'user_id')::uuid,b->>'capability',(b->>'sector_id')::uuid,(b->>'active')::boolean,(b->>'revision')::integer);
 when 'reconcile' then r:=public.reconcile_current_hotel_fb_printing((b->>'batch')::integer);
 when 'reprint' then
  if (b->>'revision')::integer is distinct from j.revision then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
  r:=public.create_current_hotel_fb_print_job('reprint',(b->>'destination_id')::uuid,null,j.id,b->>'reason',p_key);
  -- actor() holds the tenant lock: consume this source revision atomically.
  -- Same-key replay returns above, before CAS; a new stale intent must conflict.
  update fb_print_private.jobs original set revision=original.revision+1 where original.hotel_id=h and original.id=j.id;
 when 'test' then r:=public.create_current_hotel_fb_print_job('test',(b->>'destination_id')::uuid,(b->>'sector_id')::uuid,null,null,p_key);
 else
  select d.revision into revision from fb_print_private.devices d where hotel_id=h and id=(b->>'device_id')::uuid;
  if revision is null then raise exception using errcode='42501',message='printing_device_forbidden';end if;
  if revision is distinct from (b->>'revision')::integer then raise exception using errcode='PT409',message='printing_revision_conflict';end if;
  if p_operation='revoke' then r:=public.revoke_current_hotel_fb_print_device((b->>'device_id')::uuid,revision);
  else
   if p_operation='pairing' then r:=public.create_current_hotel_fb_print_pairing((b->>'device_id')::uuid,(b->>'secret_id')::uuid,b->>'digest');
   else r:=public.rotate_current_hotel_fb_print_credential((b->>'device_id')::uuid,(b->>'secret_id')::uuid,b->>'digest');end if;
   update fb_print_private.devices d set revision=d.revision+1 where hotel_id=h and id=(b->>'device_id')::uuid;
  end if;
 end case;
 return fb_print_private.remember(h,auth.uid(),'c3_'||p_operation,p_key,b,r);
end $$;

revoke all on function fb_print_private.admin_job(fb_print_private.jobs) from public,anon,authenticated,service_role;
do $$declare f record;begin
 for f in select oid from pg_proc where pronamespace='public'::regnamespace and proname in('get_current_hotel_fb_print_access','get_current_hotel_fb_print_console','get_current_hotel_fb_print_detail','get_current_hotel_fb_print_groups','execute_current_hotel_fb_print_admin') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.oid::regprocedure);
 execute format('grant execute on function %s to authenticated',f.oid::regprocedure);
 end loop;
end $$;
commit;
