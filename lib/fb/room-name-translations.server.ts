import 'server-only';
import dictionary from './bugan-room-names.json';
import {createAdminClient} from '../supabase/admin';
import {logWarningOnce} from '../env';
import {orderRpc} from './orders/rpc.server';
import type {Language} from './orders/journey';
import type {RoomNameRow} from './room-name-translations';

export async function loadBuganRoomNames(slug:string,hotelId:string,language:Language):Promise<RoomNameRow[]> {
  if(language==='pt'||slug!==dictionary.slug||hotelId!==dictionary.hotelId)return [];
  try {
    const rows=await orderRpc<RoomNameRow[]>(createAdminClient(),'get_bugan_room_text_translations',{
      p_hotel_id:hotelId,p_outlet_id:dictionary.outletId,
    });
    if(!Array.isArray(rows))throw Error('invalid');
    return rows;
  } catch {
    // Older database releases can still supply the existing saved names during rollout.
    try {
      const rows=await orderRpc<RoomNameRow[]>(createAdminClient(),'get_bugan_room_name_translations',{
        p_hotel_id:hotelId,p_outlet_id:dictionary.outletId,
      });
      if(Array.isArray(rows))return rows;
    } catch { /* Reviewed defaults remain available without changing ordering. */ }
    logWarningOnce('Room Service translations unavailable; reviewed defaults retained.');
    return [];
  }
}
