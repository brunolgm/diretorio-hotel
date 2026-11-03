-- B4: restricted F&B maintenance and bounded, non-PII execution evidence. No scheduling/enable.
begin;
set local lock_timeout='5s';
create table fb_order_private.maintenance_runs(
 id uuid primary key default gen_random_uuid(),started_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,status text not null check(status in('succeeded','failed','skipped')),
 batch_size integer not null check(batch_size between 1 and 1000),counts jsonb not null default '{}',
 error_code text check(error_code is null or error_code~'^[0-9A-Z]{5}$')
);
create index b4_maintenance_recent on fb_order_private.maintenance_runs(started_at desc,id);
alter table fb_order_private.maintenance_runs enable row level security;
revoke all on fb_order_private.maintenance_runs from public,anon,authenticated,service_role;

-- Extend only category accounting; preserve the committed B1 collector and B23 cascade bound.
do $$ declare definition text;needle text;category text;begin
 definition:=pg_get_functiondef('public.purge_expired_fb_order_data(integer)'::regprocedure);
 if position('fb_order_private.quotes' in definition)=0 or position('alerts integer:=0;' in definition)=0 then raise exception 'B4 collector prerequisite changed';end if;
 definition:=replace(definition,'alerts integer:=0;','alerts integer:=0;tokens integer:=0;keys integer:=0;sessions integer:=0;buckets integer:=0;quotes integer:=0;');
 for needle,category in select * from(values
 ('delete from fb_order_private.order_access_tokens p using d where p.order_id=d.order_id;','tokens'),
 ('delete from fb_order_private.idempotency p using d where p.ctid=d.ctid;','keys'),
 ('delete from fb_order_private.guest_sessions p using d where p.id=d.id;','sessions'),
 ('delete from fb_order_private.admission_buckets p using d where p.ctid=d.ctid;','buckets'),
 ('delete from fb_order_private.quotes where id in (select id from fb_order_private.quotes where expires_at<clock_timestamp()-interval ''24 hours'' order by expires_at limit p_batch);','quotes')) v(n,c)
 loop
  if position(needle in definition)=0 then raise exception 'B4 collector statement changed';end if;
  definition:=replace(definition,needle,needle||'get diagnostics '||category||'=row_count;');
 end loop;
 needle:='return jsonb_build_object(''pii'',pii,''notes'',notes,''alerts'',alerts,''facts'',n);';
 if position(needle in definition)=0 then raise exception 'B4 collector result changed';end if;
 definition:=replace(definition,needle,'return jsonb_build_object(''pii'',pii,''notes'',notes,''alerts'',alerts,''facts'',n,''tokens'',tokens,''idempotency'',keys,''sessions'',sessions,''correlators'',buckets,''quotes'',quotes);');
 execute definition;
end $$;

create function public.run_fb_order_maintenance(p_batch integer default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
declare run uuid:=gen_random_uuid();started timestamptz:=clock_timestamp();counts jsonb:='{}';state text:='succeeded';failure text;begin
 perform fb_order_private.service_only();
 if p_batch is null or p_batch not between 1 and 1000 then raise exception using errcode='22023',message='orders_batch_invalid';end if;
 if not pg_try_advisory_xact_lock(530004,1) then
  -- Concurrent workers do not multiply work or grow history with skipped invocations.
  return jsonb_build_object('status','skipped','code','maintenance_busy','counts',counts);
 end if;
 begin counts:=public.purge_expired_fb_order_data(p_batch);
 exception when others then state:='failed';failure:=sqlstate;counts:='{}';end;
 insert into fb_order_private.maintenance_runs(id,started_at,finished_at,status,batch_size,counts,error_code)
 values(run,started,clock_timestamp(),state,p_batch,counts,failure);
 delete from fb_order_private.maintenance_runs where id in(select id from fb_order_private.maintenance_runs where started_at<started-interval '30 days' order by started_at limit p_batch);
 return jsonb_build_object('run_id',run,'status',state,'counts',counts,'code',case when state='failed' then 'maintenance_failed' else 'maintenance_completed' end);
end $$;
create function public.get_fb_order_maintenance_status() returns jsonb
language plpgsql security definer set search_path='' as $$begin
 perform fb_order_private.service_only();
 return jsonb_build_object('last_run',(select to_jsonb(r) from fb_order_private.maintenance_runs r order by started_at desc,id desc limit 1),
 'last_success_at',(select max(finished_at) from fb_order_private.maintenance_runs where status='succeeded'));
end $$;
revoke all on function public.run_fb_order_maintenance(integer) from public,anon,authenticated,service_role;
revoke all on function public.get_fb_order_maintenance_status() from public,anon,authenticated,service_role;
grant execute on function public.run_fb_order_maintenance(integer) to service_role;
grant execute on function public.get_fb_order_maintenance_status() to service_role;
commit;
