/** B1 domain contracts. No theme, hotel name, visual version or guest identity. */
export const ORDER_CAPABILITIES = ['orders.read','orders.transition','orders.cancel','orders.supervise','orders.pii.read','orders.configure'] as const;
export const ORDER_STATES = ['registered','accepted','preparing','ready','out_for_delivery','delivered','cancelled'] as const;
export type OrderState = typeof ORDER_STATES[number];
export type OrderCapability = typeof ORDER_CAPABILITIES[number];
export const ORDER_RETENTION = {piiDays:7,factsDays:180,accessTerminalHours:24,accessMaxDays:7,idempotencyHours:24} as const;
export const ORDER_LIMITS = {bodyBytes:32768,roots:20,leaves:60,units:100,options:16,lineQuantity:20,panelPage:50,note:1000,itemNote:500,name:80} as const;
export type ModifierSelection = string[];
export type ComboSelection = {id:string;options?:ModifierSelection};
export type OrderLineIntent =
 | {kind:'item';id:string;menu_id:string;quantity:number;options?:ModifierSelection;note?:string|null}
 | {kind:'combo';id:string;menu_id:string;quantity:number;choices:ComboSelection[];note?:string|null};
export interface OrderIntent {
 lines:OrderLineIntent[];first_name:string;last_name:string;note?:string|null;
 fulfilment:'pickup'|'room_delivery';language:'pt'|'en'|'es';
}
export interface OrderQuote {currency:string;total_minor:number;outlet_id:string;outlet_name:string;lines:unknown[]}
export interface OrderReceipt {order_id:string;status:OrderState;revision:number;currency:string;total_minor:number;access_expires_at:string;replayed:boolean}
export type FoundationError = 'invalid_request'|'forbidden'|'conflict'|'expired'|'rate_limited'|'unavailable';
export type FoundationResult<T> = {ok:true;data:T}|{ok:false;error:FoundationError;status:number};
/** Only codes cross the boundary. PostgREST message/details may contain submitted values. */
export function foundationFailure(code:string|undefined):{ok:false;error:FoundationError;status:number} {
 if(code==='PT409')return {ok:false,error:'conflict',status:409};
 if(code==='PT410')return {ok:false,error:'expired',status:410};
 if(code==='PT429')return {ok:false,error:'rate_limited',status:429};
 if(code==='42501'||code==='P0002')return {ok:false,error:'forbidden',status:403};
 if(code?.startsWith('22')||code?.startsWith('23'))return {ok:false,error:'invalid_request',status:400};
 return {ok:false,error:'unavailable',status:503};
}
