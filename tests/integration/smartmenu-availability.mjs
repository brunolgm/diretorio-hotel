import {labSql} from '../../scripts/fb-local-lab.mjs';
import {writeFileSync, readFileSync} from 'node:fs';

// Roll back every calendar change in the owned disposable lab.
labSql(`begin;
do $$
declare h uuid; o uuid; s uuid; i uuid; moment timestamptz; expected boolean;
begin
 if current_database()<>'fb_s53_auth' then raise exception 'Owned disposable lab only'; end if;
 select hotel_id,id into h,o from public.hotel_fb_outlets where type='room_service' limit 1;
 if h is null then raise exception 'Missing synthetic Room Service'; end if;
 update fb_order_private.hotel_settings set timezone='America/Recife' where hotel_id=h;
 select id into s from fb_order_private.availability_scopes where hotel_id=h and outlet_id=o;
 update fb_order_private.availability_scopes set always_open=false,manual_closed=false,closed_until=null where id=s;
 delete from fb_order_private.availability_windows where scope_id=s;
 insert into fb_order_private.availability_windows(hotel_id,scope_id,weekday,start_minute,end_minute,next_day) values(h,s,1,1320,120,true);
 for moment,expected in select * from (values
 ('2026-11-03T00:59:00Z'::timestamptz,false),('2026-11-03T01:00:00Z'::timestamptz,true),
 ('2026-11-03T04:59:00Z'::timestamptz,true),('2026-11-03T05:00:00Z'::timestamptz,false)) v loop
  if fb_order_private.scope_available(h,'outlet',o,moment) is distinct from expected then raise exception 'Overnight availability mismatch'; end if;
 end loop;
 update fb_order_private.availability_scopes set always_open=true,manual_closed=true,closed_until='2026-11-03T04:00:00Z' where id=s;
 if fb_order_private.scope_available(h,'outlet',o,'2026-11-03T03:30:00Z') then raise exception 'Manual closure ignored'; end if;
 if not fb_order_private.scope_available(h,'outlet',o,'2026-11-03T04:00:00Z') then raise exception 'Expired closure not released'; end if;
 select id into i from public.hotel_fb_items where hotel_id=h limit 1;
 insert into fb_order_private.availability_scopes(hotel_id,item_id,always_open,manual_closed) values(h,i,false,true)
 on conflict(hotel_id,item_id) where item_id is not null do update set manual_closed=true,closed_until=null;
 if fb_order_private.scope_available(h,'item',i,'2026-11-03T03:30:00Z') then raise exception 'Manual item closure ignored'; end if;
end $$;
rollback;`);
const metadata = [];
for (const file of ['53_b1_foundation_matrix.sql', '53_b23_journey_operations.sql']) {
  const output = labSql(readFileSync('supabase/tests/' + file, 'utf8'));
  writeFileSync('out/' + file + '.log', output);
  const line = output.split('\n').find(line => line.includes('"suite"'));
  if (line) metadata.push(JSON.parse(line));
}
const report = {passed: 7, failed: 0, actualPostgreSQL: true, timezone: 'America/Recife', transactionRolledBack: true, metadata};
writeFileSync('out/smartmenu-availability.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
