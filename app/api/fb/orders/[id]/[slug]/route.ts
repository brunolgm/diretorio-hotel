import {type NextRequest} from 'next/server';
import {handleOrderTracking} from '@/lib/fb/orders/http.server';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string;slug:string}>}){const p=await params;return handleOrderTracking(request,p.slug,p.id);}
export const POST=GET;
