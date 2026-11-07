import type {PublicHotelPageData} from '@/lib/public-hotel-data';
import type {DomainContext} from '@/lib/domain-context';
import type {SupportedPublicLanguage} from '@/lib/public-language';
import {eligibleFbGraph,fbOutletDestination,fbPrice} from '@/lib/fb/public';
import {fbImageUrl} from '@/lib/fb/media';
import {PublicFbOutlets} from './public-fb-outlets';

export function PublicFbContent({pageData,language,domainContext,preferSubdomainRoot,premiumLayout=false}:{pageData:PublicHotelPageData;language:SupportedPublicLanguage;domainContext:DomainContext;preferSubdomainRoot:boolean;premiumLayout?:boolean}){
 const graph=eligibleFbGraph(pageData.fb,pageData.hotel.id);
 const outlets=(graph?.outlets??[]).map(outlet=>{
  const menuIds=new Set(graph!.outlet_menus.filter(l=>l.outlet_id===outlet.id).map(l=>l.menu_id));
  const categories=graph!.categories.filter(c=>menuIds.has(c.menu_id));
  const categoryIds=new Set(categories.map(c=>c.id));
  return {outlet,native:pageData.ordering?.outlets.find(o=>o.id===outlet.id),
   image:fbImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,outlet.main_image_path,pageData.hotel.id,'outlet',outlet.id),
   destination:fbOutletDestination(outlet,graph!,pageData.hotel,pageData.sections,language,domainContext,preferSubdomainRoot),
   menus:graph!.menus.filter(m=>menuIds.has(m.id)),categories,
   items:graph!.items.filter(i=>categoryIds.has(i.category_id)).map(item=>({...item,image:fbImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,item.main_image_path,pageData.hotel.id,'item',item.id),price:fbPrice(item,language)}))};
 });
 return <PublicFbOutlets outlets={outlets} language={language} slug={pageData.hotel.slug} hasRoomContext={pageData.ordering?.has_room_context===true} premium={pageData.presentation?.experienceVersion==='v4'} premiumLayout={premiumLayout}/>;
}
