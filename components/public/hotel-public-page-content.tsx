import type { ElementType } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Globe,
  Hotel,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { PublicAnalytics } from '@/components/public/public-analytics';
import { ServiceIcon } from '@/components/service-icon';
import type { DomainContext } from '@/lib/domain-context';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getPublicCopy } from '@/lib/public-copy';
import type {
  PublicHotel,
  PublicHotelDepartment,
  PublicHotelPolicy,
  PublicHotelSection,
} from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { shouldPreferHotelSubdomainRoot } from '@/lib/public-routes';
import { getServiceDestination } from '@/lib/service-destinations';

function SectionIcon({
  iconName,
  className,
}: {
  iconName?: string | null;
  className?: string;
}) {
  return <ServiceIcon iconName={iconName} className={className} />;
}

function QuickInfoCard({
  icon: Icon,
  title,
  value,
  helper,
}: {
  icon: ElementType;
  title: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-base font-semibold tracking-tight text-slate-950">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>

        <div className="rounded-[20px] border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] p-3 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  item,
  hotelSlug,
  language,
  copy,
  domainContext,
  preferSubdomainRoot,
}: {
  item: PublicHotelSection;
  hotelSlug: string;
  language: SupportedPublicLanguage;
  copy: ReturnType<typeof getPublicCopy>;
  domainContext: DomainContext;
  preferSubdomainRoot: boolean;
}) {
  const destination = getServiceDestination(item, hotelSlug, language, domainContext, {
    preferSubdomainRoot,
  });

  return (
    <div className="min-w-0 overflow-hidden rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-[0_26px_55px_-36px_rgba(15,23,42,0.32)]">
      <div className="flex min-w-0 items-start gap-4">
        <div className="shrink-0 rounded-[20px] border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] p-3 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <SectionIcon iconName={item.icon} className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words [overflow-wrap:anywhere] text-lg font-semibold tracking-tight text-slate-950">
              {item.title}
            </h3>

            {item.category ? (
              <span className="max-w-full break-words rounded-full border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] px-3 py-1 text-xs font-medium text-slate-700 [overflow-wrap:anywhere]">
                {item.category}
              </span>
            ) : null}
          </div>

          <p className="mt-3 min-w-0 line-clamp-2 break-words [overflow-wrap:anywhere] text-sm leading-6 text-slate-600 md:line-clamp-4 md:leading-7">
            {item.content || copy.serviceInfoUnavailable}
          </p>

          {destination ? (
            <div className="mt-4 min-w-0 overflow-hidden">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                {destination.isExternal ? copy.destinationExternal : copy.destinationInternal}
              </p>

              {destination.isExternal ? (
                <a
                  href={destination.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center justify-center rounded-2xl bg-[var(--hotel-accent)] px-4 py-3 text-center text-sm font-medium leading-5 text-[color:var(--hotel-accent-foreground)] shadow-[0_14px_30px_-18px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:brightness-95"
                >
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {item.cta || copy.openSite}
                  </span>
                  <ArrowUpRight className="ml-2 h-4 w-4 shrink-0" />
                </a>
              ) : (
                <a
                  href={destination.href}
                  className="inline-flex max-w-full items-center justify-center rounded-2xl bg-[var(--hotel-accent)] px-4 py-3 text-center text-sm font-medium leading-5 text-[color:var(--hotel-accent-foreground)] shadow-[0_14px_30px_-18px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:brightness-95"
                >
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    {item.cta || copy.viewService}
                  </span>
                  <ChevronRight className="ml-2 h-4 w-4 shrink-0" />
                </a>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DepartmentCard({
  item,
  copy,
}: {
  item: PublicHotelDepartment;
  copy: ReturnType<typeof getPublicCopy>;
}) {
  return (
    <div className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-[0_26px_55px_-36px_rgba(15,23,42,0.32)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold tracking-tight text-slate-950">
            {item.name}
          </h3>
          <p className="mt-2 break-words text-sm leading-7 text-slate-600">
            {item.description || copy.departmentDefaultDescription}
          </p>

          {item.hours ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <Clock3 className="h-3.5 w-3.5" />
              {item.hours}
            </div>
          ) : null}
        </div>

        <div className="rounded-[20px] border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] p-3 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <Phone className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            data-analytics-event="department_click"
            data-analytics-department-id={item.id}
            data-analytics-target-url={item.url}
            data-analytics-label={item.name}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] px-4 text-center text-sm font-medium text-slate-800 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:bg-[var(--hotel-accent-soft-strong)]"
          >
            {item.action || copy.talkToDepartment(item.name)}
            <ChevronRight className="ml-2 h-4 w-4" />
          </a>
        ) : (
          <div className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-500">
            {item.action || copy.contactDepartment(item.name)}
          </div>
        )}
      </div>
    </div>
  );
}

function PolicyCard({
  item,
  copy,
}: {
  item: PublicHotelPolicy;
  copy: ReturnType<typeof getPublicCopy>;
}) {
  return (
    <div className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/80">
      <div className="flex items-start gap-3">
        <div className="rounded-[18px] border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] p-2.5 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <ShieldCheck className="h-4 w-4" />
        </div>

        <div>
          <h3 className="break-words text-base font-semibold tracking-tight text-slate-950">
            {item.title}
          </h3>
          <p className="mt-2 break-words text-sm leading-7 text-slate-600">
            {item.description || copy.policyDefaultDescription}
          </p>
        </div>
      </div>
    </div>
  );
}

export function HotelPublicPageContent({
  hotel,
  sections,
  departments,
  policies,
  language,
  domainContext,
  hasFallbackContent,
  preferSubdomainRoot,
}: {
  hotel: PublicHotel;
  sections: PublicHotelSection[];
  departments: PublicHotelDepartment[];
  policies: PublicHotelPolicy[];
  language: SupportedPublicLanguage;
  domainContext: DomainContext;
  hasFallbackContent: boolean;
  preferSubdomainRoot?: boolean;
}) {
  const copy = getPublicCopy(language);
  const whatsappHref = hotel.whatsapp_number
    ? `https://wa.me/${String(hotel.whatsapp_number).replace(/\D/g, '')}`
    : null;
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const useSubdomainRoot =
    preferSubdomainRoot ??
    shouldPreferHotelSubdomainRoot({
      domainContext,
      hotelSlug: hotel.slug,
      hotelSubdomain: hotel.subdomain,
    });

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#f8fafc_100%)]">
      <PublicAnalytics hotelId={hotel.id} hotelSlug={hotel.slug} language={language} />

      <div
        className="mx-auto max-w-6xl px-4 py-6 pb-28 md:px-6 md:py-8 md:pb-8"
        style={theme.cssVars}
      >
        <section
          className={`relative overflow-hidden rounded-[40px] p-6 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.85)] ring-1 ring-slate-900/10 md:p-10 ${theme.heroClassName}`}
        >
          <div className={`pointer-events-none absolute inset-0 ${theme.heroOverlayClassName}`} />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-start justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-badge-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  LibGuest
                </div>

                <div className="shrink-0">
                  <LanguageSwitcher
                    slug={hotel.slug}
                    currentLanguage={language}
                    basePath={useSubdomainRoot ? '/' : undefined}
                  />
                </div>
              </div>

              <div className="mt-7 flex items-start gap-4">
                {hotel.logo_url ? (
                  <img
                    src={hotel.logo_url}
                    alt={hotel.name}
                    className="h-16 w-16 rounded-[22px] border border-white/15 bg-white object-cover p-1 shadow-[0_16px_32px_-22px_rgba(15,23,42,0.55)]"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <Hotel className="h-6 w-6 text-[color:var(--hotel-badge-text)]" />
                  </div>
                )}

                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    {hotel.name}
                  </h1>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[color:var(--hotel-hero-muted)]">
                    {hotel.city ? (
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {hotel.city}
                      </span>
                    ) : null}

                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {copy.essentialsSinglePlace}
                    </span>
                  </div>

                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[color:var(--hotel-hero-muted)]/85">
                    {hotel.logo_url
                      ? 'Identidade visual do hotel aplicada na experiência pública.'
                      : 'Apresentação visual padrão ativa até que a logo do hotel seja configurada.'}
                  </p>
                </div>
              </div>

              <p className="mt-7 max-w-2xl text-sm leading-7 text-[color:var(--hotel-hero-muted)] md:text-base">
                {copy.heroDescription}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              {hotel.booking_url ? (
                <a
                  href={hotel.booking_url}
                  target="_blank"
                  rel="noreferrer"
                  data-analytics-event="booking_click"
                  data-analytics-target-url={hotel.booking_url}
                  data-analytics-label="Hero booking button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--hotel-accent)] px-5 text-sm font-semibold text-[color:var(--hotel-accent-foreground)] shadow-[0_18px_35px_-18px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {copy.bookNow}
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              ) : (
                <div className="inline-flex h-12 items-center justify-center rounded-2xl border border-[color:var(--hotel-hero-secondary-border)] bg-[var(--hotel-hero-disabled-bg)] px-5 text-sm font-medium text-[color:var(--hotel-hero-disabled-text)]">
                  {copy.bookingUnavailable}
                </div>
              )}

              {hotel.website_url ? (
                <a
                  href={hotel.website_url}
                  target="_blank"
                  rel="noreferrer"
                  data-analytics-event="website_click"
                  data-analytics-target-url={hotel.website_url}
                  data-analytics-label="Hero website button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[color:var(--hotel-hero-secondary-border)] bg-[var(--hotel-hero-secondary-bg)] px-5 text-sm font-medium text-[color:var(--hotel-hero-secondary-text)] transition hover:-translate-y-0.5 hover:bg-[var(--hotel-hero-secondary-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {copy.officialWebsite}
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              ) : (
                <div className="inline-flex h-12 items-center justify-center rounded-2xl border border-[color:var(--hotel-hero-secondary-border)] bg-[var(--hotel-hero-disabled-bg)] px-5 text-sm font-medium text-[color:var(--hotel-hero-disabled-text)]">
                  {copy.websiteUnavailable}
                </div>
              )}

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  data-analytics-event="whatsapp_click"
                  data-analytics-target-url={whatsappHref}
                  data-analytics-label="Hero WhatsApp button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[color:var(--hotel-hero-secondary-border)] bg-[var(--hotel-hero-secondary-bg)] px-5 text-sm font-medium text-[color:var(--hotel-hero-secondary-text)] transition hover:-translate-y-0.5 hover:bg-[var(--hotel-hero-secondary-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:col-span-2"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {copy.whatsappSupport}
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {hasFallbackContent ? (
          <section className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 shadow-[0_16px_35px_-30px_rgba(120,53,15,0.35)]">
            {copy.fallbackNotice}
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QuickInfoCard
            icon={Coffee}
            title={copy.breakfast}
            value={hotel.breakfast_hours || copy.notInformed}
            helper={copy.serviceHours}
          />
          <QuickInfoCard
            icon={Wifi}
            title={copy.wifi}
            value={hotel.wifi_name || copy.notInformed}
            helper={hotel.wifi_password ? copy.passwordLabel(hotel.wifi_password) : copy.askFrontDesk}
          />
          <QuickInfoCard
            icon={Clock3}
            title={copy.checkIn}
            value={hotel.checkin_time || copy.notInformed}
            helper={copy.standardEntry}
          />
          <QuickInfoCard
            icon={Clock3}
            title={copy.checkOut}
            value={hotel.checkout_time || copy.notInformed}
            helper={copy.standardExit}
          />
        </section>

        <section className="mt-8" id="servicos">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-section-label)]">
                {copy.explore}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {copy.servicesAndInfo}
              </h2>
            </div>

            <div className="hidden rounded-full bg-[var(--hotel-accent-soft)] px-4 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.22)] ring-1 ring-[color:var(--hotel-accent-border)] md:inline-flex">
              {copy.itemsAvailable(sections.length)}
            </div>
          </div>

          {sections.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {sections.map((item) => (
                <SectionCard
                  key={item.id}
                  item={item}
                  hotelSlug={hotel.slug}
                  language={language}
                  copy={copy}
                  domainContext={domainContext}
                  preferSubdomainRoot={useSubdomainRoot}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[30px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-[0_18px_45px_-36px_rgba(15,23,42,0.22)]">
              <p className="text-base font-semibold text-slate-900">{copy.noServicesTitle}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy.noServicesDescription}</p>
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-[1fr,1fr]">
          <div>
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-section-label)]">
                {copy.support}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {copy.talkToHotel}
              </h2>
            </div>

            {departments.length ? (
              <div className="space-y-4">
                {departments.map((item) => (
                  <DepartmentCard key={item.id} item={item} copy={copy} />
                ))}
              </div>
            ) : (
              <div className="rounded-[30px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-[0_18px_45px_-36px_rgba(15,23,42,0.22)]">
                <p className="text-base font-semibold text-slate-900">{copy.noChannelsTitle}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy.noChannelsDescription}</p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-section-label)]">
                {copy.importantInfo}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {copy.hotelPolicies}
              </h2>
            </div>

            {policies.length ? (
              <div className="space-y-4">
                {policies.map((item) => (
                  <PolicyCard key={item.id} item={item} copy={copy} />
                ))}
              </div>
            ) : (
              <div className="rounded-[30px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-[0_18px_45px_-36px_rgba(15,23,42,0.22)]">
                <p className="text-base font-semibold text-slate-900">{copy.noPoliciesTitle}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{copy.noPoliciesDescription}</p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 rounded-[34px] border border-[color:var(--hotel-footer-border)] bg-[var(--hotel-footer-bg)] p-6 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.28)] md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-section-label)]">
                {copy.usefulLinks}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {copy.quickAccess}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {copy.usefulLinksDescription}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {hotel.website_url ? (
                <a
                  href={hotel.website_url}
                  target="_blank"
                  rel="noreferrer"
                  data-analytics-event="website_click"
                  data-analytics-target-url={hotel.website_url}
                  data-analytics-label="Footer website button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  <Globe className="mr-2 h-4 w-4" />
                  {copy.officialWebsite}
                </a>
              ) : null}

              {hotel.booking_url ? (
                <a
                  href={hotel.booking_url}
                  target="_blank"
                  rel="noreferrer"
                  data-analytics-event="booking_click"
                  data-analytics-target-url={hotel.booking_url}
                  data-analytics-label="Footer booking button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  {copy.reservations}
                </a>
              ) : null}

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  data-analytics-event="whatsapp_click"
                  data-analytics-target-url={whatsappHref}
                  data-analytics-label="Footer WhatsApp button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--hotel-accent)] px-5 text-sm font-medium text-[color:var(--hotel-accent-foreground)] shadow-[0_12px_28px_-20px_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-[30px] border border-[color:var(--hotel-footer-border)] bg-[var(--hotel-footer-bg)] px-6 py-5 text-sm shadow-[0_18px_45px_-36px_rgba(15,23,42,0.22)] backdrop-blur md:mt-8">
          <div className="flex justify-center md:justify-end">
            <p className="font-medium tracking-[0.01em] text-[color:var(--hotel-footer-text)]">
              LibGuest
            </p>
          </div>
        </section>
      </div>

      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          data-analytics-event="whatsapp_click"
          data-analytics-target-url={whatsappHref}
          data-analytics-label="Floating WhatsApp button"
          className="fixed bottom-5 right-5 z-50 inline-flex h-14 items-center justify-center rounded-full bg-[var(--hotel-accent)] px-5 text-sm font-medium text-[color:var(--hotel-accent-foreground)] shadow-[0_18px_40px_-22px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          WhatsApp
        </a>
      ) : null}
    </main>
  );
}
