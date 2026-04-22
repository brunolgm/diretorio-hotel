import type { DomainContext } from '@/lib/domain-context';
import type { SupportedPublicLanguage } from '@/lib/public-language';

function buildLanguageQuery(language: SupportedPublicLanguage) {
  return language === 'pt' ? '' : `?lang=${language}`;
}

export function buildHotelSlugHref(slug: string, language: SupportedPublicLanguage) {
  return `/hotel/${slug}${buildLanguageQuery(language)}`;
}

export function buildHotelServiceSlugHref(
  slug: string,
  serviceId: string,
  language: SupportedPublicLanguage
) {
  return `/hotel/${slug}/servicos/${serviceId}${buildLanguageQuery(language)}`;
}

export function buildPublicHotelHref({
  slug,
  language,
  domainContext,
  preferSubdomainRoot = false,
}: {
  slug: string;
  language: SupportedPublicLanguage;
  domainContext?: DomainContext | null;
  preferSubdomainRoot?: boolean;
}) {
  if (
    preferSubdomainRoot &&
    domainContext?.kind === 'product-subdomain' &&
    domainContext.isPotentialHotelSubdomain
  ) {
    return `/${buildLanguageQuery(language)}`;
  }

  return buildHotelSlugHref(slug, language);
}

export function buildPublicHotelServiceHref({
  slug,
  serviceId,
  language,
  domainContext,
  preferSubdomainRoot = false,
}: {
  slug: string;
  serviceId: string;
  language: SupportedPublicLanguage;
  domainContext?: DomainContext | null;
  preferSubdomainRoot?: boolean;
}) {
  if (
    preferSubdomainRoot &&
    domainContext?.kind === 'product-subdomain' &&
    domainContext.isPotentialHotelSubdomain
  ) {
    return `/servicos/${serviceId}${buildLanguageQuery(language)}`;
  }

  return buildHotelServiceSlugHref(slug, serviceId, language);
}
