import type { Database } from '../types/database';

export const EXPERIENCE_MEDIA_SLOTS = ['hero', 'about', 'restaurant', 'accommodation'] as const;
// Leave multipart/text overhead below the existing 3 MiB Server Action limit.
export const EXPERIENCE_MEDIA_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
export type ExperienceMediaSlot = typeof EXPERIENCE_MEDIA_SLOTS[number];
export type ExperienceMedia = Database['public']['Tables']['hotel_public_experience_media']['Row'];
export function isExperienceMediaSlot(value: unknown): value is ExperienceMediaSlot {
  return EXPERIENCE_MEDIA_SLOTS.includes(value as ExperienceMediaSlot);
}
export function ownedExperienceMediaPath(path: string, hotelId: string, slot: ExperienceMediaSlot) {
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  return new RegExp(`^${uuid}$`).test(hotelId) && new RegExp(`^${hotelId}/hero/${slot}/${uuid}\\.(jpg|png|webp)$`).test(path);
}
export function experienceHttpsUrl(value: string | null | undefined) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function experienceMediaUrl(path: string | null, hotelId: string, slot: ExperienceMediaSlot, baseUrl: string) {
  if (!path || !ownedExperienceMediaPath(path, hotelId, slot)) return null;
  try {
    const base = new URL(baseUrl);
    if (base.username || base.password || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)))) return null;
    return `${base.origin}/storage/v1/object/public/hotel-assets/${path}`;
  } catch { return null; }
}
export function focalPosition(x: number, y: number) {
  const clamp = (n: number) => Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
  return `${clamp(x)}% ${clamp(y)}%`;
}

/** Delete only after a confirmed DB association. Uncertain responses retain all files. */
export async function cleanupExperienceMedia({ hotelId, slot, paths, currentPaths, remove, log }: {
  hotelId: string; slot: ExperienceMediaSlot; paths: (string | null)[]; currentPaths: (string | null)[];
  remove: (path: string) => Promise<{ error: unknown }>; log: (path: string) => void;
}) {
  let cleaned = true;
  for (const path of new Set(paths)) {
    if (!path || currentPaths.includes(path)) continue;
    if (!ownedExperienceMediaPath(path, hotelId, slot)) { cleaned = false; log(path); continue; }
    let success = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { if (!(await remove(path)).error) { success = true; break; } } catch { /* bounded retry */ }
    }
    if (!success) { cleaned = false; log(path); }
  }
  return cleaned;
}

export type ExperienceMediaTranslation = Partial<Record<'title'|'description'|'alt_text'|'cta_label',string|null>>;
const MEDIA_TEXT_FIELDS = ['title','description','alt_text','cta_label'] as const;
export function localizeExperienceMedia(source: ExperienceMedia, translation?: ExperienceMediaTranslation | null): ExperienceMedia {
 const result={...source};
 for(const field of MEDIA_TEXT_FIELDS) if(translation?.[field]?.trim()) result[field]=translation[field]!;
 return result;
}
export function experienceMediaHasFallback(source: ExperienceMedia, translation?: ExperienceMediaTranslation | null) {
 return MEDIA_TEXT_FIELDS.some(field=>Boolean(source[field]?.trim())&&!translation?.[field]?.trim());
}
