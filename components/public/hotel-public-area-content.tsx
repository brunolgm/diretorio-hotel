import {
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  CalendarCheck,
  Camera,
  ChevronRight,
  Clock3,
  Coffee,
  Hotel,
  Globe2,
  Info,
  MapPinned,
  MessageCircle,
  Phone,
  ShieldCheck,
  Utensils,
  Wifi,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { GrandMercureAreaHero } from '@/components/public/grand-mercure/grand-mercure-area-hero';
import { GrandMercureGlobalMandala } from '@/components/public/grand-mercure/grand-mercure-ornament';
import { GrandMercureMobileNavigation } from '@/components/public/grand-mercure/grand-mercure-mobile-navigation';
import { NovotelAreaHero } from '@/components/public/novotel/novotel-area-hero';
import { NovotelMobileNavigation, type NovotelNavigationKey } from '@/components/public/novotel/novotel-mobile-navigation';
import { NovotelServiceExplorer } from '@/components/public/novotel/novotel-service-explorer';
import { MercureAreaHero } from '@/components/public/mercure/mercure-area-hero';
import { MercureBottomDock } from '@/components/public/mercure/mercure-bottom-dock';
import { PublicAnalytics } from '@/components/public/public-analytics';
import { ServiceIcon } from '@/components/service-icon';
import type { DomainContext } from '@/lib/domain-context';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getRoomMenuSection, getTourismSections } from '@/lib/public-hotel-areas';
import { getPublicCopy } from '@/lib/public-copy';
import type { PublicHotelPageData, PublicHotelSection } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import {
  buildPublicHotelAreaHref,
  buildPublicHotelHref,
  type PublicHotelAreaKey,
} from '@/lib/public-routes';
import { getServiceDestination } from '@/lib/service-destinations';

function getAreaCopy(language: SupportedPublicLanguage) {
  if (language === 'en') {
    return {
      back: 'Back to home', emptyTitle: 'Nothing published here yet', emptyDescription: 'This area will be updated by the hotel team soon.',
      informationTitle: 'Information', informationDescription: 'Essential details and hotel guidelines for your stay.',
      contactTitle: 'Online Contact', contactDescription: 'Official channels to talk to the hotel team.',
      menuTitle: 'Menu', menuDescription: 'Access the menu configured for your room.',
      tourismTitle: 'Tourism', tourismDescription: 'Local experiences and useful destinations published by the hotel.',
      announcementsTitle: 'Announcements', announcementsDescription: 'Current notices and updates from the hotel.',
      servicesTitle: 'Hotel Services', servicesDescription: 'All services currently available during your stay.',
      open: 'Open', instagram: 'Instagram', noMenu: 'The room menu is not configured yet. Contact the hotel team for assistance.',
      searchServices: 'Search services', allCategories: 'All categories', uncategorized: 'Other services',
      resultLabel: 'service(s) found', actionAvailable: 'Action available',
      noResultsTitle: 'No services found', noResultsDescription: 'Try another search or category.',
    };
  }
  if (language === 'es') {
    return {
      back: 'Volver al inicio', emptyTitle: 'Aún no hay contenido publicado', emptyDescription: 'El equipo del hotel actualizará esta área próximamente.',
      informationTitle: 'Información', informationDescription: 'Datos esenciales y orientaciones del hotel para su estadía.',
      contactTitle: 'Contacto Online', contactDescription: 'Canales oficiales para hablar con el equipo del hotel.',
      menuTitle: 'Menú', menuDescription: 'Acceda al menú configurado para su habitación.',
      tourismTitle: 'Turismo', tourismDescription: 'Experiencias locales y destinos publicados por el hotel.',
      announcementsTitle: 'Comunicados', announcementsDescription: 'Avisos y novedades actuales del hotel.',
      servicesTitle: 'Servicios del Hotel', servicesDescription: 'Todos los servicios disponibles durante su estadía.',
      open: 'Abrir', instagram: 'Instagram', noMenu: 'El menú de la habitación aún no está configurado. Contacte al equipo del hotel.',
      searchServices: 'Buscar servicios', allCategories: 'Todas las categorías', uncategorized: 'Otros servicios',
      resultLabel: 'servicio(s) encontrado(s)', actionAvailable: 'Acción disponible',
      noResultsTitle: 'No se encontraron servicios', noResultsDescription: 'Pruebe otra búsqueda o categoría.',
    };
  }
  return {
    back: 'Voltar ao início', emptyTitle: 'Ainda não há conteúdo publicado', emptyDescription: 'A equipe do hotel atualizará esta área em breve.',
    informationTitle: 'Informações', informationDescription: 'Dados essenciais e orientações do hotel para sua estadia.',
    contactTitle: 'Contato Online', contactDescription: 'Canais oficiais para falar com a equipe do hotel.',
    menuTitle: 'Cardápio', menuDescription: 'Acesse o cardápio configurado para seu apartamento.',
    tourismTitle: 'Turismo', tourismDescription: 'Experiências locais e destinos publicados pelo hotel.',
    announcementsTitle: 'Comunicados', announcementsDescription: 'Avisos e novidades atuais do hotel.',
    servicesTitle: 'Serviços do Hotel', servicesDescription: 'Todos os serviços disponíveis durante sua estadia.',
    open: 'Abrir', instagram: 'Instagram', noMenu: 'O cardápio do apartamento ainda não está configurado. Fale com a equipe do hotel.',
    searchServices: 'Buscar serviços', allCategories: 'Todas as categorias', uncategorized: 'Outros serviços',
    resultLabel: 'serviço(s) encontrado(s)', actionAvailable: 'Ação disponível',
    noResultsTitle: 'Nenhum serviço encontrado', noResultsDescription: 'Tente outra busca ou categoria.',
  };
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="hotel-public-empty-state relative mx-auto max-w-2xl overflow-hidden rounded-[24px] border border-dashed border-[color:var(--hotel-border)] bg-white p-8 text-center shadow-[0_18px_42px_-34px_rgba(15,23,42,0.24)]">
      <Info className="mx-auto h-8 w-8 text-[color:var(--hotel-accent)]" />
      <h2 className="mt-4 text-lg font-semibold text-[color:var(--hotel-primary)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--hotel-text-muted)]">{description}</p>
    </div>
  );
}

