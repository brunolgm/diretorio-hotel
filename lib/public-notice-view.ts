import type {PublicHotelAnnouncement} from './public-hotel-data';
/** Only public notice identity and revision; no guest or room information. */
export function publicNoticeKey(row: Pick<PublicHotelAnnouncement,'hotel_id'|'id'|'updated_at'|'starts_at'|'ends_at'>) {
 return JSON.stringify([row.hotel_id,row.id,row.updated_at,row.starts_at,row.ends_at]);
}
export function dismissedNoticeKeys(raw:string) : string[] {
 try { const value:unknown=JSON.parse(raw);return Array.isArray(value)?value.filter((key):key is string=>typeof key==='string').slice(-50):[]; } catch { return []; }
}
