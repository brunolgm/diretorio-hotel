import type { ElementType } from 'react';
import Image from 'next/image';
import {
  BellRing,
  Camera,
  ConciergeBell,
  Headphones,
  Info,
  Megaphone,
  MessageCircle,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { PublicAnalytics } from '@/components/public/public-analytics';
import type { DomainContext } from '@/lib/domain-context';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getPublicCopy } from '@/lib/public-copy';
import type { PublicHotelPageData } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import {
  buildPublicHotelAreaHref,
  buildPublicHotelHref,
  type PublicHotelAreaKey,
} from '@/lib/public-routes';
import { MercureBottomDock } from './mercure-bottom-dock';
import { MercureBrandSignature } from './mercure-brand-signature';
import { MercurePromotionalBanner } from './mercure-promotional-banner';

const HERO_FALLBACK = '/brand/mercure/mercure-hero-fallback.webp';

type MercureCard = {
  area: PublicHotelAreaKey;
  title: string;
  description: string;
  icon: ElementType;
};

export function MercurePublicHome({
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
  const areaHref = (area: PublicHotelAreaKey) =>
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
  const whatsappHref = hotel.whatsapp_number
    ? `https://wa.me/${String(hotel.whatsapp_number).replace(/\D/g, '')}`
    : null;
  const helpHref = whatsappHref || areaHref('contato');
  const heroImage = hotel.hero_image_url || HERO_FALLBACK;
  const cards: MercureCard[] = [
    {
      area: 'informacoes',
      title: copy.editorialInformationTitle,
      description: copy.mercureInformationDescription,
      icon: Info,
    },
    {
      area: 'contato',
      title: copy.editorialContactTitle,
      description: copy.mercureContactDescription,
      icon: MessageCircle,
    },
    {
      area: 'cardapio',
      title: copy.editorialMenuTitle,
      description: copy.mercureMenuDescription,
      icon: ConciergeBell,
    },
    {
      area: 'turismo',
      title: copy.editorialTourismTitle,
      description: copy.mercureTourismDescription,
      icon: Camera,
    },
    {
      area: 'comunicados',
      title: copy.editorialAnnouncementsTitle,
      description: copy.mercureAnnouncementsDescription,
      icon: Megaphone,
    },
    {
      area: 'servicos',
      title: copy.editorialServicesTitle,
      description: copy.mercureServicesDescription,
      icon: BellRing,
    },
  ];
  const navigationItems = [
    { key: 'home' as const, href: homeHref, label: copy.navigationHome },
    { key: 'services' as const, href: areaHref('servicos'), label: copy.navigationServices },
    { key: 'menu' as const, href: areaHref('cardapio'), label: copy.navigationMenu },
    {
      key: 'information' as const,
      href: areaHref('informacoes'),
      label: copy.navigationInformation,
    },
    { key: 'contact' as const, href: areaHref('contato'), label: copy.navigationContact },
  ];

  return (
    <main
      className="hotel-theme-page mercure-public-home min-h-screen pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10"
      style={theme.cssVars}
      data-hotel-theme={theme.preset}
      data-hotel-icon-style={theme.iconStyle}
    >
      <PublicAnalytics hotelId={hotel.id} hotelSlug={hotel.slug} language={language} />
      <div className="mercure-page-floral pointer-events-none fixed inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-[1240px] md:px-6 md:py-7">
        <section className="mercure-hero relative min-h-[430px] overflow-hidden rounded-b-[34px] border-b border-[#52204f]/8 bg-[#fbf7f8] md:min-h-[540px] md:rounded-[34px] md:border">
          <div className="mercure-hero-floral pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="mercure-hero-media absolute inset-y-0 right-0 w-[78%] md:w-[64%]">
            <Image
              src={heroImage}
              alt={hotel.hero_image_url ? hotel.name : ''}
              fill
              unoptimized={Boolean(hotel.hero_image_url)}
              className="object-cover object-[65%_center] md:object-[62%_center]"
              sizes="(min-width: 768px) 790px, 78vw"
              priority
            />
          </div>
          <div className="mercure-hero-image-overlay pointer-events-none absolute inset-0" aria-hidden="true" />

          <div className="relative z-10 flex min-h-[430px] flex-col px-5 pt-4 pb-11 md:min-h-[540px] md:px-12 md:pt-7 md:pb-14">
            <div className="flex justify-end">
              <LanguageSwitcher
                slug={hotel.slug}
                currentLanguage={language}
                basePath={preferSubdomainRoot ? '/' : undefined}
              />
            </div>

            <div className="mt-4 flex justify-center md:mt-2">
              <MercureBrandSignature logoUrl={hotel.logo_url} />
            </div>

            <div className="mt-auto max-w-[230px] text-left text-[#52204f] min-[390px]:max-w-[255px] md:max-w-md">
              <h1 className="text-[1.45rem] leading-tight font-semibold tracking-[-.02em] md:text-4xl">
                {copy.welcome}
              </h1>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-6 text-[#52204f] md:mt-3 md:text-xl md:leading-8">
                {copy.mercureHeroDescription}
              </p>
            </div>
          </div>
        </section>

        <section className="mercure-access-grid relative z-20 -mt-6 grid grid-cols-2 gap-3 px-3 md:-mt-8 md:grid-cols-3 md:gap-5 md:px-10 lg:px-14">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <a
                key={card.area}
                href={areaHref(card.area)}
                className="mercure-access-card group flex min-h-[166px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-[19px] border border-[#52204f]/7 bg-[#fffdfd] px-3 py-5 text-center shadow-[0_16px_38px_-25px_rgba(61,23,60,.3)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_-25px_rgba(61,23,60,.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71386e] focus-visible:ring-offset-2 md:min-h-[224px] md:rounded-[26px] md:px-6 md:py-7"
              >
                <Icon
                  className="h-12 w-12 shrink-0 text-[#52204f] md:h-16 md:w-16"
                  strokeWidth={1.55}
                  aria-hidden="true"
                />
                <h2 className="mt-3 break-words text-sm leading-5 font-semibold text-[#52204f] min-[390px]:text-[15px] md:mt-5 md:text-xl">
                  {card.title}
                </h2>
                <p className="mt-1 max-w-[180px] text-[11px] leading-[15px] text-[#685d64] min-[390px]:text-xs min-[390px]:leading-4 md:mt-2 md:text-sm md:leading-5">
                  {card.description}
                </p>
              </a>
            );
          })}
        </section>

        <div className="mt-4 px-3 md:mt-7 md:px-10 lg:px-14">
          <MercurePromotionalBanner banners={banners} language={language} />
        </div>

        <section className="mercure-help-card mx-3 mt-4 flex min-h-[84px] items-center gap-3 rounded-[20px] border border-[#52204f]/7 bg-[#fffdfd] p-3.5 shadow-[0_16px_38px_-27px_rgba(61,23,60,.3)] md:mx-10 md:mt-6 md:min-h-[104px] md:gap-5 md:rounded-[26px] md:p-5 lg:mx-14">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#71386e] text-white md:h-16 md:w-16">
            <Headphones className="h-7 w-7 md:h-9 md:w-9" strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#52204f] md:text-xl">{copy.helpTitle}</h2>
            <p className="mt-0.5 text-[10px] leading-4 text-[#685d64] min-[360px]:text-[11px] md:text-sm md:leading-5">
              {whatsappHref ? copy.helpWhatsappDescription : copy.mercureContactDescription}
            </p>
          </div>
          <a
            href={helpHref}
            target={whatsappHref ? '_blank' : undefined}
            rel={whatsappHref ? 'noreferrer' : undefined}
            aria-label={whatsappHref ? copy.whatsappSupport : copy.editorialContactTitle}
            data-analytics-event={whatsappHref ? 'whatsapp_click' : undefined}
            data-analytics-target-url={whatsappHref || undefined}
            data-analytics-label={whatsappHref ? 'Mercure help card' : undefined}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-[0_14px_28px_-18px_rgba(15,23,42,.5)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:h-16 md:w-16 ${
              whatsappHref
                ? 'bg-[#25d366] focus-visible:ring-[#25d366]'
                : 'bg-[#71386e] focus-visible:ring-[#71386e]'
            }`}
          >
            <MessageCircle className="h-7 w-7 md:h-9 md:w-9" strokeWidth={1.8} aria-hidden="true" />
          </a>
        </section>

        <footer className="px-6 pt-6 pb-5 text-center text-[10px] font-medium tracking-[.18em] text-[#685d64] md:py-8 md:text-xs">
          Powered by <span className="tracking-normal text-[#52204f]">LibGuest</span>
        </footer>
      </div>

      <MercureBottomDock
        items={navigationItems}
        activeItem="home"
        ariaLabel={copy.navigationLabel}
      />
    </main>
  );
}
