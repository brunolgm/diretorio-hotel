export const TOURISM_TRANSLATABLE_FIELDS = [
  'name', 'short_description', 'full_description', 'opening_hours', 'price_info', 'duration_info',
] as const;

export type TourismTranslationFields = Record<typeof TOURISM_TRANSLATABLE_FIELDS[number], string | null>;
export type TourismTranslationStatus = 'missing' | 'partial' | 'complete';

/** Explicit runtime allowlist: callers may supply the full database row. */
export function tourismTranslationFields(source: TourismTranslationFields): TourismTranslationFields {
  return {
    name: source.name, short_description: source.short_description,
    full_description: source.full_description, opening_hours: source.opening_hours,
    price_info: source.price_info, duration_info: source.duration_info,
  };
}

export function getTourismTranslationStatus(
  source: TourismTranslationFields,
  translation?: Partial<TourismTranslationFields> | null,
): TourismTranslationStatus {
  const required = TOURISM_TRANSLATABLE_FIELDS.filter((field) => source[field]?.trim());
  const translated = required.filter((field) => translation?.[field]?.trim());
  if (!translated.length) return 'missing';
  return translated.length === required.length ? 'complete' : 'partial';
}

export const TOURISM_TRANSLATION_STATUS_LABELS = {
  missing: 'Ausente', partial: 'Parcial', complete: 'Completo',
} as const;

export function summarizeTourismTranslations(
  items: Array<TourismTranslationFields & { id: string }>,
  translations: Array<Partial<TourismTranslationFields> & { item_id: string; language: string }>,
) {
  return items.map((item) => ({
    id: item.id, name: item.name,
    en: getTourismTranslationStatus(item, translations.find((row) => row.item_id === item.id && row.language === 'en')),
    es: getTourismTranslationStatus(item, translations.find((row) => row.item_id === item.id && row.language === 'es')),
  }));
}
