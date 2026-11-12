import 'server-only';
import {createHash,createHmac,hkdfSync,randomBytes} from 'node:crypto';
import {uuid} from '../validation.ts';

export function opaqueOrderSecret():string {return randomBytes(32).toString('base64url');}
export function validOrderSecret(value:unknown):value is string {
 return typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value)&&Buffer.from(value,'base64url').length===32&&Buffer.from(value,'base64url').toString('base64url')===value;
}
export const roomQuotePrefix = 'room.';
/** The database sees a normal opaque secret. The client receives only its random reference. */
export function roomQuoteSecret(reference:string,roomToken:string,roomNumber:string) {
 return createHmac('sha256',reference).update(JSON.stringify([roomToken,roomNumber])).digest('base64url');
}
export function orderSecretDigest(secret:string):string {
 if(!validOrderSecret(secret))throw new Error('orders_credential_invalid');
 return createHash('sha256').update(secret,'utf8').digest('hex');
}
/** Standard HKDF permits the same receipt credential after a lost committed response.
 * Input is a random 256-bit session secret; this is not field encryption or guest login.
 * Hotel/outlet/attempt domain separation prevents reusing a credential for another order.
 */
export function deriveOrderAccessSecret(session:string,hotelSlug:string,outletId:string,key:string):string {
 if(!validOrderSecret(session)||!/^[a-z0-9][a-z0-9-]{0,62}$/.test(hotelSlug)||!uuid(outletId)||!uuid(key))throw new Error('orders_credential_context_invalid');
 return Buffer.from(hkdfSync('sha256',Buffer.from(session,'base64url'),Buffer.from('libguest-fb-order-access-v1'),Buffer.from([hotelSlug,outletId.toLowerCase(),key.toLowerCase()].join(':')),32)).toString('base64url');
}
export function orderSessionCookie(slug:string,secret:string,expires:Date) {
 if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)||!validOrderSecret(secret)||!Number.isFinite(expires.valueOf()))throw new Error('orders_cookie_invalid');
 return {name:'lg_fb_session',value:secret,httpOnly:true,secure:true,sameSite:'lax' as const,path:'/api/fb/hotel/'+slug,expires};
}
export function orderAccessCookie(id:string,secret:string,expires:Date) {
 if(!uuid(id)||!validOrderSecret(secret)||!Number.isFinite(expires.valueOf()))throw new Error('orders_cookie_invalid');
 return {name:'lg_fb_access',value:secret,httpOnly:true,secure:true,sameSite:'lax' as const,path:'/api/fb/orders/'+id,expires};
}
