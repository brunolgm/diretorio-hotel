import {NextRequest,NextResponse} from 'next/server';
import {KDS_COOKIE,kdsSecret,kdsSnapshot,kdsTransition,pairKds} from '@/lib/fb/kds/server';
import {orderBody,orderError,privateOrderHeaders} from '@/lib/fb/orders/http.server';
import {OrderBoundaryError} from '@/lib/fb/orders/rpc.server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){try{return NextResponse.json(await kdsSnapshot(kdsSecret(request)),{headers:privateOrderHeaders});}catch(e){return orderError(e);}}
export async function POST(request:NextRequest){try{
 const body=await orderBody(request,['operation','code','device_name','group_id','revision','status'],1024);
 if(body.operation==='pair'){
  const secret=await pairKds(body);const response=NextResponse.json({ok:true},{headers:privateOrderHeaders});
  response.cookies.set(KDS_COOKIE,secret,{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'strict',path:'/api/fb/kds',maxAge:30*86400});return response;
 }
 if(body.operation!=='transition')throw new OrderBoundaryError(400,'invalid_input');
 await kdsTransition(kdsSecret(request),body);return NextResponse.json({ok:true},{headers:privateOrderHeaders});
}catch(e){return orderError(e);}}
