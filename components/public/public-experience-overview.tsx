import {RoomGuideLinks} from './room-guide-links';
import {PublicCommunications} from './public-communications';
import {publicCommunications} from '@/lib/public-communications';
import {publicEditorialHref} from '@/lib/public-editorial-link';
import {tourismEditorialHref} from '@/lib/tourism/editorial';
import {publicExperienceVersion} from '@/lib/public-experience-v4';
import {PublicExperienceMobileTasks} from './public-experience-mobile-tasks';
import Image from 'next/image';
import { editorialText } from '@/lib/public-presentation';
import { MapPin, BedDouble, Waves, Dumbbell } from 'lucide-react';
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
  const presentation = pageData.presentation;
  const version=publicExperienceVersion(presentation);
  const benefitIcons = {location:MapPin,bed:BedDouble,pool:Waves,fitness:Dumbbell};
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
  const short = language === 'en' ? {information:'Hotel',menu:'Dining',services:'Services',tourism:'Tourism',flights:'Flights',contact:'Contact'} : language === 'es' ? {information:'Hotel',menu:'Gastronomía',services:'Servicios',tourism:'Turismo',flights:'Vuelos',contact:'Contacto'} : {information:'Hotel',menu:'Gastronomia',services:'Serviços',tourism:'Turismo',flights:'Voos',contact:'Contato'};
  const links = [{ href: homeHref, label: copy.navigationHome }, ...accesses.slice().sort((a,b)=>['information','services','menu','tourism','flights','contact'].indexOf(a.key)-['information','services','menu','tourism','flights','contact'].indexOf(b.key)).map(({ href, key }) => ({ href, label: short[key as keyof typeof short] }))];
  const heroForDisplay = hero && presentation?.heroDesktopFocal ? {...hero,focal_x:presentation.heroDesktopFocal.x,focal_y:presentation.heroDesktopFocal.y} : hero;
  const editorialHref = (url:string|null) => publicEditorialHref({url,hotel,sections,language,domainContext,preferSubdomainRoot});
  const curated = pageData.tourismHomeAvailable ? (presentation?.tourism.cards ?? []).map(card=>({card,href:tourismEditorialHref(card,pageData.tourismPreview??[],hotel.id,route)})).filter(row=>row.href) : [];
  const tourism = pageData.tourismHomeAvailable ? (pageData.tourismPreview ?? []).filter(row => row.hotel_id === hotel.id && row.is_published).slice(0,3) : [];
  const hasAlerts=version==='v4'&&enabled('announcements')&&publicCommunications(hotel.id,announcements,[]).alerts.length>0;
  const header=(<header className="v3-header">
        <PublicExperienceMenu title={hotel.name} label={t.menu} links={reserve ? [...links, { href: reserve, label: t.reserve }] : links} style={theme.cssVars} />
        <a href={homeHref} className="v3-brand" aria-label={hotel.name}>{hotel.logo_url ? <><Image src={hotel.logo_url} alt={hotel.name} width={220} height={66} unoptimized /><small>{hotel.city}</small></> : <><span>{hotel.name}</span>{hotel.city ? <small>{hotel.city}</small> : null}</>}</a>
        <nav className="v3-desktop-nav" aria-label={copy.navigationLabel}>{links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
        <LanguageSwitcher compact slug={hotel.slug} currentLanguage={language} basePath={domainContext.navigationScope === 'authenticated-preview' ? '/preview' : preferSubdomainRoot ? '/' : undefined} />
        {reserve ? <a className="v3-reserve" href={reserve} target="_blank" rel="noopener noreferrer">{t.reserve}</a> : null}
      </header>);
  return <main className="hotel-theme-page public-experience-v3 min-h-dvh" style={theme.cssVars} data-hotel-theme={theme.preset} data-hotel-icon-style={theme.iconStyle} data-public-experience={version==='v4'?version:undefined}>
    <PublicAnalytics hotelSlug={hotel.slug} language={language} />
    {hasAlerts?<><div className="v4-header-strip">{header}</div><PublicCommunications data={pageData} language={language} announcementsHref={areaHref('comunicados')} mode="attention"/></>:null}
    <section className={hasAlerts?"v3-hero v4-hero-after-alert":"v3-hero"} data-v3-hero>
      <MediaPicture media={heroForDisplay} legacy={hotel.hero_image_url} hero />
      <div className="v3-hero-treatment" aria-hidden />
      {!hasAlerts?header:null}
      <div className="v3-headline">
        {activeRoomContext ? <p className="v3-room-context">{copy.activeRoomAccessLabel(activeRoomContext.roomNumber, activeRoomContext.label)}</p> : null}
        <p className="v3-eyebrow">{t.welcome}</p>
        <h1>{presentation?.heroTitleMode === 'hotel_name' ? hotel.name : hero?.title || hotel.name}</h1>
        <p className="v3-subtitle">{hero?.description || copy.heroDescription}</p>
      </div>
      <nav className="v3-accesses" aria-label={copy.navigationLabel} data-v3-accesses data-legacy-home-access>{accesses.map(item => <a key={item.key} href={item.href} data-access={item.key}><item.icon aria-hidden /><span>{item.label}</span><ChevronRight className="v3-access-arrow" aria-hidden /></a>)}</nav>
    </section>
    {version==='v4'?<PublicExperienceMobileTasks pageData={pageData} language={language} domainContext={domainContext} preferSubdomainRoot={preferSubdomainRoot}/>:null}
    <div className="v3-body">
      {pageData.hasFallbackContent ? <p role="status" className="v3-fallback">{copy.fallbackNotice}</p> : null}
      {version==='v4'?<PublicCommunications data={pageData} language={language} announcementsHref={areaHref('comunicados')} mode="offers"/>:null}
      {editorial.length ? <section className="v3-editorials" aria-label={t.hotel}>{editorial.map(row => <article key={row.slot} id={row.slot} className={`v3-editorial v3-editorial-${row.slot}`} data-editorial={row.slot}>
        <MediaPicture media={row} />
        <div className="v3-editorial-copy"><p className="v3-eyebrow">{row.slot === 'restaurant' ? t.dining : row.slot === 'about' ? t.hotel : ''}</p><h2>{row.title}</h2>{row.description ? <p>{row.description}</p> : null}{editorialHref(row.cta_url) && row.cta_label ? <a href={editorialHref(row.cta_url)!} target={editorialHref(row.cta_url)?.startsWith('https://')?'_blank':undefined} rel="noopener noreferrer">{row.cta_label}<ArrowUpRight aria-hidden className="h-4 w-4" /></a> : null}</div>
      </article>)}</section> : null}
      {version!=='v4' && enabled('banners') && banners.length ? <PromotionalBannerCarousel banners={banners} language={language} /> : null}
      {presentation?.benefits.length ? <section className="v3-amenities" aria-label={copy.editorialServicesTitle}>{presentation.benefits.map((b,i)=>{const Icon=benefitIcons[b.icon];return <div key={i}><Icon aria-hidden/><span>{editorialText(b.label,language)}</span></div>;})}</section> : enabled('services') && sections.length ? <nav className="v3-amenities" aria-label={copy.editorialServicesTitle}>{sections.slice(0, 4).map(row => <a key={row.id} href={buildPublicHotelServiceHref({ ...route, serviceId: row.id })}><ServiceIcon iconName={row.icon} className="h-7 w-7" /><span>{row.title}</span></a>)}</nav> : null}
      {version!=='v4' && enabled('announcements') && announcements.length ? <section className="v3-announcements"><h2>{copy.editorialAnnouncementsTitle}</h2>{announcements.map(row => <article key={row.id}><h3>{row.title}</h3><p>{row.body}</p></article>)}</section> : null}
      {version==='v4'?<PublicCommunications data={pageData} language={language} announcementsHref={areaHref('comunicados')} mode="updates"/>:null}
      <RoomGuideLinks data={pageData} language={language} domainContext={domainContext} preferSubdomainRoot={preferSubdomainRoot}/>
      {curated.length || tourism.length ? <section className="v3-tourism" data-v3-tourism>
        <div className="v3-tourism-intro"><p className="v3-eyebrow">{t.explore} {hotel.city}</p><h2>{curated.length && presentation ? editorialText(presentation.tourism.title,language) : tourismPublicCopy(language).title}</h2><p>{curated.length && presentation ? editorialText(presentation.tourism.description,language) : tourismPublicCopy(language).intro}</p></div>
        <div className="v3-tourism-cards">{curated.length ? curated.map(({card,href},i)=><a key={i} href={href!}>
          {card.image_path ? <Image src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/hotel-assets/${card.image_path}`} alt={editorialText(card.title,language) + (language==='en'?' — illustrative image':language==='es'?' — imagen ilustrativa':' — imagem ilustrativa')} fill sizes="(max-width:767px) 200px, 180px" unoptimized/> : null}
          <h3>{editorialText(card.title,language)}<ChevronRight aria-hidden/></h3></a>) : tourism.map(row=><a key={row.id} href={buildPublicHotelTourismItemHref({...route,itemSlug:row.slug})}>
          <TourismImage src={tourismImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,row.main_image_path,hotel.id,row.id)} alt={row.name}/><h3>{row.name}<ChevronRight aria-hidden/></h3></a>)}</div>
      </section> : null}
      <footer className="v3-footer">Powered by LibGuest</footer>
    </div>
  </main>;
}
