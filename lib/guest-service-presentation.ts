import { translatedText } from './translation-fallback.ts';
import type { Json } from '../types/database';

export const GUEST_SERVICE_GROUPS = {
  comfort: { pt: 'Conforto e conveniência', en: 'Comfort and convenience', es: 'Confort y comodidad' },
  wellness: { pt: 'Lazer e bem-estar', en: 'Leisure and wellbeing', es: 'Ocio y bienestar' },
  mobility: { pt: 'Mobilidade', en: 'Getting around', es: 'Movilidad' },
} as const;
export const GUEST_SERVICE_AREAS = ['services', 'information', 'hotel', 'dining', 'contact'] as const;
export const GUEST_SERVICE_INTERACTIONS = ['auto', 'inline', 'detail', 'page', 'external', 'assistance', 'guide'] as const;
export const GUEST_SERVICE_TEXT_FIELDS = ['summary', 'hours', 'location', 'conditions'] as const;
export const GUEST_SERVICE_MAX_BYTES = 20000;
type Language = 'pt' | 'en' | 'es';
export type GuestServicePresentation = {
  area?: typeof GUEST_SERVICE_AREAS[number];
  group?: keyof typeof GUEST_SERVICE_GROUPS | 'original';
  interaction?: typeof GUEST_SERVICE_INTERACTIONS[number];
} & Partial<Record<typeof GUEST_SERVICE_TEXT_FIELDS[number], Partial<Record<Language, string>>>>;

export function normalizeGuestSearch(value: string | null | undefined) {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Allowlisted presentation only. Never accepts a destination, token or operational capability. */
export function parseGuestServicePresentation(value: unknown): GuestServicePresentation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>, result: GuestServicePresentation = {};
  if (GUEST_SERVICE_AREAS.includes(raw.area as never)) result.area = raw.area as GuestServicePresentation['area'];
  if (['comfort', 'wellness', 'mobility', 'original'].includes(String(raw.group))) result.group = raw.group as GuestServicePresentation['group'];
  if (GUEST_SERVICE_INTERACTIONS.includes(raw.interaction as never)) result.interaction = raw.interaction as GuestServicePresentation['interaction'];
  for (const field of GUEST_SERVICE_TEXT_FIELDS) {
    const text = raw[field];
    if (text && typeof text === 'object' && !Array.isArray(text)) {
      result[field] = {};
      for (const language of ['pt', 'en', 'es'] as const) {
        const entry = (text as Record<string, unknown>)[language];
        if (typeof entry === 'string' && entry.trim()) result[field]![language] = entry.trim().slice(0, field === 'conditions' ? 4000 : 300);
      }
    }
  }
  return result;
}

export function readGuestServicePresentation(form: FormData, previous?: unknown): Json {
  const raw: Record<string, unknown> = { area: form.get('guest_area'), group: form.get('guest_group'), interaction: form.get('guest_interaction') };
  const existing=parseGuestServicePresentation(previous);
  for (const field of GUEST_SERVICE_TEXT_FIELDS) raw[field] = Object.fromEntries((['pt', 'en', 'es'] as const).map(lang => [lang, form.has(`guest_${field}_${lang}`)?form.get(`guest_${field}_${lang}`):existing[field]?.[lang]]));
  return parseGuestServicePresentation(raw) as Json;
}

export function guestServicePresentationFits(value: Json) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <= GUEST_SERVICE_MAX_BYTES;
}

export function guestServiceText(value: GuestServicePresentation, field: typeof GUEST_SERVICE_TEXT_FIELDS[number], language: Language) {
  return translatedText(value[field]?.pt || null, value[field]?.[language]);
}

export function guestServiceGroup(section: { title?: string; category: string | null; icon: string | null; guest_presentation?: Json | null }, language: Language) {
  const config = parseGuestServicePresentation(section.guest_presentation);
  if (config.group && config.group !== 'original') return GUEST_SERVICE_GROUPS[config.group][language];
  if (config.group === 'original') return section.category || { pt: 'Outros serviços', en: 'Other services', es: 'Otros servicios' }[language];
  const category = normalizeGuestSearch(section.category);
  if (category === 'estrutura' && /^(estacionamento|parking|aparcamiento)$/.test(normalizeGuestSearch(section.title))) return GUEST_SERVICE_GROUPS.mobility[language];
  const group = /^(mobilidade|mobility|movilidad|estacionamento|parking|aparcamiento|transfer|transporte|transport|transporte e estacionamento)$/.test(category) ? 'mobility'
    : /^(lazer|lazer e bem-estar|leisure|ocio|bem-estar|wellness|well-being|bienestar|piscina|pool|swimming pool|academia|gym|gimnasio|fitness|spa|sauna)$/.test(category) ? 'wellness'
    : /^(conveniencia|convenience|comodidad|hospedagem|servicos da estadia|no apartamento|accommodation|alojamiento|lavanderia|laundry|lavadero|room service|servicio de habitaciones|utilidades|utilities)$/.test(category) ? 'comfort' : null;
  return group ? GUEST_SERVICE_GROUPS[group][language] : section.category || { pt: 'Outros serviços', en: 'Other services', es: 'Otros servicios' }[language];
}

/** One contract for public rendering and Admin preview. Visual choices never grant operations. */
export function guestServiceInteraction(config: ReturnType<typeof parseGuestServicePresentation>, section: { content: string | null; service_action_type: string }, destination: { href: string; isExternal: boolean } | null, guide: boolean, conditions: string | null): 'inline' | 'detail' | 'page' {
  if (guide || section.service_action_type === 'room_restaurant_menu') return destination ? 'page' : 'inline';
  if (config.interaction === 'inline') return 'inline';
  if (config.interaction === 'detail' || config.interaction === 'assistance') return 'detail';
  if (destination && (destination.isExternal || ['page', 'external', 'guide'].includes(config.interaction || ''))) return 'page';
  return (section.content?.length || 0) > 110 || conditions ? 'detail' : 'inline';
}

/** Recognizes only this tenant's canonical route, never another hotel's route or a provider. */
export function isOwnRoomServiceLink(href: string | null, hotel: {slug:string;subdomain?:string|null}, root: string) {
  if (!href) return false;
  try {
    const url = new URL(href, 'https://guest.invalid');
    if (url.username || url.password || url.port || url.hash || [...url.searchParams.keys()].some(k => k !== 'lang')) return false;
    const subdomain = hotel.subdomain;
    if (url.hostname === 'guest.invalid' && href.startsWith('/') && !href.startsWith('//')) return url.pathname === `/hotel/${hotel.slug}/room-service` || url.pathname === '/room-service';
    return url.protocol === 'https:' && ((subdomain && url.hostname === `${subdomain}.${root}` && /^\/room-service\/?$/.test(url.pathname)) || (url.hostname === root && url.pathname === `/hotel/${hotel.slug}/room-service`));
  } catch { return false; }
}
