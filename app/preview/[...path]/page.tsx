import {notFound} from 'next/navigation';
import {getAuthenticatedHotelPreviewData} from '@/lib/authenticated-hotel-preview';
import {getAuthenticatedFlightPreview} from '@/lib/authenticated-flight-preview';
import {createClient} from '@/lib/supabase/server';
import {requireHotelModule} from '@/lib/admin-entitlements';
import {getRequestDomainContext} from '@/lib/domain-context';
import {normalizePublicLanguage} from '@/lib/public-language';
import {isPublicHotelAreaKey} from '@/lib/public-routes';
import {canRenderServiceDetailPage} from '@/lib/service-destinations';
import {loadPublicTourism} from '@/lib/tourism/public';
import {HotelPublicAreaContent} from '@/components/public/hotel-public-area-content';
import {HotelServiceDetailContent} from '@/components/public/hotel-service-detail-content';
import {HotelPublicFlightCenter} from '@/components/public/hotel-public-flight-center';
import {PublicTourismContent} from '@/components/public/public-tourism-content';
import {normalizePublicFlightCenterTab} from '@/lib/public-flight-center-copy';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};

export default async function PreviewDestination({params,searchParams}:{params:Promise<{path:string[]}>;searchParams:Promise<{lang?:string;tab?:string;type?:string;collection?:string;category?:string}>}){
 const {path}=await params,query=await searchParams,language=normalizePublicLanguage(query.lang);
 // Authorization precedes destination lookup. No hotel ID/slug is accepted from the request.
 const data=await getAuthenticatedHotelPreviewData(language);
 const domainContext={...await getRequestDomainContext(),navigationScope:'authenticated-preview' as const};
 if(path[0]==='servicos'&&path.length===2){
  const section=data.sections.find(s=>s.hotel_id===data.hotel.id&&s.id===path[1]&&s.enabled);
  if(!section||!canRenderServiceDetailPage(section))notFound();
  return <HotelServiceDetailContent hotel={data.hotel} section={section} language={language} domainContext={domainContext} experienceVersion={data.presentation?.experienceVersion} hasFallbackContent={data.serviceFallbackIds?.includes(section.id)??false} roomRestaurantState={section.service_action_type==='room_restaurant_menu'?'missing-context':null}/>;
 }
 if(path[0]!=='explorar'||path.length<2||path.length>3)notFound();
 const area=path[1];
 if(area==='voos'&&path.length===2){
  const flights=await getAuthenticatedFlightPreview(data);if(!flights)notFound();
  return <HotelPublicFlightCenter data={flights} language={language} domainContext={domainContext} preferSubdomainRoot={false} tab={normalizePublicFlightCenterTab(query.tab??'partidas')}/>;
 }
 if(!isPublicHotelAreaKey(area))notFound();
 if(area==='turismo'){
  await requireHotelModule('content.tourism');
  const tourism=await loadPublicTourism(await createClient(),data.hotel,language,path[2],true);
  if(!tourism||(path[2]&&!tourism.items.length))notFound();
  return <PublicTourismContent data={tourism} language={language} domainContext={domainContext} preferSubdomainRoot={false} detail={!!path[2]} filter={query.type} collection={query.collection} category={query.category}/>;
 }
 if(path.length!==2)notFound();
 return <HotelPublicAreaContent pageData={data} area={area} language={language} domainContext={domainContext} preferSubdomainRoot={false}/>;
}
