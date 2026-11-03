import {isJsonContentType,readUtf8BodyWithLimit} from '../../security/http.ts';
import {OrderBoundaryError} from './rpc.server.ts';
export const privateOrderHeaders={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Vary':'Cookie, Host','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export function redactedOrderError(error:unknown){const e=error instanceof OrderBoundaryError?error:new OrderBoundaryError(503,'unavailable');return {status:e.status,body:{error:e.code}};}
export function sameOrigin(request:Request){const expected=new URL(request.url);if(request.headers.get('host'))expected.host=request.headers.get('host')!;if(request.headers.get('origin')!==expected.origin||request.headers.get('sec-fetch-site')==='cross-site')throw new OrderBoundaryError(403,'forbidden');}
export async function orderBody(request:Request,keys:string[],limit=32768):Promise<Record<string,unknown>>{
 sameOrigin(request);if(!isJsonContentType(request.headers.get('content-type')))throw new OrderBoundaryError(415,'invalid_input');
 const body=await readUtf8BodyWithLimit(request,limit);if(!body.ok)throw new OrderBoundaryError(413,'invalid_input');
 let value:unknown;try{value=JSON.parse(body.text);}catch{throw new OrderBoundaryError(400,'invalid_input');}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw new OrderBoundaryError(400,'invalid_input');return value as Record<string,unknown>;
}
