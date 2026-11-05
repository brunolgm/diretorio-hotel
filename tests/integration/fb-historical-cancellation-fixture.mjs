// Legacy pending requests are read/decided by staff, but can no longer be created
// by a guest. Seed that historical fact ONLY through the owned disposable LAB.
import {randomUUID} from 'node:crypto';
import {labSql} from '../../scripts/fb-local-lab.mjs';
import {literal} from './fb-local-seed.mjs';
export function historicalCancellation(t,orderId){
 const id=randomUUID();
 labSql('begin;insert into fb_order_private.cancellation_requests(id,hotel_id,order_id) values('+literal(id)+','+literal(t.id)+','+literal(orderId)+');select fb_order_private.event('+literal(t.id)+','+literal(orderId)+",null,'orders.cancellation_requested','guest');commit;");
 return {id,revision:1};
}
