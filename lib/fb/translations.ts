import { FB_TEXT_FIELDS } from './validation.ts';
import type { FbKind, FbBase, FbRecord, FbTranslation } from './types.ts';
export type FbText = Record<string, string | null>;
export function fbTranslationFields(kind: FbKind, source: object): FbText {
  const row = source as Record<string, unknown>;
  return Object.fromEntries(FB_TEXT_FIELDS[kind].map(key => [key, typeof row[key] === 'string' ? row[key] : null]));
}
export function fbTranslationStatus(kind: FbKind, source: FbBase, translated?: FbTranslation) {
  const keys = Object.entries(fbTranslationFields(kind, source)).filter(([, value]) => value?.trim()).map(([key]) => key);
  const count = translated?.source_revision === source.source_revision && translated.entity_id === source.id && translated.hotel_id === source.hotel_id ? keys.filter(key => translated.fields[key]?.trim()).length : 0;
  return !count ? 'Ausente' : count === keys.length ? 'Completo' : 'Parcial';
}
export async function syncFbTranslations(kind: FbKind, row: FbRecord, io: {
  languagesEnabled(): Promise<boolean>; translate(fields: FbText, language: 'en'|'es'): Promise<FbText|null>;
  save(language: 'en'|'es', revision: number, fields: FbText): Promise<boolean>;
}) {
  if (!await io.languagesEnabled()) return { en: 'skipped', es: 'skipped' };
  const outcomes = await Promise.all((['en','es'] as const).map(async language => {
    try {
      const fields = await io.translate(fbTranslationFields(kind, row), language);
      if (!fields) return 'failed';
      const safe = fbTranslationFields(kind, fields);
      const required = Object.entries(fbTranslationFields(kind, row)).filter(([,v]) => v?.trim());
      if (required.some(([key]) => !safe[key]?.trim())) return 'failed';
      return await io.save(language, row.source_revision, safe) ? 'complete' : 'stale';
    } catch { return 'failed'; }
  }));
  return { en: outcomes[0], es: outcomes[1] };
}
