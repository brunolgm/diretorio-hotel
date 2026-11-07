import {eligibleFbGraph} from './public.ts';
import {buildPublicHotelAreaHref} from '../public-routes.ts';
import type {PublicHotelPageData} from '../public-hotel-data';
import type {DomainContext} from '../domain-context';
import type {SupportedPublicLanguage} from '../public-language';

/** Uses the canonical eligible graph and server-projected native admission. */
export function roomServiceAccess(data:PublicHotelPageData,language:SupportedPublicLanguage,domainContext:DomainContext,preferSubdomainRoot:boolean){
 if(data.presentation?.experienceVersion!=='v4'||!data.layout.some(b=>b.blockKey==='services'&&b.isEnabled))return null;
 const graph=eligibleFbGraph(data.fb,data.hotel.id);
 const outlet=graph?.outlets.find(o=>o.type==='room_service'&&o.action_type!=='external_url'&&graph.outlet_menus.some(l=>l.outlet_id===o.id&&graph.categories.some(c=>c.menu_id===l.menu_id&&graph.items.some(i=>i.category_id===c.id))));
 if(!outlet)return null;
 const native=data.ordering?.outlets.find(o=>o.id===outlet.id);
 if(native?.hidden)return null;
 const order=Boolean(native?.available&&native.products.some(p=>p.available)&&(native.pickup||native.room_delivery&&data.ordering?.has_room_context));
 const cta={pt:{order:'Fazer pedido',menu:'Consultar cardápio'},en:{order:'Place an order',menu:'View menu'},es:{order:'Hacer pedido',menu:'Consultar menú'}}[language];
 return {key:'roomService' as const,label:'Room Service',cta:order?cta.order:cta.menu,href:buildPublicHotelAreaHref({slug:data.hotel.slug,language,domainContext,preferSubdomainRoot,area:'cardapio'})+'#outlet-'+outlet.id};
}
