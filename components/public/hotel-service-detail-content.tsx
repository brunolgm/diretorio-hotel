import { ArrowLeft, CheckCircle2, Hotel, MapPin, Sparkles } from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { GrandMercureMobileNavigation } from '@/components/public/grand-mercure/grand-mercure-mobile-navigation';
import { GrandMercureGlobalMandala } from '@/components/public/grand-mercure/grand-mercure-ornament';
import { NovotelHeroBackdrop } from '@/components/public/novotel/novotel-hero-backdrop';
import { PublicAnalytics } from '@/components/public/public-analytics';
import { ServiceIcon } from '@/components/service-icon';
import type { DomainContext } from '@/lib/domain-context';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getPublicCopy } from '@/lib/public-copy';
import type { PublicHotel, PublicHotelSection } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { buildPublicHotelAreaHref, buildPublicHotelHref, shouldPreferHotelSubdomainRoot } from '@/lib/public-routes';
import { MIN_SERVICE_DETAIL_CONTENT_LENGTH } from '@/lib/service-destinations';

type RoomRestaurantState = 'missing-context' | 'missing-menu' | 'invalid-context';

function buildHotelBackHref(
  slug: string,
  language: SupportedPublicLanguage,
  domainContext: DomainContext,
  preferSubdomainRoot: boolean
) {
  return `${buildPublicHotelHref({
    slug,
    language,
    domainContext,
    preferSubdomainRoot,
  })}#servicos`;
}

