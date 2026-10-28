import { isOwnedTourismImagePath } from '../security/image-upload.ts';

export function tourismImageUrl(baseUrl: string | undefined, path: string | null, hotelId: string, itemId: string) {
  if (!baseUrl || !path || !isOwnedTourismImagePath(path, hotelId, itemId)) return null;
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) return null;
    if (url.username || url.password) return null;
    return `${url.origin}/storage/v1/object/public/hotel-assets/${path}`;
  } catch { return null; }
}
