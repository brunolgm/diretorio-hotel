import 'server-only';
import scope from './bugan-room-names.json' with {type:'json'};
import {createAdminClient} from '../supabase/admin';
import {logWarningOnce} from '../env';
import {orderRpc} from './orders/rpc.server';
import {parseRoomServiceHours} from './room-service-hours';

export async function loadBuganRoomServiceHours(slug:string,hotelId:string){
  if(slug!==scope.slug||hotelId!==scope.hotelId)return;
  try{return parseRoomServiceHours(await orderRpc<unknown>(createAdminClient(),'get_bugan_room_service_hours',{
    p_hotel_id:hotelId,p_outlet_id:scope.outletId,
  }));}catch{logWarningOnce('Room Service hours display unavailable; ordering calendar retained.');}
}