export function HotelServiceDetailContent({
  hotel,
  section,
  language,
  domainContext,
  hasFallbackContent,
  preferSubdomainRoot,
  roomRestaurantState,
  roomNumber,
}: {
  hotel: PublicHotel;
  section: PublicHotelSection;
  language: SupportedPublicLanguage;
  domainContext: DomainContext;
  hasFallbackContent: boolean;
  preferSubdomainRoot?: boolean;
  roomRestaurantState?: RoomRestaurantState | null;
  roomNumber?: string | null;
}) {
  const copy = getPublicCopy(language);
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const isNovotelExperience = theme.preset === 'novotel';
  const isGrandMercureExperience = theme.preset === 'grand-mercure';
  const isBrandExperience = isNovotelExperience || isGrandMercureExperience;
  const useSubdomainRoot =
    preferSubdomainRoot ??
    shouldPreferHotelSubdomainRoot({
      domainContext,
      hotelSlug: hotel.slug,
      hotelSubdomain: hotel.subdomain,
    });
  const backHref = buildHotelBackHref(hotel.slug, language, domainContext, useSubdomainRoot);
  const grandMercureServicesHref = buildPublicHotelAreaHref({ slug: hotel.slug, area: 'servicos', language, domainContext, preferSubdomainRoot: useSubdomainRoot });
  const homeHref = buildPublicHotelHref({ slug: hotel.slug, language, domainContext, preferSubdomainRoot: useSubdomainRoot });
  const grandMercureNavigationItems = [
    { key: 'home' as const, href: homeHref, label: copy.navigationHome },
    { key: 'services' as const, href: grandMercureServicesHref, label: copy.navigationServices },
    { key: 'menu' as const, href: buildPublicHotelAreaHref({ slug: hotel.slug, area: 'cardapio', language, domainContext, preferSubdomainRoot: useSubdomainRoot }), label: copy.navigationMenu },
    { key: 'information' as const, href: buildPublicHotelAreaHref({ slug: hotel.slug, area: 'informacoes', language, domainContext, preferSubdomainRoot: useSubdomainRoot }), label: copy.navigationInformation },
    { key: 'contact' as const, href: buildPublicHotelAreaHref({ slug: hotel.slug, area: 'contato', language, domainContext, preferSubdomainRoot: useSubdomainRoot }), label: copy.navigationContact },
  ];

  return (
    <main
      className={`hotel-theme-page min-h-screen ${isGrandMercureExperience ? 'grand-mercure-dock-layout' : ''}`}
      style={theme.cssVars}
      data-hotel-theme={theme.preset}
      data-hotel-icon-style={theme.iconStyle}
    >
      <PublicAnalytics hotelSlug={hotel.slug} language={language} />
      {isGrandMercureExperience ? <GrandMercureGlobalMandala internal /> : null}

      <div className={`mx-auto px-4 py-6 md:px-6 md:py-8 ${isGrandMercureExperience ? 'grand-mercure-scroll-region' : ''} ${isBrandExperience ? 'max-w-6xl' : 'max-w-4xl'}`}>
        <section
          className={
            isBrandExperience
              ? 'hotel-theme-hero relative -mx-4 overflow-hidden rounded-t-none rounded-b-[30px] px-6 py-8 md:mx-0 md:rounded-[30px] md:p-10'
              : 'hotel-theme-hero relative overflow-hidden p-6 md:p-10'
          }
        >
          {isNovotelExperience ? (
            <NovotelHeroBackdrop imageUrl={hotel.hero_image_url} imageAlt={hotel.name} />
          ) : (
            <div className="hotel-theme-hero-overlay pointer-events-none absolute inset-0" />
          )}

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <a
                href={isGrandMercureExperience ? grandMercureServicesHref : backHref}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-badge-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur transition hover:bg-white/15"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {copy.backToServices}
              </a>

              <LanguageSwitcher
                slug={hotel.slug}
                currentLanguage={language}
                basePath={
                  useSubdomainRoot
                    ? `/servicos/${section.id}`
                    : `/hotel/${hotel.slug}/servicos/${section.id}`
                }
              />
            </div>

            <div className="hotel-service-detail-identity mt-7 flex items-start gap-4">
              <div className="flex flex-col items-center gap-3">
                {hotel.logo_url ? (
                  <div
                    aria-label={hotel.name}
                    role="img"
                    className="h-16 w-16 rounded-[22px] border border-white/15 bg-white bg-contain bg-center bg-no-repeat p-1 shadow-[0_16px_32px_-22px_rgba(15,23,42,0.55)]"
                    style={{ backgroundImage: `url(${hotel.logo_url})` }}
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <Hotel className="h-6 w-6 text-[color:var(--hotel-badge-text)]" />
                  </div>
                )}

                <div className="rounded-[22px] border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <ServiceIcon
                    iconName={section.icon}
                    className="h-6 w-6 text-[color:var(--hotel-badge-text)]"
                  />
                </div>
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-badge-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  {isBrandExperience ? theme.label : 'LibGuest'}
                </div>

                <h1 className="hotel-service-detail-title mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
                  {section.title}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[color:var(--hotel-hero-muted)]">
                  {section.category ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-3 py-1 text-xs font-medium tracking-[0.14em] text-[color:var(--hotel-badge-text)]">
                      {section.category}
                    </span>
                  ) : null}

                  <span className="inline-flex items-center gap-2">
                    <Hotel className="h-4 w-4" />
                    {hotel.name}
                  </span>

                  {hotel.city ? (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {hotel.city}
                    </span>
                  ) : null}

                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {copy.internalDetailedContent}
                  </span>
                </div>

                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--hotel-hero-muted)]/85">
                  {hotel.logo_url
                    ? 'Identidade visual do hotel mantida nesta página de detalhe.'
                    : 'Sem logo configurada, a página usa uma apresentação visual padrão e segura.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {hasFallbackContent ? (
          <section className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 shadow-[0_16px_35px_-30px_rgba(120,53,15,0.35)]">
            {copy.fallbackNotice}
          </section>
        ) : null}

        {roomRestaurantState ? (
          <section className="hotel-theme-surface mt-4 rounded-[calc(var(--hotel-card-radius)-2px)] border border-[color:var(--hotel-border)] px-5 py-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.22)]">
            <p className="hotel-theme-muted text-xs font-medium uppercase tracking-[0.18em]">
              LibGuest
            </p>
            <h2 className="hotel-theme-heading mt-2 text-lg font-semibold tracking-tight">
              {roomRestaurantState === 'missing-context'
                ? copy.roomMenuMissingContextTitle
                : roomRestaurantState === 'missing-menu'
                  ? copy.roomMenuMissingMenuTitle
                  : copy.roomMenuInvalidContextTitle}
            </h2>
            <p className="hotel-theme-muted mt-2 text-sm leading-7">
              {roomRestaurantState === 'missing-context'
                ? copy.roomMenuMissingContextDescription
                : roomRestaurantState === 'missing-menu'
                  ? copy.roomMenuMissingMenuDescription(roomNumber)
                  : copy.roomMenuInvalidContextDescription}
            </p>
            <div className="mt-4">
              <a
                href="/room-context/clear"
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {copy.clearRoomAccess}
              </a>
            </div>
          </section>
        ) : null}

        <section className="hotel-theme-surface mt-8 rounded-[var(--hotel-banner-radius)] p-6 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.28)] ring-1 ring-[color:var(--hotel-border)] md:p-8">
          <div className="max-w-3xl">
            <p className="hotel-theme-muted text-xs font-medium uppercase tracking-[0.18em]">
              {copy.serviceDetails}
            </p>
            <h2 className="hotel-theme-heading mt-2 text-2xl font-semibold tracking-tight">
              {copy.fullInformation}
            </h2>
            <p className="hotel-theme-muted mt-4 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-8 md:text-base">
              {section.content}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={isGrandMercureExperience ? grandMercureServicesHref : backHref}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {copy.back}
            </a>
          </div>
        </section>

        <section className={`hotel-theme-surface hotel-theme-muted mt-6 rounded-[calc(var(--hotel-card-radius)-2px)] border border-dashed border-[color:var(--hotel-border)] px-6 py-5 text-sm leading-6 opacity-80 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.18)] ${isGrandMercureExperience ? 'grand-mercure-last-content' : ''}`}>
          {copy.internalPageRule(MIN_SERVICE_DETAIL_CONTENT_LENGTH)}
        </section>
      </div>
      {isGrandMercureExperience ? <GrandMercureMobileNavigation items={grandMercureNavigationItems} activeItem="services" ariaLabel={copy.navigationLabel} /> : null}
    </main>
  );
}