function ServiceList({
  sections,
  pageData,
  language,
  domainContext,
  preferSubdomainRoot,
  openLabel,
}: {
  sections: PublicHotelSection[];
  pageData: PublicHotelPageData;
  language: SupportedPublicLanguage;
  domainContext: DomainContext;
  preferSubdomainRoot: boolean;
  openLabel: string;
}) {
  return (
    <div className="hotel-public-content-grid grid gap-4 md:grid-cols-2">
      {sections.map((section) => {
        const destination = getServiceDestination(section, pageData.hotel.slug, language, domainContext, { preferSubdomainRoot });
        return (
          <article key={section.id} className="hotel-public-content-card rounded-[24px] bg-white p-5 shadow-[0_18px_42px_-32px_rgba(0,43,92,0.26)] ring-1 ring-[color:var(--hotel-border)]">
            <div className="flex items-start gap-4">
              <div className="hotel-theme-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border">
                <ServiceIcon iconName={section.icon} className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-semibold text-[color:var(--hotel-primary)]">{section.title}</h2>
                {section.category ? <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--hotel-accent)]">{section.category}</p> : null}
                <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[color:var(--hotel-text-muted)]">{section.content}</p>
                {destination ? (
                  <a href={destination.href} target={destination.isExternal ? '_blank' : undefined} rel={destination.isExternal ? 'noreferrer' : undefined} className="mt-4 inline-flex min-h-11 items-center rounded-[14px] bg-[var(--hotel-accent)] px-4 text-sm font-semibold text-[color:var(--hotel-accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] focus-visible:ring-offset-2">
                    {section.cta || openLabel}
                    {destination.isExternal ? <ArrowUpRight className="ml-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function HotelPublicAreaContent({
  pageData,
  area,
  language,
  domainContext,
  preferSubdomainRoot,
}: {
  pageData: PublicHotelPageData;
  area: PublicHotelAreaKey;
  language: SupportedPublicLanguage;
  domainContext: DomainContext;
  preferSubdomainRoot: boolean;
}) {
  const { hotel, sections, departments, policies, announcements } = pageData;
  const copy = getPublicCopy(language);
  const areaCopy = getAreaCopy(language);
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const isNovotel = theme.preset === 'novotel';
  const isGrandMercure = theme.preset === 'grand-mercure';
  const isMercure = theme.preset === 'mercure';
  const isBrandExperience = isNovotel || isGrandMercure || isMercure;
  const buildAreaHref = (value: PublicHotelAreaKey) => buildPublicHotelAreaHref({ slug: hotel.slug, area: value, language, domainContext, preferSubdomainRoot });
  const homeHref = buildPublicHotelHref({ slug: hotel.slug, language, domainContext, preferSubdomainRoot });
  const basePath = buildPublicHotelAreaHref({ slug: hotel.slug, area, language: 'pt', domainContext, preferSubdomainRoot });
  const navigationItems = [
    { key: 'home' as const, href: homeHref, label: copy.navigationHome },
    { key: 'services' as const, href: buildAreaHref('servicos'), label: copy.navigationServices },
    { key: 'menu' as const, href: buildAreaHref('cardapio'), label: copy.navigationMenu },
    { key: 'information' as const, href: buildAreaHref('informacoes'), label: copy.navigationInformation },
    { key: 'contact' as const, href: buildAreaHref('contato'), label: copy.navigationContact },
  ];
  const activeItem: NovotelNavigationKey = area === 'servicos' ? 'services' : area === 'cardapio' ? 'menu' : area === 'informacoes' ? 'information' : area === 'contato' ? 'contact' : 'home';
  const areaMeta = {
    informacoes: { title: areaCopy.informationTitle, description: areaCopy.informationDescription, icon: Info },
    contato: { title: areaCopy.contactTitle, description: areaCopy.contactDescription, icon: MessageCircle },
    cardapio: { title: areaCopy.menuTitle, description: areaCopy.menuDescription, icon: Utensils },
    turismo: { title: areaCopy.tourismTitle, description: areaCopy.tourismDescription, icon: MapPinned },
    comunicados: { title: areaCopy.announcementsTitle, description: areaCopy.announcementsDescription, icon: BellRing },
    servicos: { title: areaCopy.servicesTitle, description: areaCopy.servicesDescription, icon: Hotel },
  }[area];
  const AreaIcon = areaMeta.icon;
  const whatsappHref = hotel.whatsapp_number ? `https://wa.me/${String(hotel.whatsapp_number).replace(/\D/g, '')}` : null;
  const institutionalLinks = [
    hotel.booking_url
      ? { href: hotel.booking_url, label: copy.bookNow, event: 'booking_click', icon: CalendarCheck }
      : null,
    hotel.website_url
      ? { href: hotel.website_url, label: copy.officialWebsite, event: 'website_click', icon: Globe2 }
      : null,
    hotel.instagram_url
      ? { href: hotel.instagram_url, label: areaCopy.instagram, event: null, icon: Camera }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const tourismSections = getTourismSections(sections);
  const roomMenuSection = getRoomMenuSection(sections);
  const serviceExplorerItems = sections.map((section) => {
    const destination = getServiceDestination(section, hotel.slug, language, domainContext, {
      preferSubdomainRoot,
    });
    return {
      id: section.id,
      title: section.title,
      content: section.content,
      category: section.category,
      icon: section.icon,
      cta: section.cta,
      href: destination?.href || null,
      isExternal: destination?.isExternal || false,
    };
  });

  return (
    <main className={`hotel-theme-page min-h-screen ${isGrandMercure ? 'grand-mercure-dock-layout' : isNovotel ? 'pb-[calc(7.5rem+env(safe-area-inset-bottom))] min-[1025px]:pb-12' : isMercure ? 'mercure-internal-page pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-[1025px]:pb-12' : 'pb-10'}`} style={theme.cssVars} data-hotel-theme={theme.preset} data-hotel-icon-style={theme.iconStyle}>
      <PublicAnalytics hotelId={hotel.id} hotelSlug={hotel.slug} language={language} />
      {isGrandMercure ? <GrandMercureGlobalMandala internal /> : null}
      <div className={`mx-auto px-4 py-5 md:px-6 md:py-8 ${isGrandMercure ? 'grand-mercure-scroll-region' : ''} ${isBrandExperience ? 'max-w-7xl' : 'max-w-5xl'}`}>
        {isNovotel ? (
          <NovotelAreaHero
            hotel={hotel}
            language={language}
            languageBasePath={basePath}
            homeHref={homeHref}
            backLabel={areaCopy.back}
            title={areaMeta.title}
            description={areaMeta.description}
            icon={AreaIcon}
          />
        ) : isGrandMercure ? (
          <GrandMercureAreaHero
            hotel={hotel}
            language={language}
            languageBasePath={basePath}
            homeHref={homeHref}
            backLabel={areaCopy.back}
            title={areaMeta.title}
            description={areaMeta.description}
            icon={AreaIcon}
          />
        ) : isMercure ? (
          <MercureAreaHero
            hotel={hotel}
            language={language}
            languageBasePath={basePath}
            homeHref={homeHref}
            backLabel={areaCopy.back}
            title={areaMeta.title}
            description={areaMeta.description}
            icon={AreaIcon}
          />
        ) : (
          <header className="relative overflow-hidden rounded-[28px] bg-[var(--hotel-hero-background)] p-5 text-white shadow-[0_24px_60px_-38px_rgba(0,43,92,0.8)] md:p-8">
            <div className="absolute inset-0 bg-[image:var(--hotel-hero-overlay)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <a href={homeHref} className="inline-flex min-h-11 items-center rounded-full border border-white/20 bg-white/10 px-4 text-sm font-medium text-white backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <ArrowLeft className="mr-2 h-4 w-4" />{areaCopy.back}
                </a>
                <LanguageSwitcher slug={hotel.slug} currentLanguage={language} basePath={basePath} />
              </div>
              <div className="mt-10 max-w-2xl">
                <AreaIcon className="h-10 w-10" strokeWidth={1.8} />
                <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{areaMeta.title}</h1>
                <p className="mt-3 text-sm leading-6 text-blue-50 md:text-base md:leading-7">{areaMeta.description}</p>
              </div>
            </div>
          </header>
        )}

        <section className={`mt-6 ${isGrandMercure ? 'grand-mercure-last-content mb-8 md:mb-4' : isNovotel || isMercure ? 'mb-8 md:mb-4' : ''}`}>
          {area === 'informacoes' ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { icon: Coffee, title: copy.breakfast, value: hotel.breakfast_hours || copy.notInformed },
                  {
                    icon: Wifi,
                    title: copy.wifi,
                    value: hotel.wifi_name || copy.notInformed,
                    helper: hotel.wifi_password
                      ? copy.passwordLabel(hotel.wifi_password)
                      : copy.askFrontDesk,
                  },
                  { icon: Clock3, title: copy.checkIn, value: hotel.checkin_time || copy.notInformed },
                  { icon: Clock3, title: copy.checkOut, value: hotel.checkout_time || copy.notInformed },
                ].map((item) => (
                  <div key={item.title} className="hotel-public-content-card rounded-[22px] bg-white p-4 shadow-[0_16px_36px_-30px_rgba(0,43,92,0.26)] ring-1 ring-[color:var(--hotel-border)]">
                    <item.icon className="h-6 w-6 text-[color:var(--hotel-accent)]" />
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-[color:var(--hotel-text-muted)]">{item.title}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-[color:var(--hotel-primary)]">{item.value}</p>
                    {'helper' in item && item.helper ? (
                      <p className="mt-1 break-words text-xs text-[color:var(--hotel-text-muted)]">{item.helper}</p>
                    ) : null}
                  </div>
                ))}
              </div>
              {policies.length ? <div className="grid gap-3 md:grid-cols-2">{policies.map((policy) => <article key={policy.id} className="hotel-public-content-card rounded-[22px] bg-white p-5 ring-1 ring-[color:var(--hotel-border)]"><ShieldCheck className="h-6 w-6 text-[color:var(--hotel-accent)]" /><h2 className="mt-3 font-semibold text-[color:var(--hotel-primary)]">{policy.title}</h2><p className="mt-2 text-sm leading-6 text-[color:var(--hotel-text-muted)]">{policy.description}</p></article>)}</div> : <EmptyState title={areaCopy.emptyTitle} description={areaCopy.emptyDescription} />}
            </div>
          ) : null}
          {area === 'contato' ? (
            departments.length || whatsappHref || institutionalLinks.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" data-analytics-event="whatsapp_click" data-analytics-target-url={whatsappHref} data-analytics-label="Public contact area" className="hotel-public-content-card rounded-[24px] bg-white p-5 ring-1 ring-[color:var(--hotel-border)]"><MessageCircle className="h-7 w-7 text-[color:var(--hotel-accent)]" /><h2 className="mt-4 font-semibold text-[color:var(--hotel-primary)]">WhatsApp</h2><p className="mt-2 text-sm text-[color:var(--hotel-text-muted)]">{copy.whatsappSupport}</p></a> : null}
                {institutionalLinks.map((item) => {
                  const LinkIcon = item.icon;
                  return <a key={item.href} href={item.href} target="_blank" rel="noreferrer" data-analytics-event={item.event || undefined} data-analytics-target-url={item.event ? item.href : undefined} className="hotel-public-content-card rounded-[24px] bg-white p-5 ring-1 ring-[color:var(--hotel-border)]"><LinkIcon className="h-7 w-7 text-[color:var(--hotel-accent)]" /><h2 className="mt-4 font-semibold text-[color:var(--hotel-primary)]">{item.label}</h2><p className="mt-2 text-sm text-[color:var(--hotel-text-muted)]">{areaCopy.open}<ArrowUpRight className="ml-1 inline h-4 w-4" /></p></a>;
                })}
                {departments.map((department) => <article key={department.id} className="hotel-public-content-card rounded-[24px] bg-white p-5 ring-1 ring-[color:var(--hotel-border)]"><Phone className="h-7 w-7 text-[color:var(--hotel-accent)]" /><h2 className="mt-4 font-semibold text-[color:var(--hotel-primary)]">{department.name}</h2><p className="mt-2 text-sm leading-6 text-[color:var(--hotel-text-muted)]">{department.description}</p>{department.url ? <a href={department.url} target="_blank" rel="noreferrer" data-analytics-event="department_click" data-analytics-department-id={department.id} data-analytics-target-url={department.url} className="mt-4 inline-flex min-h-11 items-center rounded-[14px] bg-[var(--hotel-accent)] px-4 text-sm font-semibold text-[color:var(--hotel-accent-foreground)]">{department.action || areaCopy.open}<ChevronRight className="ml-2 h-4 w-4" /></a> : null}</article>)}
              </div>
            ) : <EmptyState title={areaCopy.emptyTitle} description={areaCopy.emptyDescription} />
          ) : null}
          {area === 'cardapio' ? roomMenuSection ? <ServiceList sections={[roomMenuSection]} pageData={pageData} language={language} domainContext={domainContext} preferSubdomainRoot={preferSubdomainRoot} openLabel={areaCopy.open} /> : <EmptyState title={areaCopy.emptyTitle} description={areaCopy.noMenu} /> : null}
          {area === 'turismo' ? tourismSections.length ? <ServiceList sections={tourismSections} pageData={pageData} language={language} domainContext={domainContext} preferSubdomainRoot={preferSubdomainRoot} openLabel={areaCopy.open} /> : <EmptyState title={areaCopy.emptyTitle} description={areaCopy.emptyDescription} /> : null}
          {area === 'comunicados' ? announcements.length ? <div className="grid gap-4 md:grid-cols-2">{announcements.map((announcement) => <article key={announcement.id} className="hotel-public-content-card rounded-[24px] bg-white p-5 ring-1 ring-[color:var(--hotel-border)]"><BellRing className="h-7 w-7 text-[color:var(--hotel-accent)]" /><h2 className="mt-4 font-semibold text-[color:var(--hotel-primary)]">{announcement.title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[color:var(--hotel-text-muted)]">{announcement.body}</p></article>)}</div> : <EmptyState title={areaCopy.emptyTitle} description={areaCopy.emptyDescription} /> : null}
          {area === 'servicos' ? sections.length ? isBrandExperience ? (
            <NovotelServiceExplorer
              items={serviceExplorerItems}
              labels={{
                searchPlaceholder: areaCopy.searchServices,
                allCategories: areaCopy.allCategories,
                uncategorized: areaCopy.uncategorized,
                resultLabel: areaCopy.resultLabel,
                actionAvailable: areaCopy.actionAvailable,
                open: areaCopy.open,
                noResultsTitle: areaCopy.noResultsTitle,
                noResultsDescription: areaCopy.noResultsDescription,
              }}
            />
          ) : <ServiceList sections={sections} pageData={pageData} language={language} domainContext={domainContext} preferSubdomainRoot={preferSubdomainRoot} openLabel={areaCopy.open} /> : <EmptyState title={areaCopy.emptyTitle} description={areaCopy.emptyDescription} /> : null}
        </section>
        {isMercure ? (
          <footer className="mercure-internal-footer px-6 pt-2 pb-1 text-center text-[10px] font-medium tracking-[.18em] text-[#685d64] md:pt-4 md:pb-0 md:text-xs">
            Powered by <span className="tracking-normal text-[#52204f]">LibGuest</span>
          </footer>
        ) : null}
      </div>
      {isNovotel ? <NovotelMobileNavigation items={navigationItems} activeItem={activeItem} ariaLabel={copy.navigationLabel} /> : null}
      {isGrandMercure ? <GrandMercureMobileNavigation items={navigationItems} activeItem={activeItem} ariaLabel={copy.navigationLabel} /> : null}
      {isMercure ? <MercureBottomDock items={navigationItems} activeItem={activeItem} ariaLabel={copy.navigationLabel} /> : null}
    </main>
  );
}
