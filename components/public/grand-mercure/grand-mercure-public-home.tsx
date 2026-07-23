import type { ElementType } from 'react';
import { BellRing, ChevronDown, CircleHelp, ConciergeBell, Info, MapPinned, MessageCircle, Utensils } from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { PromotionalBannerCarousel } from '@/components/public/promotional-banner-carousel';
import { PublicAnalytics } from '@/components/public/public-analytics';
import { GrandMercureBrandSignature } from './grand-mercure-brand-signature';
import { GrandMercureMobileNavigation } from './grand-mercure-mobile-navigation';
import { GrandMercureGlobalMandala } from './grand-mercure-ornament';
import type { DomainContext } from '@/lib/domain-context';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getPublicCopy } from '@/lib/public-copy';
import type { PublicHotelPageData } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { buildPublicHotelAreaHref, buildPublicHotelHref, type PublicHotelAreaKey } from '@/lib/public-routes';

type Card = { area: PublicHotelAreaKey; title: string; description: string; icon: ElementType };

function getGrandMercureCopy(language: SupportedPublicLanguage) {
  if (language === 'en') return { welcome: 'Welcome', description: 'Your premium digital directory', help: 'Our team is available to make your experience even better.' };
  if (language === 'es') return { welcome: 'Bienvenido', description: 'Su directorio digital premium', help: 'Nuestro equipo está disponible para mejorar aún más su experiencia.' };
  return { welcome: 'Bem-vindo', description: 'Seu diretório digital premium', help: 'Nossa equipe está à disposição para proporcionar a melhor experiência.' };
}

