import {
  AlarmClock,
  ArrowLeft,
  ArrowUpRight,
  BusFront,
  Clock3,
  Coffee,
  ExternalLink,
  MessageCircle,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  ShieldCheck,
} from 'lucide-react';
import { GrandMercureAreaHero } from '@/components/public/grand-mercure/grand-mercure-area-hero';
import { GrandMercureMobileNavigation } from '@/components/public/grand-mercure/grand-mercure-mobile-navigation';
import { GrandMercureGlobalMandala } from '@/components/public/grand-mercure/grand-mercure-ornament';
import { GuestFlightManager } from '@/components/public/guest-flight-manager';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { MercureAreaHero } from '@/components/public/mercure/mercure-area-hero';
import { MercureBottomDock } from '@/components/public/mercure/mercure-bottom-dock';
import { NovotelAreaHero } from '@/components/public/novotel/novotel-area-hero';
import { NovotelMobileNavigation } from '@/components/public/novotel/novotel-mobile-navigation';
import { PublicAnalytics } from '@/components/public/public-analytics';
import type { DomainContext } from '@/lib/domain-context';
import type { FlightServiceAnalyticsAction } from '@/lib/analytics';
import { buildHotelServiceActionDestination } from '@/lib/flight-center-actions';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getPublicFlightCenterActionGridLayout } from '@/lib/public-flight-center-layout';
import {
  getPublicFlightCenterCopy,
  PUBLIC_FLIGHT_CENTER_TABS,
  type PublicFlightCenterTab,
} from '@/lib/public-flight-center-copy';
import { getPublicCopy } from '@/lib/public-copy';
import type { PublicFlightCenterAirport, PublicFlightCenterData } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { getCanonicalPublicNavigationKeys } from '@/lib/public-navigation';
import {
  buildPublicHotelAreaHref,
  buildPublicHotelFlightCenterHref,
  buildPublicHotelHref,
} from '@/lib/public-routes';

function buildTabHref(basePath: string, language: SupportedPublicLanguage, tab: PublicFlightCenterTab) {
  const query = new URLSearchParams({ tab });
  if (language !== 'pt') query.set('lang', language);
  return `${basePath}?${query.toString()}`;
}

function OfficialLinks({
  airport,
  copy,
}: {
  airport: PublicFlightCenterAirport;
  copy: ReturnType<typeof getPublicFlightCenterCopy>;
}) {
  const departures = airport.officialDeparturesUrl;
  const arrivals = airport.officialArrivalsUrl;

  if (!departures && !arrivals) {
    return <p className="mt-4 text-sm leading-6 text-[color:var(--hotel-text-muted)]">{copy.noOfficialLink}</p>;
  }

  const links = departures && arrivals && departures === arrivals
    ? [{ href: departures, label: copy.combinedOfficial }]
    : [
        departures ? { href: departures, label: copy.officialDepartures } : null,
        arrivals ? { href: arrivals, label: copy.officialArrivals } : null,
      ].filter((item): item is { href: string; label: string } => Boolean(item));

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={`${link.label}-${link.href}`}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            data-analytics-event="flight_official_link_click"
            className="inline-flex min-h-11 items-center rounded-[14px] bg-[var(--hotel-accent)] px-4 text-sm font-semibold text-[color:var(--hotel-accent-foreground)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] focus-visible:ring-offset-2"
          >
            {link.label}<ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </a>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-[color:var(--hotel-text-muted)]">
        <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--hotel-accent)]" aria-hidden="true" />
        {copy.officialSource}
      </p>
    </div>
  );
}

