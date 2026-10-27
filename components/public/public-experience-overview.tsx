import Image from 'next/image';
import { Fragment } from 'react';
import { BellRing, ChevronRight, Clock3, Coffee, Info, MessageCircle, ShieldCheck, Wifi } from 'lucide-react';
import { LanguageSwitcher } from './language-switcher';
import { PublicAnalytics } from './public-analytics';
import { PromotionalBannerCarousel } from './promotional-banner-carousel';
import { PublicFlightHomeCard } from './public-flight-home-card';
import { PublicBottomDock } from './public-bottom-dock';
import type { DomainContext } from '@/lib/domain-context';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getPublicCopy } from '@/lib/public-copy';
import { getPublicExperienceOverview, getOverviewNavigation } from '@/lib/public-experience-overview';
import { getCanonicalPublicNavigationKeys } from '@/lib/public-navigation';
import type { PublicHotelPageData } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { buildPublicHotelAreaHref, buildPublicHotelHref, type PublicHotelAreaKey } from '@/lib/public-routes';

// Compact presentation of the shared experience; no data fetching or tenant business rules.
export function PublicExperienceOverview({ pageData, language, domainContext, preferSubdomainRoot, activeRoomContext }: {
  pageData: PublicHotelPageData;
  language: SupportedPublicLanguage;
  domainContext: DomainContext;
  preferSubdomainRoot: boolean;
  activeRoomContext?: { roomNumber: string | null; label: string | null } | null;
}) {
  const { hotel, sections, announcements, flightHomeCard, banners } = pageData;
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const copy = getPublicCopy(language);
  const areaHref = (area: PublicHotelAreaKey) => buildPublicHotelAreaHref({ slug: hotel.slug, area, language, domainContext, preferSubdomainRoot });
  const homeHref = buildPublicHotelHref({ slug: hotel.slug, language, domainContext, preferSubdomainRoot });
  const keys = getPublicExperienceOverview(pageData);
  const navigation = getOverviewNavigation(pageData.layout, sections.length);
  const routes = {
    quick_info: { area: 'informacoes', title: copy.stayInformation, description: copy.editorialInformationDescription, icon: Info },
    announcements: { area: 'comunicados', title: copy.editorialAnnouncementsTitle, description: copy.editorialAnnouncementsDescription, icon: BellRing },
    services: { area: 'servicos', title: copy.editorialServicesTitle, description: copy.editorialServicesDescription, icon: BellRing },
    contact: { area: 'contato', title: copy.talkToHotel, description: copy.editorialContactDescription, icon: MessageCircle },
    departments: { area: 'contato', title: copy.support, description: copy.departmentDefaultDescription, icon: MessageCircle },
    policies: { area: 'informacoes', title: copy.hotelPolicies, description: copy.policyDefaultDescription, icon: ShieldCheck },
  } as const;
  const navMeta = {
    home: { href: homeHref, label: copy.navigationHome },
    services: { href: areaHref('servicos'), label: copy.navigationServices },
    menu: { href: areaHref('cardapio'), label: copy.navigationMenu },
    information: { href: areaHref('informacoes'), label: copy.navigationInformation },
    contact: { href: areaHref('contato'), label: copy.navigationContact },
  };
  const quickInfo = [
    { icon: Wifi, title: copy.wifi, value: hotel.wifi_name },
    { icon: Coffee, title: copy.breakfast, value: hotel.breakfast_hours },
    { icon: Clock3, title: copy.checkOut, value: hotel.checkout_time },
  ].filter((item) => item.value?.trim());
  const flight = flightHomeCard ? <div className="col-span-full"><PublicFlightHomeCard card={flightHomeCard} hotelId={hotel.id} hotelSlug={hotel.slug} language={language} domainContext={domainContext} preferSubdomainRoot={preferSubdomainRoot} variant="default" /></div> : null;

  return <main className="hotel-theme-page public-compact-experience min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))]" style={theme.cssVars} data-hotel-theme={theme.preset} data-hotel-icon-style={theme.iconStyle}>
    <PublicAnalytics hotelSlug={hotel.slug} language={language} />
    <div className="mx-auto max-w-4xl px-4 py-4 md:px-8 md:py-8">
      <div className="grid grid-cols-2 gap-3 md:gap-5">
        {keys.map((key) => {
          if (key === 'hero') return <header key={key} className="col-span-full min-w-0 py-2 text-center">
            <div className="flex min-h-11 items-start justify-between gap-2 text-left">
              <div className="min-w-0">{activeRoomContext ? <span className="inline-flex min-h-11 items-center rounded-full border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] px-3 text-xs">{copy.activeRoomAccessLabel(activeRoomContext.roomNumber, activeRoomContext.label)}</span> : null}</div>
              <LanguageSwitcher compact slug={hotel.slug} currentLanguage={language} basePath={preferSubdomainRoot ? '/' : undefined} />
            </div>
            <div className="px-6 py-6">
              {hotel.logo_url ? <Image src={hotel.logo_url} alt={hotel.name} width={192} height={96} unoptimized className="mx-auto h-auto max-h-24 min-h-[23px] w-48 max-w-full object-contain" /> : <h1 className="break-words text-3xl font-medium tracking-tight">{hotel.name}</h1>}
              {hotel.city ? <p className="mt-4 text-xs font-medium uppercase tracking-[.22em] text-[color:var(--hotel-text-muted)]">{hotel.city}</p> : null}
              {hotel.logo_url ? <h1 className="sr-only">{hotel.name}</h1> : null}
              <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-[color:var(--hotel-text-muted)]">{copy.heroDescription}</p>
            </div>
            {pageData.hasFallbackContent ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{copy.fallbackNotice}</p> : null}
          </header>;
          if (key === 'banners') return <Fragment key={key}>{flight}<section className="col-span-full min-w-0"><PromotionalBannerCarousel banners={banners} language={language} /></section></Fragment>;
          const card = routes[key];
          const Icon = card.icon;
          return <Fragment key={key}>
            {key === 'quick_info' && quickInfo.length > 0 ? <dl className="col-span-full grid grid-cols-3 gap-2 rounded-2xl border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] p-3">
              {quickInfo.map((item) => <div key={item.title} className="min-w-0 text-center"><item.icon className="mx-auto mb-2 h-5 w-5 text-[color:var(--hotel-accent)]" aria-hidden="true" /><dt className="break-words text-xs text-[color:var(--hotel-text-muted)]">{item.title}</dt><dd className="mt-1 break-words text-xs font-semibold [overflow-wrap:anywhere]">{item.value}</dd></div>)}
            </dl> : null}
            <a href={areaHref(card.area)} className="hotel-theme-card group flex min-h-40 min-w-0 flex-col p-4 transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] md:min-h-44 md:p-6">
              <div className="flex items-center justify-between gap-2"><Icon className="h-6 w-6 text-[color:var(--hotel-accent)]" aria-hidden="true" />{key === 'announcements' ? <span className="rounded-full bg-[var(--hotel-accent-soft)] px-2 py-1 text-xs" aria-label={copy.activeAnnouncementsCount(announcements.length)}>{announcements.length}</span> : null}<ChevronRight className="ml-auto h-4 w-4 text-[color:var(--hotel-accent)]" aria-hidden="true" /></div>
              <h2 className="mt-4 break-words text-sm font-semibold md:text-lg">{card.title}</h2>
              <p className="mt-2 break-words text-xs leading-5 text-[color:var(--hotel-text-muted)] md:text-sm">{card.description}</p>
            </a>
          </Fragment>;
        })}
        {!keys.includes('banners') ? flight : null}
      </div>
      <footer className="py-7 text-center text-xs text-[color:var(--hotel-text-muted)]">Powered by LibGuest</footer>
    </div>
    <PublicBottomDock items={getCanonicalPublicNavigationKeys(navigation).map((key) => ({ key, ...navMeta[key] }))} activeItem="home" ariaLabel={copy.navigationLabel} />
  </main>;
}
