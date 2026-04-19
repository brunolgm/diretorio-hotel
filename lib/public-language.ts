export type SupportedPublicLanguage = 'pt' | 'en' | 'es';

export function normalizePublicLanguage(
  language?: string | null
): SupportedPublicLanguage {
  if (language === 'en' || language === 'es') {
    return language;
  }

  return 'pt';
}
