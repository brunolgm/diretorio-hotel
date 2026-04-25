import { ArrowLeft, CheckCircle2, Hotel, MapPin, Sparkles } from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { PublicAnalytics } from '@/components/public/public-analytics';
import { ServiceIcon } from '@/components/service-icon';
import type { DomainContext } from '@/lib/domain-context';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { getPublicCopy } from '@/lib/public-copy';
import type { PublicHotel, PublicHotelSection } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { buildPublicHotelHref, shouldPreferHotelSubdomainRoot } from '@/lib/public-routes';
import { MIN_SERVICE_DETAIL_CONTENT_LENGTH } from '@/lib/service-destinations';

function buildHotelBackHref(
  slug: string,
  language: SupportedPublicLanguage,
  domainContext: DomainContext,
  preferSubdomainRoot: boolean
) {
  return `${buildPublicHotelHref({
    slug,
    language,
    domainContext,
    preferSubdomainRoot,
  })}#servicos`;
}

export function HotelServiceDetailContent({
  hotel,
  section,
  language,
  domainContext,
  hasFallbackContent,
  preferSubdomainRoot,
}: {
  hotel: PublicHotel;
  section: PublicHotelSection;
  language: SupportedPublicLanguage;
  domainContext: DomainContext;
  hasFallbackContent: boolean;
  preferSubdomainRoot?: boolean;
}) {
  const copy = getPublicCopy(language);
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const useSubdomainRoot =
    preferSubdomainRoot ??
    shouldPreferHotelSubdomainRoot({
      domainContext,
      hotelSlug: hotel.slug,
      hotelSubdomain: hotel.subdomain,
    });
  const backHref = buildHotelBackHref(hotel.slug, language, domainContext, useSubdomainRoot);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#f8fafc_100%)]">
      <PublicAnalytics hotelId={hotel.id} hotelSlug={hotel.slug} language={language} />

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8" style={theme.cssVars}>
        <section
          className={`relative overflow-hidden rounded-[40px] p-6 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.85)] ring-1 ring-slate-900/10 md:p-10 ${theme.heroClassName}`}
        >
          <div className={`pointer-events-none absolute inset-0 ${theme.heroOverlayClassName}`} />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <a
                href={backHref}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-badge-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur transition hover:bg-white/15"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {copy.backToServices}
              </a>

              <LanguageSwitcher
                slug={hotel.slug}
                currentLanguage={language}
                basePath={
                  useSubdomainRoot
                    ? `/servicos/${section.id}`
                    : `/hotel/${hotel.slug}/servicos/${section.id}`
                }
              />
            </div>

            <div className="mt-7 flex items-start gap-4">
              <div className="rounded-[22px] border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <ServiceIcon
                  iconName={section.icon}
                  className="h-6 w-6 text-[color:var(--hotel-badge-text)]"
                />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-badge-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  LibGuest
                </div>

                <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
                  {section.title}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[color:var(--hotel-hero-muted)]">
                  {section.category ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-3 py-1 text-xs font-medium tracking-[0.14em] text-[color:var(--hotel-badge-text)]">
                      {section.category}
                    </span>
                  ) : null}

                  <span className="inline-flex items-center gap-2">
                    <Hotel className="h-4 w-4" />
                    {hotel.name}
                  </span>

                  {hotel.city ? (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {hotel.city}
                    </span>
                  ) : null}

                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {copy.internalDetailedContent}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {hasFallbackContent ? (
          <section className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 shadow-[0_16px_35px_-30px_rgba(120,53,15,0.35)]">
            {copy.fallbackNotice}
          </section>
        ) : null}

        <section className="mt-8 rounded-[34px] bg-white p-6 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 md:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              {copy.serviceDetails}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {copy.fullInformation}
            </h2>
            <p className="mt-4 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-8 text-slate-600 md:text-base">
              {section.content}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={backHref}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {copy.back}
            </a>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-white/80 px-6 py-5 text-sm leading-6 text-slate-500 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.18)]">
          {copy.internalPageRule(MIN_SERVICE_DETAIL_CONTENT_LENGTH)}
        </section>
      </div>
    </main>
  );
}
