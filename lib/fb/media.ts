import type { FbKind } from './types.ts';
import { uuid } from './validation.ts';
export function isOwnedFbImagePath(path: string, hotelId: string, kind: FbKind, id: string) {
  if (!['outlet','item'].includes(kind) || !uuid(hotelId) || !uuid(id) || path.length > 512) return false;
  const prefix = hotelId + '/fb/' + kind + '/' + id + '/';
  const leaf = path.startsWith(prefix) ? path.slice(prefix.length) : '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(leaf);
}
export function fbImageUrl(baseUrl: string|undefined, path: string|null, hotelId: string, kind: FbKind, id: string) {
  if (!baseUrl || !path || !isOwnedFbImagePath(path, hotelId, kind, id)) return null;
  try { const u = new URL(baseUrl); if ((u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname))) || u.username || u.password) return null; return u.origin + '/storage/v1/object/public/hotel-assets/' + path; } catch { return null; }
}
export async function cleanupFbImage(io: {remove(path:string):Promise<{error:unknown}>;log(operation:string,path:string|null):void}, hotelId:string, kind:FbKind, id:string, path:string|null, current:string|null) {
  if (!path || path === current) return true;
  if (!isOwnedFbImagePath(path,hotelId,kind,id)) { io.log('cleanup_refused_invalid_ownership',path); return false; }
  for (let i=0;i<2;i++) { try { if (!(await io.remove(path)).error) return true; } catch {} }
  io.log('cleanup_failed_after_two_attempts',path); return false;
}
