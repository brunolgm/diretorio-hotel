import type { DomainContext } from '@/lib/domain-context';
import { buildPublicHotelServiceHref } from '@/lib/public-routes';
import { normalizeServiceActionType } from '@/lib/service-action-types';
import type { Database } from '@/types/database';

type HotelSection = Database['public']['Tables']['hotel_sections']['Row'];

export const MIN_SERVICE_DETAIL_CONTENT_LENGTH = 60;

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function serviceExternalHref(href: string, hotelSlug: string, language: 'pt' | 'en' | 'es') {
  // Limit the pilot fix to Bugan's own SmartMenu; other configured links stay intact.
  if (hotelSlug !== 'bugan-recife') return href;
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return href;
    const ownSubdomain = ['buganrecife.libguest.digital', 'buganrecife.guestdesk.digital'].includes(url.hostname)
      && /^\/room-service\/?$/.test(url.pathname);
    const ownSlugRoute = ['libguest.digital', 'guestdesk.digital'].includes(url.hostname)
      && /^\/hotel\/bugan-recife\/room-service\/?$/.test(url.pathname);
    if (!ownSubdomain && !ownSlugRoute) return href;
    url.searchParams.set('lang', language);
    return url.toString();
  } catch {
    return href;
  }
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

export function canRenderServiceDetailPage(
  section: Pick<HotelSection, 'content' | 'url' | 'service_action_type'>
) {
  const actionType = normalizeServiceActionType(section.service_action_type);

  if (actionType === 'room_restaurant_menu') {
    return true;
  }

  return canOpenInternalServiceDetail(section);
}

export function getServiceDestination(
  section: Pick<HotelSection, 'id' | 'content' | 'url' | 'service_action_type'>,
  hotelSlug: string,
  language: 'pt' | 'en' | 'es',
  domainContext?: DomainContext | null,
  options?: {
    preferSubdomainRoot?: boolean;
  }
) {
  const actionType = normalizeServiceActionType(section.service_action_type);
  const externalUrl = normalizeText(section.url);

  if (actionType === 'external_url') {
    if (!externalUrl) {
      return null;
    }

    return {
      kind: 'external' as const,
      href: serviceExternalHref(externalUrl, hotelSlug, language),
      isExternal: true,
    };
  }

  if (actionType === 'room_restaurant_menu') {
    return {
      kind: 'room-restaurant-menu' as const,
      href: buildPublicHotelServiceHref({
        slug: hotelSlug,
        serviceId: section.id,
        language,
        domainContext,
        preferSubdomainRoot: options?.preferSubdomainRoot,
      }),
      isExternal: false,
    };
  }

  if (externalUrl) {
    return {
      kind: 'external' as const,
      href: serviceExternalHref(externalUrl, hotelSlug, language),
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
        preferSubdomainRoot: options?.preferSubdomainRoot,
      }),
      isExternal: false,
    };
  }

  return null;
}
