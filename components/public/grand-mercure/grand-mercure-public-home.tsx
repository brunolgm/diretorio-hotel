import type { ElementType } from 'react';
import { BellRing, ChevronDown, CircleHelp, ConciergeBell, Info, MessageCircle } from 'lucide-react';
import { ExperienceBlockComposer } from '@/components/public/experience-block-composer';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { PromotionalBannerCarousel } from '@/components/public/promotional-banner-carousel';
import { PublicAnalytics } from '@/components/public/public-analytics';
import { GrandMercureBrandSignature } from './grand-mercure-brand-signature';
import { GrandMercureBrazilianPillars } from './grand-mercure-brazilian-pillars';
import { GrandMercureMobileNavigation } from './grand-mercure-mobile-navigation';
import { GrandMercureGlobalMandala } from './grand-mercure-ornament';
import type { DomainContext } from '@/lib/domain-context';
import { getGrandMercurePropertyLabel, isGrandMercureRioCopacabanaProperty } from '@/lib/grand-mercure-property';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getPublicCopy } from '@/lib/public-copy';
import type { PublicHotelPageData } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { buildPublicHotelAreaHref, buildPublicHotelHref, type PublicHotelAreaKey } from '@/lib/public-routes';
import { getThemedCardGridLayout } from '@/lib/themed-card-grid';

type Card = {
  blockKey: 'quick_info' | 'contact' | 'announcements' | 'services';
  area: PublicHotelAreaKey;
  title: string;
  description: string;
  icon: ElementType;
};

function getGrandMercureCopy(language: SupportedPublicLanguage) {
  if (language === 'en') return { welcome: 'Welcome', description: 'An experience in every detail', help: 'Our team is available to make your experience even better.' };
  if (language === 'es') return { welcome: 'Bienvenido', description: 'Una experiencia en cada detalle', help: 'Nuestro equipo está disponible para mejorar aún más su experiencia.' };
  return { welcome: 'Bem-vindo', description: 'Uma experiência em cada detalhe', help: 'Nossa equipe está à disposição para proporcionar a melhor experiência.' };
}

