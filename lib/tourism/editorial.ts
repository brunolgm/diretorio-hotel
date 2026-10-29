import type {PublicPresentation} from '../public-presentation';
import {editorialText} from '../public-presentation.ts';
import type {PublicTourismItem} from './public';
import {buildPublicHotelAreaHref,buildPublicHotelTourismItemHref} from '../public-routes.ts';
import type {DomainContext} from '../domain-context';
type Card=PublicPresentation['tourism']['cards'][number];
type Route={slug:string;language:'pt'|'en'|'es';domainContext:DomainContext;preferSubdomainRoot:boolean};
export function publishedTourism(items:PublicTourismItem[],hotelId:string){return items.filter(i=>i.hotel_id===hotelId&&i.is_published);}
export function tourismEditorialHref(card:Card,items:PublicTourismItem[],hotelId:string,route:Route){
 const own=publishedTourism(items,hotelId),d=card.destination;
 if(!d)return buildPublicHotelAreaHref({...route,area:'turismo'});
 if(d.kind==='item')return own.some(i=>i.slug===d.slug)?buildPublicHotelTourismItemHref({...route,itemSlug:d.slug}):null;
 if(!own.some(i=>d.item_slugs.includes(i.slug)))return null;
 const base=buildPublicHotelAreaHref({...route,area:'turismo'});
 return base+(base.includes('?')?'&':'?')+'collection='+encodeURIComponent(d.key);
}
export function tourismCollection(presentation:PublicPresentation|null|undefined,key:string|undefined,items:PublicTourismItem[],hotelId:string,language:'pt'|'en'|'es'){
 const own=publishedTourism(items,hotelId);
 if(!key)return {items:own,title:null,description:null,found:true};
 const card=presentation?.tourism.cards.find(c=>c.destination?.kind==='collection'&&c.destination.key===key);
 if(!card||card.destination?.kind!=='collection')return {items:[],title:null,description:null,found:false};
 const destination=card.destination;
 return {items:own.filter(i=>destination.item_slugs.includes(i.slug)),title:editorialText(card.title,language),description:editorialText(destination.description,language),found:true};
}
export function tourismHasUsefulDetails(i:PublicTourismItem){
 return !!((i.full_description?.trim()&&i.full_description.trim()!==i.short_description.trim())||i.address||i.map_url||i.official_website_url||i.phone||i.whatsapp_number||i.opening_hours||i.price_info||i.duration_info||i.main_image_path);
}
