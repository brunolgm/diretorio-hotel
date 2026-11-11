import {trackingPage} from '@/lib/fb/orders/tracking-page.server';
export const dynamic='force-dynamic';
export const metadata={title:'LibGuest · Pedido',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params,searchParams}:{params:Promise<{slug:string;id:string}>;searchParams:Promise<{lang?:string;smartmenu?:string}>}){const p=await params;return trackingPage(p.slug,p.id,(await searchParams).lang,(await searchParams).smartmenu==='1');}
