import Image from 'next/image';
import { ArrowUpRight, Building2, ChevronRight, ConciergeBell, MapPinned, MessageCircle, Plane, Utensils } from 'lucide-react';
import { LanguageSwitcher } from './language-switcher';
import { PublicAnalytics } from './public-analytics';
import { PromotionalBannerCarousel } from './promotional-banner-carousel';
import { PublicExperienceMenu } from './public-experience-menu';
import { TourismImage } from '@/components/tourism-image';
import { ServiceIcon } from '@/components/service-icon';
import type { DomainContext } from '@/lib/domain-context';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getPublicCopy } from '@/lib/public-copy';
import { experienceHttpsUrl, experienceMediaUrl, focalPosition, type ExperienceMedia } from '@/lib/public-experience-media';
import type { PublicHotelPageData } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { buildPublicHotelAreaHref, buildPublicHotelFlightCenterHref, buildPublicHotelHref, buildPublicHotelServiceHref, buildPublicHotelTourismItemHref, type PublicHotelAreaKey } from '@/lib/public-routes';
import { tourismImageUrl } from '@/lib/tourism/media';
import { tourismPublicCopy } from '@/lib/tourism/public-copy';

function MediaPicture({ media, legacy, hero = false }: { media?: ExperienceMedia; legacy?: string | null; hero?: boolean }) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const desktop = media ? experienceMediaUrl(media.image_path, media.hotel_id, media.slot, base) : experienceHttpsUrl(legacy);
  const mobile = media ? experienceMediaUrl(media.mobile_image_path, media.hotel_id, media.slot, base) : null;
  if (!desktop && !mobile) return null;
  const position = { '--v3-focal': focalPosition(media?.focal_x ?? 50, media?.focal_y ?? 50), '--v3-mobile-focal': focalPosition(media?.mobile_focal_x ?? 50, media?.mobile_focal_y ?? 50) } as React.CSSProperties;
  return <picture className={hero ? 'v3-hero-picture' : 'v3-editorial-picture'} style={position}>
    {mobile ? <source media="(max-width: 767px)" srcSet={mobile} /> : null}
    {/* Native picture preserves responsive art direction without a third-party image proxy. */}
    <img src={desktop ?? mobile!} alt={media?.alt_text ?? ''} loading={hero ? 'eager' : 'lazy'} fetchPriority={hero ? 'high' : 'auto'} />
  </picture>;
}

