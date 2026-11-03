import {type NextRequest,NextResponse} from 'next/server';
import {orderBody,orderError,privateOrderHeaders} from '@/lib/fb/orders/http.server';
import {orderPanelPage,privateOrderView} from '@/lib/fb/orders/operations.server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){try{return NextResponse.json(await orderPanelPage(request.nextUrl.searchParams),{headers:privateOrderHeaders});}catch(e){return orderError(e);}}
export async function POST(request:NextRequest){try{const body=await orderBody(request,['order_id'],1024);return NextResponse.json(await privateOrderView(body.order_id),{headers:privateOrderHeaders});}catch(e){return orderError(e);}}
