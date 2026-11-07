import 'server-only';
import type {PublicHotelPageData} from '../public-hotel-data';
import type {SupportedPublicLanguage} from '../public-language';
import {eligibleFbGraph} from './public.ts';

/** Read the existing offer only for an eligible V4 Home. Admission stays in the canonical RPC. */
export async function roomServiceHomeOffer(data:PublicHotelPageData,language:SupportedPublicLanguage){
 if(data.presentation?.experienceVersion!=='v4'||!data.layout.some(b=>b.blockKey==='services'&&b.isEnabled))return undefined;
 const graph=eligibleFbGraph(data.fb,data.hotel.id);
 if(!graph?.outlets.some(o=>o.type==='room_service'&&o.action_type!=='external_url'))return undefined;
 try{return await (await import('./orders/offer.server')).nativeOffer(data.hotel.slug,data.hotel.id,language);}
 catch{return undefined;} // A failed availability read leaves the menu accessible with a consultative CTA.
}
