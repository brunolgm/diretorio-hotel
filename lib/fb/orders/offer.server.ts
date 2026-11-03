import 'server-only';
import {cookies} from 'next/headers';
import {createAdminClient} from '../../supabase/admin';
import {fbImageUrl} from '../media';
import {ROOM_CONTEXT_COOKIE_NAME,parseRoomContext} from '../../room-context';
import {isRoomToken} from '../../security/identifiers';
import {orderRpc} from './rpc.server';
import type {Language,NativeOffer,NativeOutlet,Product} from './journey';

export async function nativeOffer(slug:string,hotelId:string,language:Language):Promise<NativeOffer>{
 const client=createAdminClient();
 const raw=await orderRpc<{outlets:NativeOutlet[]}> (client,'get_fb_order_offer',{p_hotel_slug:slug,p_language:language});
 // A path is resolved against ownership; arbitrary catalogue URLs cannot enter the client DTO.
 function product(p:Product&{image_path?:string|null}):Product{return {...p,image_url:p.kind==='item'?fbImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,p.image_path||null,hotelId,'item',p.id):null,slots:p.slots?.map(s=>({...s,choices:s.choices.map(c=>({...c,item:product(c.item)}))}))};}
 const outlets=(raw?.outlets||[]).map(o=>({...o,image_url:fbImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,(o as NativeOutlet&{image_path?:string}).image_path||null,hotelId,'outlet',o.id),products:o.products.map(product)}));
 return {outlets,has_room_context:await validRoomContext(hotelId)};
}
export async function validRoomContext(hotelId:string){
 const context=parseRoomContext((await cookies()).get(ROOM_CONTEXT_COOKIE_NAME)?.value);
 if(!context?.roomToken||!isRoomToken(context.roomToken))return false;
 const client=createAdminClient();
 const [link,module]=await Promise.all([client.from('hotel_room_links').select('id,hotels!inner(platform_status)').eq('hotel_id',hotelId).eq('room_token',context.roomToken).eq('is_active',true).eq('hotels.platform_status','active').maybeSingle(),client.rpc('is_hotel_module_enabled',{p_hotel_id:hotelId,p_module_key:'rooms.qr'})]);
 return !link.error&&!!link.data&&!module.error&&module.data===true;
}
