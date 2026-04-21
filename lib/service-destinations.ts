import type { Database } from '@/types/database';

type HotelSection = Database['public']['Tables']['hotel_sections']['Row'];

export const MIN_SERVICE_DETAIL_CONTENT_LENGTH = 60;

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildLanguageQuery(language: string) {
  return language === 'pt' ? '' : `?lang=${language}`;
}

export function hasEnoughInternalServiceDetailContent(content: string | null | undefined) {
  const normalized = normalizeText(content);
  return Boolean(normalized && normalized.length >= MIN_SERVICE_DETAIL_CONTENT_LENGTH);
}

export function canOpenInternalServiceDetail(
  section: Pick<HotelSection, 'content' | 'url'>
) {
  return !normalizeText(section.url) && hasEnoughInternalServiceDetailContent(section.content);
}

export function getServiceDestination(
  section: Pick<HotelSection, 'id' | 'content' | 'url'>,
  hotelSlug: string,
  language: string
) {
  const externalUrl = normalizeText(section.url);

  if (externalUrl) {
    return {
      kind: 'external' as const,
      href: externalUrl,
      isExternal: true,
    };
  }

  if (canOpenInternalServiceDetail(section)) {
    return {
      kind: 'internal' as const,
      href: `/hotel/${hotelSlug}/servicos/${section.id}${buildLanguageQuery(language)}`,
      isExternal: false,
    };
  }

  return null;
}