// Theme presentation only: all data, publication and entitlement decisions use shared loaders.
export function PublicExperienceOverview({ pageData, language, domainContext, preferSubdomainRoot, activeRoomContext }: {
  pageData: PublicHotelPageData; language: SupportedPublicLanguage; domainContext: DomainContext; preferSubdomainRoot: boolean;
  activeRoomContext?: { roomNumber: string | null; label: string | null } | null;
}) {
  const { hotel, sections, announcements, flightHomeCard, banners, layout } = pageData;
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const copy = getPublicCopy(language);
  const t = language === 'en' ? { hotel: 'Hotel information', dining: 'Restaurants and bars', services: 'Services', tourism: 'Tourism', flights: 'Flight center', contact: 'Contact us', reserve: 'Book', menu: 'Open navigation', explore: 'Explore', welcome: 'Welcome to' }
    : language === 'es' ? { hotel: 'Información del hotel', dining: 'Restaurantes y bares', services: 'Servicios', tourism: 'Turismo', flights: 'Central de vuelos', contact: 'Contáctenos', reserve: 'Reservar', menu: 'Abrir navegación', explore: 'Explora', welcome: 'Bienvenido a' }
    : { hotel: 'Informações do Hotel', dining: 'Restaurantes e Bares', services: 'Serviços', tourism: 'Turismo', flights: 'Central de Voos', contact: 'Fale Conosco', reserve: 'Reservar', menu: 'Abrir navegação', explore: 'Explore', welcome: 'Bem-vindo ao' };
  const route = { slug: hotel.slug, language, domainContext, preferSubdomainRoot };
  const areaHref = (area: PublicHotelAreaKey) => buildPublicHotelAreaHref({ ...route, area });
  const homeHref = buildPublicHotelHref(route);
  const enabled = (key: string) => layout.some(block => block.blockKey === key && block.isEnabled);
  const media = (pageData.experienceMedia ?? []).filter(row => row.hotel_id === hotel.id && row.is_published);
  const hero = media.find(row => row.slot === 'hero');
  const editorial = media.filter(row => row.slot !== 'hero').sort((a, b) => ['about','restaurant','accommodation'].indexOf(a.slot) - ['about','restaurant','accommodation'].indexOf(b.slot));
  const restaurant = media.find(row => row.slot === 'restaurant');
  const hasMenu = sections.some(row => row.service_action_type === 'room_restaurant_menu');
  const reserve = experienceHttpsUrl(hotel.booking_url);
  const hasContact = enabled('contact') && Boolean(hotel.whatsapp_number || experienceHttpsUrl(hotel.website_url) || reserve || pageData.departments.length);
  const accesses = [
    ...(enabled('quick_info') ? [{ key: 'information', href: areaHref('informacoes'), label: t.hotel, icon: Building2 }] : []),
    ...(restaurant || hasMenu ? [{ key: 'menu', href: restaurant ? '#restaurant' : areaHref('cardapio'), label: t.dining, icon: Utensils }] : []),
    ...(enabled('services') && sections.length ? [{ key: 'services', href: areaHref('servicos'), label: t.services, icon: ConciergeBell }] : []),
    ...(pageData.tourismHomeAvailable ? [{ key: 'tourism', href: areaHref('turismo'), label: t.tourism, icon: MapPinned }] : []),
    ...(flightHomeCard ? [{ key: 'flights', href: buildPublicHotelFlightCenterHref(route), label: t.flights, icon: Plane }] : []),
    ...(hasContact ? [{ key: 'contact', href: areaHref('contato'), label: t.contact, icon: MessageCircle }] : []),
  ];
  const links = [{ href: homeHref, label: copy.navigationHome }, ...accesses.map(({ href, label }) => ({ href, label }))];
  const tourism = pageData.tourismHomeAvailable ? (pageData.tourismPreview ?? []).filter(row => row.hotel_id === hotel.id && row.is_published) : [];
  return <main className="hotel-theme-page public-experience-v3 min-h-dvh" style={theme.cssVars} data-hotel-theme={theme.preset} data-hotel-icon-style={theme.iconStyle}>
    <PublicAnalytics hotelSlug={hotel.slug} language={language} />
    <section className="v3-hero" data-v3-hero>
      <MediaPicture media={hero} legacy={hotel.hero_image_url} hero />
      <div className="v3-hero-treatment" aria-hidden />
      <header className="v3-header">
        <PublicExperienceMenu title={hotel.name} label={t.menu} links={reserve ? [...links, { href: reserve, label: t.reserve }] : links} style={theme.cssVars} />
        <a href={homeHref} className="v3-brand" aria-label={hotel.name}>{hotel.logo_url ? <Image src={hotel.logo_url} alt={hotel.name} width={170} height={72} unoptimized /> : <><span>{hotel.name}</span>{hotel.city ? <small>{hotel.city}</small> : null}</>}</a>
        <nav className="v3-desktop-nav" aria-label={copy.navigationLabel}>{links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
        <LanguageSwitcher compact slug={hotel.slug} currentLanguage={language} basePath={preferSubdomainRoot ? '/' : undefined} />
        {reserve ? <a className="v3-reserve" href={reserve} target="_blank" rel="noopener noreferrer">{t.reserve}</a> : null}
      </header>
      <div className="v3-headline">
        {activeRoomContext ? <p className="v3-room-context">{copy.activeRoomAccessLabel(activeRoomContext.roomNumber, activeRoomContext.label)}</p> : null}
        <p className="v3-eyebrow">{t.welcome}</p>
        <h1>{hero?.title || hotel.name}</h1>
        <p className="v3-subtitle">{hero?.description || copy.heroDescription}</p>
      </div>
      <nav className="v3-accesses" aria-label={copy.navigationLabel} data-v3-accesses>{accesses.map(item => <a key={item.key} href={item.href} data-access={item.key}><item.icon aria-hidden /><span>{item.label}</span><ChevronRight className="v3-access-arrow" aria-hidden /></a>)}</nav>
    </section>
    <div className="v3-body">
      {pageData.hasFallbackContent ? <p role="status" className="v3-fallback">{copy.fallbackNotice}</p> : null}
      {editorial.length ? <section className="v3-editorials" aria-label={t.hotel}>{editorial.map(row => <article key={row.slot} id={row.slot} className={`v3-editorial v3-editorial-${row.slot}`} data-editorial={row.slot}>
        <MediaPicture media={row} />
        <div className="v3-editorial-copy"><p className="v3-eyebrow">{row.slot === 'restaurant' ? t.dining : row.slot === 'about' ? t.hotel : ''}</p><h2>{row.title}</h2>{row.description ? <p>{row.description}</p> : null}{experienceHttpsUrl(row.cta_url) && row.cta_label ? <a href={experienceHttpsUrl(row.cta_url)!} target="_blank" rel="noopener noreferrer">{row.cta_label}<ArrowUpRight aria-hidden className="h-4 w-4" /></a> : null}</div>
      </article>)}</section> : null}
      {enabled('banners') && banners.length ? <PromotionalBannerCarousel banners={banners} language={language} /> : null}
      {enabled('services') && sections.length ? <nav className="v3-amenities" aria-label={copy.editorialServicesTitle}>{sections.slice(0, 4).map(row => <a key={row.id} href={buildPublicHotelServiceHref({ ...route, serviceId: row.id })}><ServiceIcon iconName={row.icon} className="h-7 w-7" /><span>{row.title}</span></a>)}</nav> : null}
      {enabled('announcements') && announcements.length ? <section className="v3-announcements"><h2>{copy.editorialAnnouncementsTitle}</h2>{announcements.map(row => <article key={row.id}><h3>{row.title}</h3><p>{row.body}</p></article>)}</section> : null}
      {tourism.length ? <section className="v3-tourism" data-v3-tourism><div><p className="v3-eyebrow">{t.explore} {hotel.city}</p><h2>{tourismPublicCopy(language).title}</h2><p>{tourismPublicCopy(language).intro}</p></div>{tourism.map(row => <a key={row.id} href={buildPublicHotelTourismItemHref({ ...route, itemSlug: row.slug })}>
        <TourismImage src={tourismImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, row.main_image_path, hotel.id, row.id)} alt={row.name} /><h3>{row.name}</h3><p>{row.short_description}</p>
      </a>)}</section> : null}
      <footer className="v3-footer">Powered by LibGuest</footer>
    </div>
  </main>;
}