export function GrandMercurePublicHome({ pageData, language, domainContext, preferSubdomainRoot }: {
  pageData: PublicHotelPageData; language: SupportedPublicLanguage; domainContext: DomainContext; preferSubdomainRoot: boolean;
}) {
  const { hotel, banners, announcements, sections, layout } = pageData;
  const copy = getPublicCopy(language);
  const grandCopy = getGrandMercureCopy(language);
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const propertyLabel = getGrandMercurePropertyLabel(hotel.name);
  const showRioCopacabanaEditorial = isGrandMercureRioCopacabanaProperty(hotel);
  const areaHref = (area: PublicHotelAreaKey) => buildPublicHotelAreaHref({ slug: hotel.slug, area, language, domainContext, preferSubdomainRoot });
  const homeHref = buildPublicHotelHref({ slug: hotel.slug, language, domainContext, preferSubdomainRoot });
  const whatsappHref = hotel.whatsapp_number ? `https://wa.me/${String(hotel.whatsapp_number).replace(/\D/g, '')}` : null;
  const enabled = (key: string) => layout.some((block) => block.blockKey === key && block.isEnabled);
  const position = (key: Card['blockKey']) => layout.find((block) => block.blockKey === key)?.position ?? 99;
  const cards: Card[] = [
    { blockKey: 'quick_info' as const, area: 'informacoes' as const, title: copy.editorialInformationTitle, description: copy.editorialInformationDescription, icon: Info },
    { blockKey: 'contact' as const, area: 'contato' as const, title: copy.editorialContactTitle, description: copy.editorialContactDescription, icon: MessageCircle },
    ...(announcements.length ? [{ blockKey: 'announcements' as const, area: 'comunicados' as const, title: copy.editorialAnnouncementsTitle, description: copy.editorialAnnouncementsDescription, icon: BellRing }] : []),
    ...(sections.length ? [{ blockKey: 'services' as const, area: 'servicos' as const, title: copy.editorialServicesTitle, description: copy.editorialServicesDescription, icon: ConciergeBell }] : []),
  ].filter((card) => enabled(card.blockKey)).sort((a, b) => position(a.blockKey) - position(b.blockKey));
  const cardGrid = cards.length ? getThemedCardGridLayout(cards.length, 3) : null;
  const navigationItems = [
    { key: 'home' as const, href: homeHref, label: copy.navigationHome },
    ...(enabled('services') && sections.length ? [{ key: 'services' as const, href: areaHref('servicos'), label: copy.navigationServices }] : []),
    ...(enabled('quick_info') ? [{ key: 'information' as const, href: areaHref('informacoes'), label: copy.navigationInformation }] : []),
    ...(enabled('contact') ? [{ key: 'contact' as const, href: areaHref('contato'), label: copy.navigationContact }] : []),
  ];
  const blocks = {
    hero: <section className="relative overflow-hidden bg-[#fbf7ef]/25 px-3 pt-3 pb-5 min-[360px]:px-4 md:rounded-[32px] md:border md:border-[#ddcfbb] md:px-10 md:pt-6 md:pb-9">
      {hotel.hero_image_url ? <div className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[.035] grayscale sepia" style={{ backgroundImage: `url(${JSON.stringify(hotel.hero_image_url)})` }} /> : null}
      <div className="relative flex justify-end"><LanguageSwitcher slug={hotel.slug} currentLanguage={language} basePath={preferSubdomainRoot ? '/' : undefined} /></div>
      <div className="relative -mt-1 flex justify-center md:-mt-2"><GrandMercureBrandSignature logoUrl={hotel.logo_url} propertyLabel={propertyLabel} /></div>
      <div className="relative mx-auto mt-1 max-w-3xl text-center md:mt-3">
        <h1 className="whitespace-pre-line font-serif text-[clamp(1.4rem,6.6vw,2rem)] font-normal leading-[1.1] text-[#a9782a] md:text-5xl">{grandCopy.welcome}</h1>
        <div className="mx-auto mt-3 h-px w-12 bg-[#c7984b]" />
        <p className="mt-2 text-xs tracking-wide text-[#81776b] min-[360px]:text-sm md:text-lg">{grandCopy.description}</p>
      </div>
    </section>,
    quick_info: cardGrid ? <section className={`grand-mercure-access-grid grid gap-2 px-2 min-[360px]:gap-2.5 min-[360px]:px-3 md:mt-[-1px] md:gap-5 md:px-8 lg:px-14 ${cardGrid.containerClassName} ${cardGrid.singleCard ? 'mx-auto w-full max-w-md' : ''}`}>
      {cards.map((card, index) => { const Icon = card.icon; return <a key={card.area} href={areaHref(card.area)} className={`group flex min-h-[158px] min-w-0 flex-col items-center overflow-hidden rounded-[18px] border border-[#e4d8c7] bg-[#fffdf9] px-1 py-3.5 text-center shadow-[0_12px_28px_-20px_rgba(60,48,32,.42)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b38337] min-[360px]:min-h-[170px] min-[360px]:px-2 min-[360px]:py-4 md:min-h-[240px] md:rounded-[24px] md:px-5 md:py-7 ${cardGrid.itemClassName(index)}`}>
        <Icon className="h-8 w-8 shrink-0 text-[#ad7d30] min-[360px]:h-9 min-[360px]:w-9 md:h-14 md:w-14" strokeWidth={1.35} />
        <div className="mt-2.5 flex max-w-full flex-col gap-1 min-[360px]:gap-1.5 md:mt-5 md:gap-2">
          <h2 className="max-w-full break-words text-[10px] font-medium leading-[1.15] text-[#292826] min-[360px]:text-[11px] min-[390px]:text-xs md:text-xl">{card.title}</h2>
          <p className="line-clamp-3 text-[8.5px] leading-[1.3] text-[#71695f] min-[360px]:text-[9px] min-[390px]:text-[10px] md:text-sm md:leading-5">{card.description}</p>
        </div>
        <ChevronDown className="mt-auto h-4 w-4 text-[#b18134] transition group-hover:translate-y-0.5" strokeWidth={1.7} />
      </a>; })}
    </section> : null,
    banners: <section className="grand-mercure-banner-zone mt-5 px-3 md:mt-8 md:px-8 lg:px-14"><PromotionalBannerCarousel banners={banners} language={language} showEmptyFallback /></section>,
    announcements: null,
    services: null,
    departments: null,
    policies: null,
    contact: null,
  };
  const supportStrip = enabled('contact') ? <section className="grand-mercure-help-zone grand-mercure-last-content relative mx-3 mt-4 flex min-h-[82px] items-center gap-3 rounded-[20px] border border-[#dfd2c0] bg-[#fffdf9] py-4 pr-16 pl-4 shadow-[0_12px_30px_-24px_rgba(56,45,29,.42)] md:mx-8 md:mt-6 md:min-h-[96px] md:px-7 lg:mx-14">
      <CircleHelp className="h-7 w-7 shrink-0 text-[#b38234]" strokeWidth={1.4} />
      <p className="max-w-2xl text-xs leading-5 text-[#756b60] md:text-base">{grandCopy.help}</p>
      <a href={whatsappHref || areaHref('contato')} target={whatsappHref ? '_blank' : undefined} rel={whatsappHref ? 'noreferrer' : undefined} aria-label={whatsappHref ? copy.whatsappSupport : copy.editorialContactTitle} data-analytics-event={whatsappHref ? 'whatsapp_click' : undefined} data-analytics-target-url={whatsappHref || undefined} className="absolute -top-2 right-2 flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#f5ead8] bg-[#b78942] text-white shadow-[0_12px_24px_-12px_rgba(71,50,17,.6)] md:top-1/2 md:right-7 md:-translate-y-1/2">
        <MessageCircle className="h-8 w-8" strokeWidth={1.8} />
      </a>
    </section> : null;

  return <main className="hotel-theme-page grand-mercure-dock-layout min-h-screen" style={theme.cssVars} data-hotel-theme={theme.preset} data-hotel-icon-style={theme.iconStyle}>
    <PublicAnalytics hotelSlug={hotel.slug} language={language} />
    <GrandMercureGlobalMandala />
    <div className="grand-mercure-scroll-region mx-auto flex max-w-[1280px] flex-col md:px-6 md:py-7">
      <ExperienceBlockComposer layout={layout} blocks={blocks} />
      {showRioCopacabanaEditorial ? <GrandMercureBrazilianPillars language={language} /> : null}
      {supportStrip}
      <footer className="hidden py-7 text-center text-[10px] uppercase tracking-[.24em] text-[#82786d] md:block">Powered by <span className="normal-case tracking-normal text-[#3d3934]">LibGuest</span></footer>
    </div>
    <GrandMercureMobileNavigation items={navigationItems} activeItem="home" ariaLabel={copy.navigationLabel} />
  </main>;
}
