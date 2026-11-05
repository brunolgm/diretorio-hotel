-- Optional C4 dispatch: core C1 v1 operations and their responses are unchanged.
begin;
create function public.authorize_fb_windows_spooler_dispatch(p_credential_id uuid,p_digest text,p_protocol_version integer,p_job_id uuid,p_fence bigint,p_expected_revision integer,p_snapshot_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d fb_print_private.devices%rowtype;j fb_print_private.jobs%rowtype;r jsonb;printer jsonb;begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);
 r:=public.authorize_fb_print_dispatch(p_credential_id,p_digest,p_protocol_version,p_job_id,p_fence,p_expected_revision,p_snapshot_hash);
 if r->>'state'<>'dispatching' then return r;end if;
 j:=fb_print_private.owned(d,p_job_id,p_fence);printer:=j.routing_snapshot->'printer';
 if printer->>'adapter'<>'windows_spooler' or printer->'config'->>'queue_name' is null or length(btrim(printer->'config'->>'queue_name')) not between 1 and 120 or (printer->'config'->>'queue_name')~'[[:cntrl:]\\/]' then raise exception using errcode='PT409',message='printing_spooler_configuration_invalid';end if;
 return r||jsonb_build_object('spooler',jsonb_build_object('version',1,'device_id',d.id,'destination_id',j.destination_id,'destination_revision',(j.routing_snapshot->>'destination_revision')::integer,
 'printer_id',printer->>'id','printer_revision',(printer->>'revision')::integer,'queue_name',printer->'config'->>'queue_name','hotel_name',(select name from public.hotels where id=d.hotel_id),
 'sector_name',(select name from fb_order_private.sectors where hotel_id=d.hotel_id and id=j.sector_id),'created_at',j.created_at));
end $$;
revoke all on function public.authorize_fb_windows_spooler_dispatch(uuid,text,integer,uuid,bigint,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.authorize_fb_windows_spooler_dispatch(uuid,text,integer,uuid,bigint,integer,text) to service_role;
create function public.observe_fb_windows_spooler(p_credential_id uuid,p_digest text,p_protocol_version integer,p_job_id uuid,p_fence bigint,p_printer_id uuid,p_revision integer,p_state text) returns jsonb
language plpgsql security definer set search_path='' as $$declare d fb_print_private.devices%rowtype;j fb_print_private.jobs%rowtype;begin
 d:=fb_print_private.machine(p_credential_id,p_digest,p_protocol_version);j:=fb_print_private.owned(d,p_job_id,p_fence);
 if p_state is null or p_state not in('unknown','offline','paper_out','error') then raise exception using errcode='22023',message='printing_observation_invalid';end if;
 if j.dispatch_at is null or (j.routing_snapshot->'printer'->>'id')::uuid is distinct from p_printer_id or (j.routing_snapshot->'printer'->>'revision')::integer is distinct from p_revision then raise exception using errcode='PT409',message='printing_observation_scope';end if;
 update fb_print_private.printers set observed_state=p_state,observed_at=clock_timestamp() where hotel_id=d.hotel_id and id=p_printer_id and device_id=d.id and revision=p_revision;
 if not found then raise exception using errcode='PT409',message='printing_observation_scope';end if;
 return jsonb_build_object('observed_at',clock_timestamp(),'printer_ready',null);
end $$;
revoke all on function public.observe_fb_windows_spooler(uuid,text,integer,uuid,bigint,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.observe_fb_windows_spooler(uuid,text,integer,uuid,bigint,uuid,integer,text) to service_role;
commit;
