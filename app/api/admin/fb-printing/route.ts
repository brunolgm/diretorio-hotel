import type {NextRequest} from 'next/server';
import {adminPrintingHttp} from '@/lib/fb/printing/http.server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){return adminPrintingHttp(request);}
