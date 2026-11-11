import {notFound} from 'next/navigation';
import {getRequestDomainContext} from '@/lib/domain-context';
import {createAdminClient} from '@/lib/supabase/admin';
import {trackingPage} from '@/lib/fb/orders/tracking-page.server';
export const dynamic='force-dynamic';
export const metadata={title:'LibGuest · Pedido',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{lang?:string;smartmenu?:string}>}){
 const domain=await getRequestDomainContext();if(domain.kind!=='product-subdomain'||!domain.subdomain)notFound();
 const {data}=await createAdminClient().from('hotels').select('slug').eq('subdomain',domain.subdomain).maybeSingle();if(!data?.slug)notFound();return trackingPage(data.slug,(await params).id,(await searchParams).lang,(await searchParams).smartmenu==='1');
}