export function GrandMercurePublicHome({ pageData, language, domainContext, preferSubdomainRoot }: {
  pageData: PublicHotelPageData; language: SupportedPublicLanguage; domainContext: DomainContext; preferSubdomainRoot: boolean;
}) {
  const { hotel, banners } = pageData;
  const copy = getPublicCopy(language);
  const grandCopy = getGrandMercureCopy(language);
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const areaHref = (area: PublicHotelAreaKey) => buildPublicHotelAreaHref({ slug: hotel.slug, area, language, domainContext, preferSubdomainRoot });
  const homeHref = buildPublicHotelHref({ slug: hotel.slug, language, domainContext, preferSubdomainRoot });
  const whatsappHref = hotel.whatsapp_number ? `https://wa.me/${String(hotel.whatsapp_number).replace(/\D/g, '')}` : null;
  const cards: Card[] = [
    { area: 'informacoes', title: copy.editorialInformationTitle, description: copy.editorialInformationDescription, icon: Info },
    { area: 'contato', title: copy.editorialContactTitle, description: copy.editorialContactDescription, icon: MessageCircle },
    { area: 'cardapio', title: copy.editorialMenuTitle, description: copy.editorialMenuDescription, icon: Utensils },
    { area: 'turismo', title: copy.editorialTourismTitle, description: copy.editorialTourismDescription, icon: MapPinned },
    { area: 'comunicados', title: copy.editorialAnnouncementsTitle, description: copy.editorialAnnouncementsDescription, icon: BellRing },
    { area: 'servicos', title: copy.editorialServicesTitle, description: copy.editorialServicesDescription, icon: ConciergeBell },
  ];
  const navigationItems = [
    { key: 'home' as const, href: homeHref, label: copy.navigationHome }, { key: 'services' as const, href: areaHref('servicos'), label: copy.navigationServices },
    { key: 'menu' as const, href: areaHref('cardapio'), label: copy.navigationMenu }, { key: 'information' as const, href: areaHref('informacoes'), label: copy.navigationInformation },
    { key: 'contact' as const, href: areaHref('contato'), label: copy.navigationContact },
  ];

  return <main className="hotel-theme-page grand-mercure-dock-layout min-h-screen" style={theme.cssVars} data-hotel-theme={theme.preset} data-hotel-icon-style={theme.iconStyle}>
    <PublicAnalytics hotelId={hotel.id} hotelSlug={hotel.slug} language={language} />
    <GrandMercureGlobalMandala />
    <div className="grand-mercure-scroll-region mx-auto max-w-[1280px] md:px-6 md:py-7">
      <section className="relative overflow-hidden bg-[#fbf7ef]/25 px-3 pt-3 pb-5 min-[360px]:px-4 md:rounded-[32px] md:border md:border-[#ddcfbb] md:px-10 md:pt-6 md:pb-9">
        {hotel.hero_image_url ? <div className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[.035] grayscale sepia" style={{ backgroundImage: `url(${JSON.stringify(hotel.hero_image_url)})` }} /> : null}
        <div className="relative flex justify-end"><LanguageSwitcher slug={hotel.slug} currentLanguage={language} basePath={preferSubdomainRoot ? '/' : undefined} /></div>
        <div className="relative -mt-1 flex justify-center md:-mt-2"><GrandMercureBrandSignature logoUrl={hotel.logo_url} /></div>
        <div className="relative mx-auto mt-1 max-w-3xl text-center md:mt-3">
          <h1 className="whitespace-pre-line font-serif text-[clamp(1.4rem,6.6vw,2rem)] font-normal leading-[1.1] text-[#a9782a] md:text-5xl">{grandCopy.welcome}</h1>
          <div className="mx-auto mt-3 h-px w-12 bg-[#c7984b]" />
          <p className="mt-2 text-xs tracking-wide text-[#81776b] min-[360px]:text-sm md:text-lg">{grandCopy.description}</p>
        </div>
      </section>

      <section className="grand-mercure-access-grid grid grid-cols-3 gap-2 px-2 min-[360px]:gap-2.5 min-[360px]:px-3 md:mt-[-1px] md:gap-5 md:px-8 lg:px-14">
        {cards.map((card) => { const Icon = card.icon; return <a key={card.area} href={areaHref(card.area)} className="group flex min-h-[158px] min-w-0 flex-col items-center overflow-hidden rounded-[18px] border border-[#e4d8c7] bg-[#fffdf9] px-1 py-3.5 text-center shadow-[0_12px_28px_-20px_rgba(60,48,32,.42)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b38337] min-[360px]:min-h-[170px] min-[360px]:px-2 min-[360px]:py-4 md:min-h-[240px] md:rounded-[24px] md:px-5 md:py-7">
          <Icon className="h-8 w-8 shrink-0 text-[#ad7d30] min-[360px]:h-9 min-[360px]:w-9 md:h-14 md:w-14" strokeWidth={1.35} />
          <div className="mt-2.5 flex max-w-full flex-col gap-1 min-[360px]:gap-1.5 md:mt-5 md:gap-2">
            <h2 className="max-w-full break-words text-[10px] font-medium leading-[1.15] text-[#292826] min-[360px]:text-[11px] min-[390px]:text-xs md:text-xl">{card.title}</h2>
            <p className="line-clamp-3 text-[8.5px] leading-[1.3] text-[#71695f] min-[360px]:text-[9px] min-[390px]:text-[10px] md:text-sm md:leading-5">{card.description}</p>
          </div>
          <ChevronDown className="mt-auto h-4 w-4 text-[#b18134] transition group-hover:translate-y-0.5" strokeWidth={1.7} />
        </a>; })}
      </section>

      <section className="grand-mercure-banner-zone mt-5 px-3 md:mt-8 md:px-8 lg:px-14"><PromotionalBannerCarousel banners={banners} language={language} showEmptyFallback /></section>

      <section className="grand-mercure-help-zone grand-mercure-last-content relative mx-3 mt-4 flex min-h-[82px] items-center gap-3 rounded-[20px] border border-[#dfd2c0] bg-[#fffdf9] py-4 pr-16 pl-4 shadow-[0_12px_30px_-24px_rgba(56,45,29,.42)] md:mx-8 md:mt-6 md:min-h-[96px] md:px-7 lg:mx-14">
        <CircleHelp className="h-7 w-7 shrink-0 text-[#b38234]" strokeWidth={1.4} />
        <p className="max-w-2xl text-xs leading-5 text-[#756b60] md:text-base">{grandCopy.help}</p>
        <a href={whatsappHref || areaHref('contato')} target={whatsappHref ? '_blank' : undefined} rel={whatsappHref ? 'noreferrer' : undefined} aria-label={whatsappHref ? copy.whatsappSupport : copy.editorialContactTitle} data-analytics-event={whatsappHref ? 'whatsapp_click' : undefined} data-analytics-target-url={whatsappHref || undefined} className="absolute -top-2 right-2 flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#f5ead8] bg-[#b78942] text-white shadow-[0_12px_24px_-12px_rgba(71,50,17,.6)] md:top-1/2 md:right-7 md:-translate-y-1/2">
          <MessageCircle className="h-8 w-8" strokeWidth={1.8} />
        </a>
      </section>
      <footer className="hidden py-7 text-center text-[10px] uppercase tracking-[.24em] text-[#82786d] md:block">Powered by <span className="normal-case tracking-normal text-[#3d3934]">LibGuest</span></footer>
    </div>
    <GrandMercureMobileNavigation items={navigationItems} activeItem="home" ariaLabel={copy.navigationLabel} />
  </main>;
}