function PlanningDetails({ airport, copy }: {
  airport: PublicFlightCenterAirport;
  copy: ReturnType<typeof getPublicFlightCenterCopy>;
}) {
  const details = [
    airport.domesticLeadMinutes === null ? null : { label: copy.domesticLead, value: airport.domesticLeadMinutes },
    airport.internationalLeadMinutes === null ? null : { label: copy.internationalLead, value: airport.internationalLeadMinutes },
    airport.safetyMarginMinutes === null ? null : { label: copy.safetyMargin, value: airport.safetyMarginMinutes },
  ].filter((item): item is { label: string; value: number } => Boolean(item));

  if (!details.length) return null;

  return (
    <dl className="mt-5 grid gap-2 border-t border-[color:var(--hotel-border)] pt-4 sm:grid-cols-3">
      {details.map((detail) => (
        <div key={detail.label} className="rounded-[14px] bg-[var(--hotel-surface-muted)] p-3">
          <dt className="text-xs leading-5 text-[color:var(--hotel-text-muted)]">{detail.label}</dt>
          <dd className="mt-1 font-semibold text-[color:var(--hotel-primary)]">{copy.minutes(detail.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HotelPublicFlightCenter({
  data,
  language,
  tab,
  domainContext,
  preferSubdomainRoot,
}: {
  data: PublicFlightCenterData;
  language: SupportedPublicLanguage;
  tab: PublicFlightCenterTab;
  domainContext: DomainContext;
  preferSubdomainRoot: boolean;
}) {
  const { hotel, airports, navigationAvailability, settings } = data;
  const copy = getPublicFlightCenterCopy(language);
  const publicCopy = getPublicCopy(language);
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const isNovotel = theme.preset === 'novotel';
  const isGrandMercure = theme.preset === 'grand-mercure';
  const isMercure = theme.preset === 'mercure';
  const isBrandExperience = isNovotel || isGrandMercure || isMercure;
  const homeHref = buildPublicHotelHref({ slug: hotel.slug, language, domainContext, preferSubdomainRoot });
  const basePath = buildPublicHotelFlightCenterHref({ slug: hotel.slug, language: 'pt', domainContext, preferSubdomainRoot });
  const contactHref = buildPublicHotelAreaHref({ slug: hotel.slug, area: 'contato', language, domainContext, preferSubdomainRoot });
  const navigationItemsByKey = {
    home: { key: 'home' as const, href: homeHref, label: publicCopy.navigationHome },
    services: { key: 'services' as const, href: buildPublicHotelAreaHref({ slug: hotel.slug, area: 'servicos', language, domainContext, preferSubdomainRoot }), label: publicCopy.navigationServices },
    menu: { key: 'menu' as const, href: buildPublicHotelAreaHref({ slug: hotel.slug, area: 'cardapio', language, domainContext, preferSubdomainRoot }), label: publicCopy.navigationMenu },
    information: { key: 'information' as const, href: buildPublicHotelAreaHref({ slug: hotel.slug, area: 'informacoes', language, domainContext, preferSubdomainRoot }), label: publicCopy.navigationInformation },
    contact: { key: 'contact' as const, href: contactHref, label: publicCopy.navigationContact },
  };
  const navigationItems = getCanonicalPublicNavigationKeys(navigationAvailability)
    .map((key) => navigationItemsByKey[key]);
  const actionItems = [
    settings.transferEnabled ? { action: 'transfer' as const, label: copy.transfer, icon: BusFront, ...buildHotelServiceActionDestination({ whatsappNumber: hotel.whatsapp_number, contactHref, message: copy.transferRequestMessage }) } : null,
    settings.wakeUpEnabled ? { action: 'wake_up' as const, label: copy.wakeUp, icon: AlarmClock, ...buildHotelServiceActionDestination({ whatsappNumber: hotel.whatsapp_number, contactHref, message: copy.wakeUpRequestMessage }) } : null,
    settings.breakfastBoxEnabled ? { action: 'breakfast_box' as const, label: copy.breakfastBox, icon: Coffee, ...buildHotelServiceActionDestination({ whatsappNumber: hotel.whatsapp_number, contactHref, message: copy.breakfastBoxRequestMessage }) } : null,
    settings.receptionEnabled ? { action: 'reception' as const, label: copy.reception, icon: MessageCircle, ...buildHotelServiceActionDestination({ whatsappNumber: hotel.whatsapp_number, contactHref, message: copy.receptionRequestMessage }) } : null,
  ].filter((item): item is { action: FlightServiceAnalyticsAction; label: string; icon: typeof BusFront; href: string; isExternal: boolean } => Boolean(item));
  const actionGrid = getPublicFlightCenterActionGridLayout(actionItems.length);
  const showPlanning = settings.departurePlanningEnabled && (
    Boolean(settings.departureNotice) || airports.some((airport) =>
      airport.estimatedTransferMinutes !== null || airport.domesticLeadMinutes !== null ||
      airport.internationalLeadMinutes !== null || airport.safetyMarginMinutes !== null
    )
  );
  const listTitle = tab === 'chegadas' ? copy.arrivalsTitle : copy.departuresTitle;
  const listDescription = tab === 'chegadas' ? copy.arrivalsDescription : copy.departuresDescription;
  const flightAirportOptions = airports.map((airport) => ({
    iataCode: airport.iataCode,
    name: airport.name,
    city: airport.city,
    officialUrl: airport.officialDeparturesUrl || airport.officialArrivalsUrl,
  }));

  const hero = isNovotel ? (
    <NovotelAreaHero hotel={hotel} language={language} languageBasePath={basePath} homeHref={homeHref} backLabel={copy.back} title={copy.title} description={copy.description} icon={Plane} />
  ) : isGrandMercure ? (
    <GrandMercureAreaHero hotel={hotel} language={language} languageBasePath={basePath} homeHref={homeHref} backLabel={copy.back} title={copy.title} description={copy.description} icon={Plane} />
  ) : isMercure ? (
    <MercureAreaHero hotel={hotel} language={language} languageBasePath={basePath} homeHref={homeHref} backLabel={copy.back} title={copy.title} description={copy.description} icon={Plane} />
  ) : (
    <header className="relative overflow-hidden rounded-[28px] bg-[var(--hotel-hero-background)] p-5 text-white shadow-[0_24px_60px_-38px_rgba(0,43,92,0.8)] md:p-8">
      <div className="absolute inset-0 bg-[image:var(--hotel-hero-overlay)]" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <a href={homeHref} className="inline-flex min-h-11 items-center rounded-full border border-white/20 bg-white/10 px-4 text-sm font-medium text-white backdrop-blur"><ArrowLeft className="mr-2 h-4 w-4" />{copy.back}</a>
          <LanguageSwitcher slug={hotel.slug} currentLanguage={language} basePath={basePath} />
        </div>
        <div className="mt-10 max-w-2xl"><Plane className="h-10 w-10" /><h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{copy.title}</h1><p className="mt-3 text-sm leading-6 text-blue-50 md:text-base">{copy.description}</p></div>
      </div>
    </header>
  );

  return (
    <main className={`hotel-theme-page min-h-screen ${isGrandMercure ? 'grand-mercure-dock-layout' : isNovotel ? 'pb-[calc(7.5rem+env(safe-area-inset-bottom))] min-[1025px]:pb-12' : isMercure ? 'mercure-internal-page pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-[1025px]:pb-12' : 'pb-10'}`} style={theme.cssVars} data-hotel-theme={theme.preset} data-hotel-icon-style={theme.iconStyle}>
      <PublicAnalytics hotelSlug={hotel.slug} language={language} pageEventType="flight_center_view" />
      {isGrandMercure ? <GrandMercureGlobalMandala internal /> : null}
      <div className={`mx-auto px-4 py-5 md:px-6 md:py-8 ${isGrandMercure ? 'grand-mercure-scroll-region' : ''} ${isBrandExperience ? 'max-w-7xl' : 'max-w-5xl'}`}>
        {hero}

        <nav aria-label={copy.title} className="mt-5 overflow-x-auto">
          <div className="grid min-w-[330px] grid-cols-3 gap-2 rounded-[18px] border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] p-1.5 shadow-[0_14px_34px_-30px_rgba(15,23,42,.35)]">
            {PUBLIC_FLIGHT_CENTER_TABS.map((item) => (
              <a key={item} href={buildTabHref(basePath, language, item)} aria-current={tab === item ? 'page' : undefined} className={`flex min-h-11 items-center justify-center rounded-[13px] px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] ${tab === item ? 'bg-[var(--hotel-accent)] text-[color:var(--hotel-accent-foreground)] shadow-sm' : 'text-[color:var(--hotel-text-muted)] hover:bg-[var(--hotel-surface-muted)]'}`}>{copy.tabs[item]}</a>
            ))}
          </div>
        </nav>

        <section className={`mt-5 space-y-5 ${isGrandMercure ? 'grand-mercure-last-content mb-8 md:mb-4' : isNovotel || isMercure ? 'mb-8 md:mb-4' : ''}`}>
          {tab === 'meu-voo' ? (
            <GuestFlightManager hotelId={hotel.id} hotelSlug={hotel.slug} language={language} airportOptions={flightAirportOptions} />
          ) : (
            <div className="space-y-4">
              <div><h2 className="text-2xl font-semibold text-[color:var(--hotel-primary)]">{listTitle}</h2><p className="mt-2 text-sm leading-6 text-[color:var(--hotel-text-muted)]">{listDescription}</p></div>
              <div className="grid gap-4 lg:grid-cols-2">
                {airports.map((airport) => (
                  <article key={airport.iataCode} className="hotel-public-content-card rounded-[24px] border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] p-5 shadow-[var(--hotel-card-shadow)]">
                    <div className="flex items-start justify-between gap-4">
                      <div><span className="inline-flex rounded-full bg-[var(--hotel-accent-soft)] px-3 py-1 text-sm font-bold tracking-[.08em] text-[color:var(--hotel-accent)]">{airport.iataCode}</span><h3 className="mt-3 text-lg font-semibold text-[color:var(--hotel-primary)]">{airport.name}</h3><p className="mt-1 text-sm text-[color:var(--hotel-text-muted)]">{airport.city}</p></div>
                      {tab === 'chegadas' ? <PlaneLanding className="h-7 w-7 text-[color:var(--hotel-accent)]" /> : <PlaneTakeoff className="h-7 w-7 text-[color:var(--hotel-accent)]" />}
                    </div>
                    {airport.estimatedTransferMinutes !== null ? <p className="mt-4 flex items-center gap-2 text-sm text-[color:var(--hotel-text-muted)]"><Clock3 className="h-4 w-4 text-[color:var(--hotel-accent)]" />{copy.transferTime}: <strong className="text-[color:var(--hotel-primary)]">{copy.minutes(airport.estimatedTransferMinutes)}</strong></p> : null}
                    <OfficialLinks airport={airport} copy={copy} />
                    {showPlanning ? <PlanningDetails airport={airport} copy={copy} /> : null}
                  </article>
                ))}
              </div>
            </div>
          )}

          {showPlanning ? (
            <aside className="rounded-[24px] border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] p-5">
              <h2 className="text-lg font-semibold text-[color:var(--hotel-primary)]">{copy.planningTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--hotel-text-muted)]">{settings.departureNotice || copy.planningDescription}</p>
              {settings.departureNotice ? <p className="mt-2 text-xs leading-5 text-[color:var(--hotel-text-muted)]">{copy.planningDescription}</p> : null}
            </aside>
          ) : null}

          {actionGrid ? (
            <section><h2 className="text-xl font-semibold text-[color:var(--hotel-primary)]">{copy.actionsTitle}</h2><p className="mt-2 text-sm leading-6 text-[color:var(--hotel-text-muted)]">{copy.actionsDescription}</p><div className={`mt-4 ${actionGrid.containerClassName}`}>{actionItems.map((action, index) => { const ActionIcon = action.icon; return <a key={action.label} href={action.href} target={action.isExternal ? '_blank' : undefined} rel={action.isExternal ? 'noopener noreferrer' : undefined} data-analytics-event="flight_service_action" data-analytics-action={action.action} className={`hotel-public-content-card rounded-[20px] border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] p-4 shadow-[var(--hotel-card-shadow)] ${actionGrid.itemClassNames[index]}`.trim()}><ActionIcon className="h-6 w-6 text-[color:var(--hotel-accent)]" /><h3 className="mt-3 font-semibold text-[color:var(--hotel-primary)]">{action.label}</h3><p className="mt-2 flex items-center text-xs text-[color:var(--hotel-text-muted)]">{copy.contactHotel}<ArrowUpRight className="ml-1 h-3.5 w-3.5" /></p></a>; })}</div></section>
          ) : null}
        </section>

        {isMercure ? <footer className="mercure-internal-footer px-6 pt-2 pb-1 text-center text-[10px] font-medium tracking-[.18em] text-[#685d64]">Powered by <span className="tracking-normal text-[#52204f]">LibGuest</span></footer> : null}
      </div>
      {isNovotel ? <NovotelMobileNavigation items={navigationItems} activeItem="home" ariaLabel={publicCopy.navigationLabel} /> : null}
      {isGrandMercure ? <GrandMercureMobileNavigation items={navigationItems} activeItem="home" ariaLabel={publicCopy.navigationLabel} /> : null}
      {isMercure ? <MercureBottomDock items={navigationItems} activeItem="home" ariaLabel={publicCopy.navigationLabel} /> : null}
    </main>
  );
}
