import {NextRequest,NextResponse} from 'next/server';
import {readKdsAdmin,manageKds} from '@/lib/fb/kds/server';
import {orderBody,orderError,privateOrderHeaders} from '@/lib/fb/orders/http.server';
export const dynamic='force-dynamic';
export async function GET(){try{return NextResponse.json(await readKdsAdmin(),{headers:privateOrderHeaders});}catch(e){return orderError(e);}}
export async function POST(request:NextRequest){try{return NextResponse.json(await manageKds(await orderBody(request,['operation','screen','id','revision'],12000)),{headers:privateOrderHeaders});}catch(e){return orderError(e);}}
