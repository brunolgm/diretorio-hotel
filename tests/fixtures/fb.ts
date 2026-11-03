import type { FbGraph } from '../../lib/fb/types';
import type { PublicHotelPageData,PublicHotelSection } from '../../lib/public-hotel-data';
import { emptyPresentation } from '../../lib/public-presentation.ts';
export const FB_IDENTITIES = [
 {key:'grand-mercure',name:'Grand Mercure Copacabana',theme:'grand-mercure'},
 {key:'novotel-leme',name:'Novotel Leme',theme:'novotel'},
 {key:'novotel-salvador',name:'Novotel Salvador Rio Vermelho',theme:'novotel'},
 {key:'mercure',name:'Mercure Rio Boutique Copacabana',theme:'mercure'},
 {key:'bugan',name:'Bugan Recife',theme:'bugan'},
 {key:'default',name:'Default técnico',theme:'midnight-slate'},
] as const;
/** Unique synthetic tenant and entity IDs. Never contains a production UUID/token. */
export function fbFixture(index:number,language:'pt'|'en'|'es'='pt'):PublicHotelPageData {
 const identity=FB_IDENTITIES[index];const id=(group:number)=>'53'+String(group).padStart(2,'0')+'0000-0000-4000-8000-'+String(index+1).padStart(12,'0');
 const hotelId=id(0);const base={hotel_id:hotelId,is_published:true,sort_order:0,revision:1,source_revision:1};
 const suffix={pt:'Fixture local',en:'Local fixture',es:'Fixture local'}[language];
 const sections:PublicHotelSection[]=[{id:id(10),hotel_id:hotelId,title:'Restaurante Filipe',content:'Conteúdo editorial sintético de restaurante suficientemente longo para preservar a rota interna do Serviço.',url:null,service_action_type:'standard',enabled:true,icon:'UtensilsCrossed',cta:null,category:'Restaurante',sort_order:0,created_at:null,updated_at:null},{id:id(11),hotel_id:hotelId,title:'Room Service',content:'Canal externo configurado pelo hotel.',url:index===4?'https://hotel-bugan.goomer.app/menu':'https://example.invalid/menu',service_action_type:'external_url',enabled:true,icon:'BellRing',cta:'Abrir cardápio',category:'Room Service',sort_order:1,created_at:null,updated_at:null}];
 const outlet={...base,id:id(1),name:index===4?'Restaurante Filipe':identity.name+' · '+suffix,type:'restaurant' as const,short_description:suffix,full_description:null,opening_hours:'12:00–14:30',location_info:null,main_image_path:null,is_featured:true,action_type:'service' as const,external_url:null};
 const graph:FbGraph={outlets:[outlet,{...outlet,id:id(2),name:'Room Service',type:'room_service',is_featured:false}],menus:[{...base,id:id(3),name:{pt:'Cardápio local',en:'Local menu',es:'Menú local'}[language],short_description:null}],categories:[{...base,id:id(4),menu_id:id(3),name:{pt:'Pratos',en:'Dishes',es:'Platos'}[language],description:null}],items:[{...base,id:id(5),category_id:id(4),name:{pt:'Item de fixture',en:'Fixture item',es:'Artículo de fixture'}[language],short_description:suffix,full_description:null,price_amount_minor:2590,currency:'BRL',price_on_request:false,allergens_info:null,dietary_info:null,is_available:true,main_image_path:null}],outlet_menus:[{hotel_id:hotelId,outlet_id:id(1),menu_id:id(3),sort_order:0},{hotel_id:hotelId,outlet_id:id(2),menu_id:id(3),sort_order:0}],service_links:[{hotel_id:hotelId,outlet_id:id(1),service_id:id(10)},{hotel_id:hotelId,outlet_id:id(2),service_id:id(11)}]};
 return {hotel:{id:hotelId,name:identity.name,slug:identity.key,subdomain:identity.key,theme_preset:identity.theme,theme_primary_color:null,city:'Fixture local',brand_code:identity.theme,logo_url:null,hero_image_url:null,booking_url:null,website_url:null,instagram_url:null,whatsapp_number:null,wifi_name:null,wifi_password:null,breakfast_hours:null,checkin_time:null,checkout_time:null},fb:graph,sections,layout:[{blockKey:'services',isEnabled:true,position:1},{blockKey:'quick_info',isEnabled:false,position:2},{blockKey:'contact',isEnabled:false,position:3}],presentation:{...emptyPresentation(),experienceVersion:'v4'},departments:[],policies:[],announcements:[],banners:[],flightHomeCard:null,hasFallbackContent:false};
}
