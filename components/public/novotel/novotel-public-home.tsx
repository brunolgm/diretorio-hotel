import type { ElementType } from 'react';
import {
  BellRing,
  ChevronRight,
  CircleHelp,
  ConciergeBell,
  Info,
  MapPinned,
  MessageCircle,
  Utensils,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { NovotelBrandSignature } from '@/components/public/novotel/novotel-brand-signature';
import { NovotelHeroBackdrop } from '@/components/public/novotel/novotel-hero-backdrop';
import { NovotelMobileNavigation } from '@/components/public/novotel/novotel-mobile-navigation';
import { PromotionalBannerCarousel } from '@/components/public/promotional-banner-carousel';
import { PublicAnalytics } from '@/components/public/public-analytics';
import type { DomainContext } from '@/lib/domain-context';
import { getHotelPublicDisplayName } from '@/lib/hotel-public-identity';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getPublicCopy } from '@/lib/public-copy';
import type { PublicHotelPageData } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import {
  buildPublicHotelAreaHref,
  buildPublicHotelHref,
  type PublicHotelAreaKey,
} from '@/lib/public-routes';

type EditorialCard = {
  area: PublicHotelAreaKey;
  title: string;
  description: string;
  icon: ElementType;
};

export function NovotelPublicHome({
  pageData,
  language,
  domainContext,
  preferSubdomainRoot,
}: {
  pageData: PublicHotelPageData;
  language: SupportedPublicLanguage;
  domainContext: DomainContext;
  preferSubdomainRoot: boolean;
}) {
  const { hotel, banners } = pageData;
  const copy = getPublicCopy(language);
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const buildAreaHref = (area: PublicHotelAreaKey) =>
    buildPublicHotelAreaHref({
      slug: hotel.slug,
      area,
      language,
      domainContext,
      preferSubdomainRoot,
    });
  const homeHref = buildPublicHotelHref({
    slug: hotel.slug,
    language,
    domainContext,
    preferSubdomainRoot,
  });
  const hotelDisplayName = getHotelPublicDisplayName({
    themePreset: theme.preset,
    operationalName: hotel.name,
  });
  const whatsappHref = hotel.whatsapp_number
    ? `https://wa.me/${String(hotel.whatsapp_number).replace(/\D/g, '')}`
    : null;
  const helpHref = whatsappHref || buildAreaHref('contato');
  const cards: EditorialCard[] = [
    { area: 'informacoes', title: copy.editorialInformationTitle, description: copy.editorialInformationDescription, icon: Info },
    { area: 'contato', title: copy.editorialContactTitle, description: copy.editorialContactDescription, icon: MessageCircle },
    { area: 'cardapio', title: copy.editorialMenuTitle, description: copy.editorialMenuDescription, icon: Utensils },
    { area: 'turismo', title: copy.editorialTourismTitle, description: copy.editorialTourismDescription, icon: MapPinned },
    { area: 'comunicados', title: copy.editorialAnnouncementsTitle, description: copy.editorialAnnouncementsDescription, icon: BellRing },
    { area: 'servicos', title: copy.editorialServicesTitle, description: copy.editorialServicesDescription, icon: ConciergeBell },
  ];
  const navigationItems = [
    { key: 'home' as const, href: homeHref, label: copy.navigationHome },
    { key: 'services' as const, href: buildAreaHref('servicos'), label: copy.navigationServices },
    { key: 'menu' as const, href: buildAreaHref('cardapio'), label: copy.navigationMenu },
    { key: 'information' as const, href: buildAreaHref('informacoes'), label: copy.navigationInformation },
    { key: 'contact' as const, href: buildAreaHref('contato'), label: copy.navigationContact },
  ];

  return (
    <main
      className="hotel-theme-page min-h-screen pb-[calc(7.5rem+env(safe-area-inset-bottom))] min-[1025px]:pb-12"
      style={theme.cssVars}
      data-hotel-theme={theme.preset}
      data-hotel-icon-style={theme.iconStyle}
    >
      <PublicAnalytics hotelSlug={hotel.slug} language={language} />

      <div className="mx-auto max-w-7xl md:px-6 md:py-8">
        <section className="relative min-h-[320px] overflow-hidden rounded-b-[34px] bg-[var(--hotel-hero-background)] px-6 pt-5 pb-14 text-white shadow-[0_30px_70px_-38px_rgba(0,43,92,0.72)] md:min-h-[540px] md:rounded-[34px] md:px-12 md:py-10">
          <NovotelHeroBackdrop imageUrl={hotel.hero_image_url} imageAlt={hotel.name} />

          <div className="relative flex min-h-[260px] flex-col md:min-h-[460px]">
            <div className="flex justify-end">
              <LanguageSwitcher
                slug={hotel.slug}
                currentLanguage={language}
                basePath={preferSubdomainRoot ? '/' : undefined}
              />
            </div>

            <div className="mt-1 flex flex-1 items-center justify-center px-2 text-center md:mt-0">
              <NovotelBrandSignature logoUrl={hotel.logo_url} subtitle={hotelDisplayName} />
            </div>

            <div className="mt-auto max-w-lg text-left drop-shadow-[0_2px_12px_rgba(0,25,65,0.46)]">
              <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{copy.welcome}</h1>
              <p className="mt-1.5 max-w-md text-sm leading-5 text-white/92 sm:text-base sm:leading-6 md:mt-2 md:text-lg md:leading-7">
                {copy.novotelHeroDescription}
              </p>
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-6 grid grid-cols-2 gap-2 px-4 md:-mt-10 md:gap-5 md:px-10 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <a
                key={card.area}
                href={buildAreaHref(card.area)}
                className="group flex min-h-[108px] min-w-0 items-center gap-2 overflow-hidden rounded-[22px] bg-white p-3 shadow-[0_14px_36px_-24px_rgba(0,43,92,0.32)] ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_-24px_rgba(0,43,92,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005DA8] focus-visible:ring-offset-2 md:min-h-[172px] md:gap-5 md:rounded-[28px] md:p-6"
              >
                <Icon className="h-8 w-8 shrink-0 text-[#0052B4] md:h-14 md:w-14" strokeWidth={1.8} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-sm font-semibold leading-5 tracking-[-0.01em] text-[#002F6C] min-[390px]:text-[15px] md:text-xl md:leading-6">
                    {card.title}
                  </h2>
                  <p className="mt-1 break-words text-[11px] leading-[15px] text-slate-600 min-[360px]:text-xs min-[360px]:leading-4 md:mt-2 md:text-sm md:leading-5">
                    {card.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#003B7A] transition group-hover:translate-x-0.5 md:h-5 md:w-5" aria-hidden="true" />
              </a>
            );
          })}
        </section>

        <section className="mt-5 px-4 md:mt-8 md:px-10">
          <PromotionalBannerCarousel banners={banners} language={language} showEmptyFallback />
        </section>

        <section className="mx-4 mt-4 rounded-[22px] bg-white p-4 shadow-[0_14px_36px_-24px_rgba(0,43,92,0.3)] ring-1 ring-slate-100 md:mx-10 md:mt-6 md:p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0052B4] text-white md:h-14 md:w-14">
              <CircleHelp className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-[#002F6C] md:text-xl">{copy.helpTitle}</h2>
              <p className="mt-0.5 text-xs leading-4 text-slate-600 md:text-sm">
                {whatsappHref ? copy.helpWhatsappDescription : copy.editorialContactDescription}
              </p>
            </div>
            <a
              href={helpHref}
              target={whatsappHref ? '_blank' : undefined}
              rel={whatsappHref ? 'noreferrer' : undefined}
              aria-label={whatsappHref ? copy.whatsappSupport : copy.editorialContactTitle}
              data-analytics-event={whatsappHref ? 'whatsapp_click' : undefined}
              data-analytics-target-url={whatsappHref || undefined}
              data-analytics-label={whatsappHref ? 'Novotel help card' : undefined}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:h-14 md:w-14 ${whatsappHref ? 'bg-[#35C52D] focus-visible:ring-[#35C52D]' : 'bg-[#0052B4] focus-visible:ring-[#0052B4]'}`}
            >
              <MessageCircle className="h-7 w-7" aria-hidden="true" />
            </a>
          </div>
        </section>

        <footer className="px-6 pt-6 pb-8 text-center text-xs font-medium text-slate-500 md:py-8">
          Powered by LibGuest
        </footer>
      </div>

      <NovotelMobileNavigation
        items={navigationItems}
        activeItem="home"
        ariaLabel={copy.navigationLabel}
      />
    </main>
  );
}
