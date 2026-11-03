import {type NextRequest} from 'next/server';
import {handleOrderHotel} from '@/lib/fb/orders/http.server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{slug:string;operation:string}>}){const p=await params;return handleOrderHotel(request,p.slug,p.operation);}
export const POST=GET;
