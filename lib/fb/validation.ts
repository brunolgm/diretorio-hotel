import { OUTLET_TYPES, type FbKind } from './types.ts';
import { fbCurrencyDigits } from './currencies.ts';

export const FB_TEXT_FIELDS = {
  outlet: ['name', 'short_description', 'full_description', 'opening_hours', 'location_info'],
  menu: ['name', 'short_description'], category: ['name', 'description'],
  item: ['name', 'short_description', 'full_description', 'allergens_info', 'dietary_info'],
} as const;
export const FB_FIELDS = {
  outlet: [...FB_TEXT_FIELDS.outlet, 'type', 'is_featured', 'action_type', 'external_url', 'service_id', 'menu_ids', 'is_published', 'sort_order'],
  menu: [...FB_TEXT_FIELDS.menu, 'is_published', 'sort_order'],
  category: [...FB_TEXT_FIELDS.category, 'menu_id', 'is_published', 'sort_order'],
  item: [...FB_TEXT_FIELDS.item, 'category_id', 'price_amount_minor', 'currency', 'price_on_request', 'is_available', 'is_published', 'sort_order'],
} as const;
export const FB_FLAGS = ['is_featured', 'is_available', 'price_on_request', 'is_published'];
export function safeFbUrl(value: string): boolean {
  if (value.length > 2048 || /[\u0000-\u0020\u007f\\]/u.test(value)) return false;
  try { const u = new URL(value); return u.protocol === 'https:' && /^[a-z0-9][a-z0-9.-]*$/i.test(u.hostname) && !u.username && !u.password && !value.split('/')[2]?.includes('@'); } catch { return false; }
}
export function fbTextLimit(key: string) { return key === 'name' ? 160 : key === 'full_description' ? 10000 : key === 'external_url' ? 2048 : key === 'short_description' ? 500 : 1000; }
/** Editor decimal value to minor units, without floating point or order calculations. */
export function parseFbPrice(value:unknown,currency='BRL'):number|null {
  if(value===null||value==='')return null;
  const digits=fbCurrencyDigits(currency);
  if(typeof value!=='string'||!/^\d{1,9}(?:[,.]\d{1,3})?$/.test(value.trim()))throw new Error('fb_integer_required');
  const [whole,fraction='']=value.trim().split(/[,.]/);
  if(fraction.length>digits)throw new Error('fb_integer_required');
  const minor=Number(whole)*10**digits+Number(fraction.padEnd(digits,'0'));
  if(minor>100000000)throw new Error('fb_integer_required');return minor;
}
export function fbPriceInput(minor:number|null,currency='BRL') { const digits=fbCurrencyDigits(currency),unit=10**digits; return minor===null?'':String(Math.trunc(minor/unit))+(digits?','+String(minor%unit).padStart(digits,'0'):''); }
export function normalizeFbPatch(kind: FbKind, input: Record<string, unknown>) {
  const result: Record<string, string | number | boolean | null | string[]> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(FB_FIELDS[kind] as readonly string[]).includes(key)) throw new Error('fb_field_not_writable');
    if (FB_FLAGS.includes(key)) { if (typeof value !== 'boolean') throw new Error('fb_boolean_required'); result[key] = value; continue; }
    if (key === 'menu_ids') { if (!Array.isArray(value) || value.length > 100 || new Set(value).size !== value.length || value.some(v => typeof v !== 'string' || !uuid(v))) throw new Error('fb_menus_invalid'); result[key] = value; continue; }
    if (key === 'sort_order' || key === 'price_amount_minor') { if (value === null && key === 'price_amount_minor') { result[key] = null; continue; } if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > (key === 'sort_order' ? 100000 : 100000000)) throw new Error('fb_integer_required'); result[key] = value; continue; }
    if (value !== null && typeof value !== 'string') throw new Error('fb_text_required');
    const text = typeof value === 'string' ? value.trim() || null : null;
    if (text && ([...text].length > fbTextLimit(key) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/u.test(text))) throw new Error('fb_text_invalid');
    if (key === 'name' && !text) throw new Error('fb_name_required');
    if (text && ['service_id', 'menu_id', 'category_id'].includes(key) && !uuid(text)) throw new Error('fb_id_invalid');
    if (text && key === 'external_url' && !safeFbUrl(text)) throw new Error('fb_url_invalid');
    if (key === 'type' && !OUTLET_TYPES.includes(text as typeof OUTLET_TYPES[number])) throw new Error('fb_type_invalid');
    if (key === 'action_type' && !['none', 'service', 'external_url'].includes(text || '')) throw new Error('fb_action_invalid');
    if (key === 'currency') fbCurrencyDigits(text || '');
    result[key] = key === 'external_url' && text ? new URL(text).toString() : text;
  }
  if (result.price_on_request === true && result.price_amount_minor != null) throw new Error('fb_price_conflict');
  return result;
}
export function uuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export function fbFormPatch(kind: FbKind, form: FormData) {
  const input: Record<string, unknown> = {};
  for (const key of FB_FIELDS[kind]) {
    if (FB_FLAGS.includes(key)) input[key] = form.get(key) === 'on';
    else if (key === 'menu_ids') input[key] = form.getAll(key);
    else if (key === 'price_amount_minor') input[key]=form.get('price_on_request')==='on'?null:parseFbPrice(form.get(key),String(form.get('currency')||'BRL').trim());
    else if (key === 'sort_order') { const value = form.get(key); input[key] = value === '' || value === null ? 0 : Number(value); }
    else input[key] = form.get(key) || null;
  }
  if (kind === 'outlet') { if(input.action_type!=='service')input.service_id=null; if(input.action_type!=='external_url')input.external_url=null; }
  if (input.price_on_request === true) input.price_amount_minor=null;
  return normalizeFbPatch(kind, input);
}
export function fbAdminError(error: { code?: string; message?: string }) {
  if (error.code === 'PT409' || error.message === 'fb_revision_conflict') return 'Este conteúdo mudou. Recarregue a página antes de tentar novamente.';
  if (error.code === '42501') return 'Seu acesso ou o módulo mudou. Recarregue a página.';
  if (error.code === 'P0002') return 'Conteúdo não encontrado para este hotel.';
  if (error.code === '23503') return 'A associação não existe ou pertence a outro hotel.';
  return 'Não foi possível salvar. Confira campos obrigatórios, preço, URL e associações.';
}
