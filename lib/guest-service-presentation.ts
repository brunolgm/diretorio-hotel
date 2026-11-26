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

export function readGuestServicePresentation(form: FormData): Json {
  const raw: Record<string, unknown> = { area: form.get('guest_area'), group: form.get('guest_group'), interaction: form.get('guest_interaction') };
  for (const field of GUEST_SERVICE_TEXT_FIELDS) raw[field] = Object.fromEntries(['pt', 'en', 'es'].map(lang => [lang, form.get(`guest_${field}_${lang}`)]));
  return parseGuestServicePresentation(raw) as Json;
}

export function guestServiceText(value: GuestServicePresentation, field: typeof GUEST_SERVICE_TEXT_FIELDS[number], language: Language) {
  return translatedText(value[field]?.pt || null, value[field]?.[language]);
}

export function guestServiceGroup(section: { category: string | null; icon: string | null; guest_presentation?: Json | null }, language: Language) {
  const config = parseGuestServicePresentation(section.guest_presentation);
  if (config.group && config.group !== 'original') return GUEST_SERVICE_GROUPS[config.group][language];
  if (config.group === 'original') return section.category || { pt: 'Outros serviços', en: 'Other services', es: 'Otros servicios' }[language];
  const category = normalizeGuestSearch(section.category);
  const group = /^(mobilidade|mobility|movilidad|estacionamento|parking|aparcamiento|transfer|transporte|transport)$/.test(category) ? 'mobility'
    : /^(lazer|leisure|ocio|bem-estar|wellness|well-being|bienestar|piscina|pool|swimming pool|academia|gym|gimnasio|fitness|spa|sauna)$/.test(category) ? 'wellness'
    : /^(conveniencia|convenience|comodidad|hospedagem|accommodation|alojamiento|lavanderia|laundry|lavadero|lavanderia|room service|servicio de habitaciones|utilidades|utilities)$/.test(category) ? 'comfort' : null;
  return group ? GUEST_SERVICE_GROUPS[group][language] : section.category || { pt: 'Outros serviços', en: 'Other services', es: 'Otros servicios' }[language];
}
