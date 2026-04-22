import type { DomainContext } from '@/lib/domain-context';
import { buildPublicHotelServiceHref } from '@/lib/public-routes';
import type { Database } from '@/types/database';

type HotelSection = Database['public']['Tables']['hotel_sections']['Row'];

export const MIN_SERVICE_DETAIL_CONTENT_LENGTH = 60;

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
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
  language: 'pt' | 'en' | 'es',
  domainContext?: DomainContext | null
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
      href: buildPublicHotelServiceHref({
        slug: hotelSlug,
        serviceId: section.id,
        language,
        domainContext,
      }),
      isExternal: false,
    };
  }

  return null;
}
