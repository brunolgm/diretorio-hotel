import 'server-only';
import {randomUUID} from 'node:crypto';
import {uuid} from '../validation.ts';
export type FbDiagnosticCode='validation_rejected'|'idempotency_conflict'|'unavailable'|'order_created'|'order_recovered'|'transition_confirmed'|'transition_rejected'|'cancellation_confirmed'|'cancellation_rejected'|'access_denied'|'rate_limited'|'maintenance_failed';
const codes=new Set<string>(['validation_rejected','idempotency_conflict','unavailable','order_created','order_recovered','transition_confirmed','transition_rejected','cancellation_confirmed','cancellation_rejected','access_denied','rate_limited','maintenance_failed']);
/** Closed metadata: callers cannot add a body, URL, token, note or provider error. */
export function fbOrderDiagnostic(code:FbDiagnosticCode,orderId?:unknown){
 const diagnostic_id=randomUUID();
 try{console.info(JSON.stringify({scope:'fb.orders',code:codes.has(code)?code:'unavailable',diagnostic_id,...(typeof orderId==='string'&&uuid(orderId)?{order_id:orderId}:{} )}));}catch{/* A logging sink cannot turn a committed order into an ambiguous failure. */}
 return diagnostic_id;
}
