import 'server-only';
import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {HotelPublicAreaContent} from '@/components/public/hotel-public-area-content';
import {OrderTracking} from '@/components/public/order-tracking';
import {getPublicHotelPageDataBySlug} from '../../public-hotel-data';
import {getRequestDomainContext} from '../../domain-context';
import {resolveHotelTheme} from '../../hotel-theme';
import {normalizePublicLanguage} from '../../public-language';
import {routeHotel} from './http.server';
import {uuid} from '../validation';
import {SmartMenuTracking} from '@/components/public/smartmenu-tracking';
import {buildRoomServiceHref} from '@/lib/public-routes';
export async function trackingPage(slug:string,id:string,lang?:string,smartMenu=false){
 if(!uuid(id))notFound();const host=(await headers()).get('host')||'';let hotel;
 try{hotel=await routeHotel(new Request('http://localhost',{headers:{host}}),slug);}catch{notFound();}
 const language=normalizePublicLanguage(lang);const data=await getPublicHotelPageDataBySlug(slug,language);const context=await getRequestDomainContext();
 if(data&&smartMenu)return <SmartMenuTracking hotel={data.hotel} id={id} language={language} menuHref={buildRoomServiceHref({slug,language,domainContext:context,preferSubdomainRoot:context.kind==='product-subdomain'})}/>;
 if(data)return <HotelPublicAreaContent pageData={{...data,trackingOrderId:id}} area="cardapio" language={language} domainContext={context} preferSubdomainRoot={context.kind==='product-subdomain'}/>;
 // Existing orders stay readable after lifecycle/module closure; no new public catalogue is opened.
 return <main style={resolveHotelTheme(hotel.theme_preset,hotel.theme_primary_color).cssVars} className="min-h-dvh bg-[var(--hotel-background)] px-4 py-8"><p className="mx-auto max-w-4xl text-xl text-[var(--hotel-text)]">{hotel.name}</p><OrderTracking slug={slug} id={id} language={language}/></main>;
}
