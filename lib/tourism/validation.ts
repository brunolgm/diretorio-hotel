import { isTourismCategoryPair } from './catalog.ts';

export const TOURISM_TEXT_LIMITS = {
  name: 160, short_description: 500, full_description: 10000, address: 500,
  map_url: 2048, official_website_url: 2048, opening_hours: 1000,
  price_info: 300, duration_info: 200, phone: 16, whatsapp_number: 16,
} as const;
export const TOURISM_TRANSLATION_LIMITS = {
  name: 240, short_description: 750, full_description: 15000,
  opening_hours: 1500, price_info: 450, duration_info: 300,
} as const;
export const TOURISM_PHONE_PATTERN = /^\+[1-9][0-9]{1,14}$/;
const flags = ['featured', 'recommended_by_hotel', 'is_published'];

export function isTourismUrl(value: string): boolean {
  if (/[\u0000-\u0020\u007f\\]/u.test(value) || !/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
      && !url.username && !url.password && !value.split('/')[2]?.includes('@');
  } catch { return false; }
}

/** Pure boundary validation for future server actions; SQL remains authoritative. */
export function normalizeTourismPatch(input: unknown): Record<string, string | boolean | null> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('tourism_patch_invalid');
  const result: Record<string, string | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (flags.includes(key)) {
      if (typeof value !== 'boolean') throw new Error('tourism_boolean_required');
      result[key] = value;
      continue;
    }
    if (!Object.hasOwn(TOURISM_TEXT_LIMITS, key) && !['type', 'category_key'].includes(key)) throw new Error('tourism_field_not_writable');
    if (value !== null && typeof value !== 'string') throw new Error('tourism_text_required');
    if (typeof value === 'string' && /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/u.test(value)) throw new Error('tourism_plain_text_required');
    if (typeof value === 'string' && ['map_url', 'official_website_url'].includes(key) && /[\u0000-\u001f\u007f]/u.test(value)) throw new Error('tourism_url_invalid');
    const text = typeof value === 'string' ? value.trim() || null : null;
    if (['name', 'short_description', 'type', 'category_key'].includes(key) && !text) throw new Error('tourism_required_field');
    const limit = TOURISM_TEXT_LIMITS[key as keyof typeof TOURISM_TEXT_LIMITS];
    if (text && limit && [...text].length > limit) throw new Error('tourism_text_too_long');
    if (text && ['phone', 'whatsapp_number'].includes(key) && !TOURISM_PHONE_PATTERN.test(text)) throw new Error('tourism_phone_invalid');
    if (text && ['map_url', 'official_website_url'].includes(key) && !isTourismUrl(text)) throw new Error('tourism_url_invalid');
    result[key] = text;
  }
  if ('type' in result && 'category_key' in result && !isTourismCategoryPair(result.type, result.category_key)) throw new Error('tourism_category_invalid');
  return result;
}

/** Preview only: the database generates and reserves the final slug. */
export function tourismSlugBase(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/g, '') || 'item';
}
