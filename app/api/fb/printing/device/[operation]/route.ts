import type {NextRequest} from 'next/server';
import {devicePrintingHttp} from '@/lib/fb/printing/http.server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest,context:{params:Promise<{operation:string}>}){const {operation}=await context.params;return devicePrintingHttp(request,operation);}
