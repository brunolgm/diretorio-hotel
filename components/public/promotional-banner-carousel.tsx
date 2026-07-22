'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, ImageIcon } from 'lucide-react';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import type { PublicHotelPromotionalBanner } from '@/lib/public-hotel-data';

function getBannerCopy(language: SupportedPublicLanguage) {
  if (language === 'en') {
    return {
      eyebrow: 'Highlights',
      title: 'Promotions and featured experiences',
      open: 'Learn more',
      previous: 'Previous banner',
      next: 'Next banner',
      slide: (index: number) => `Go to banner ${index + 1}`,
      fallback: 'Featured hotel promotion',
      activeDuringPeriod: 'Visible while active',
      activeUntil: (value: string) => `Active until ${value}`,
      emptyTitle: 'Hotel highlights',
      emptyDescription: 'New experiences will be shared here soon.',
    };
  }

  if (language === 'es') {
    return {
      eyebrow: 'Destacados',
      title: 'Promociones y experiencias destacadas',
      open: 'Ver más',
      previous: 'Banner anterior',
      next: 'Siguiente banner',
      slide: (index: number) => `Ir al banner ${index + 1}`,
      fallback: 'Promoción destacada del hotel',
      activeDuringPeriod: 'Visible durante el período activo',
      activeUntil: (value: string) => `Activo hasta ${value}`,
      emptyTitle: 'Destacados del hotel',
      emptyDescription: 'Pronto se publicarán nuevas experiencias aquí.',
    };
  }

  return {
    eyebrow: 'Destaques',
    title: 'Promoções e experiências em destaque',
    open: 'Saiba mais',
    previous: 'Banner anterior',
    next: 'Próximo banner',
    slide: (index: number) => `Ir para o banner ${index + 1}`,
    fallback: 'Promoção em destaque do hotel',
    activeDuringPeriod: 'Visível durante o período ativo',
    activeUntil: (value: string) => `Ativo até ${value}`,
    emptyTitle: 'Destaques do hotel',
    emptyDescription: 'Novas experiências serão publicadas aqui em breve.',
  };
}

function getPeriodLabel(
  banner: PublicHotelPromotionalBanner,
  language: SupportedPublicLanguage,
  copy: ReturnType<typeof getBannerCopy>
) {
  if (!banner.ends_at) {
    return copy.activeDuringPeriod;
  }

  const formattedDate = new Intl.DateTimeFormat(
    language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US',
    {
      day: '2-digit',
      month: 'short',
    }
  ).format(new Date(banner.ends_at));

  return copy.activeUntil(formattedDate);
}

function BannerImage({
  banner,
}: {
  banner: PublicHotelPromotionalBanner;
}) {
  if (!banner.image_url) {
    return null;
  }

  return (
    <div className="hotel-theme-banner-media relative aspect-[8/3] overflow-hidden bg-[linear-gradient(135deg,#e2e8f0_0%,#f8fafc_48%,#e2e8f0_100%)]">
      <div
        role="img"
        aria-label={banner.title}
        className="hotel-theme-banner-image absolute inset-0 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${banner.image_url}")` }}
      />
    </div>
  );
}

function BannerSlide({
  banner,
  language,
}: {
  banner: PublicHotelPromotionalBanner;
  language: SupportedPublicLanguage;
}) {
  const copy = getBannerCopy(language);
  const ctaLabel = banner.cta_label || copy.open;
  const periodLabel = getPeriodLabel(banner, language, copy);

  if (banner.image_url) {
    return (
      <article className="hotel-theme-banner hotel-theme-banner-slide relative overflow-hidden border border-[color:var(--hotel-border)] shadow-[0_28px_65px_-42px_rgba(15,23,42,0.28)]">
        <BannerImage banner={banner} />

        <div className="hotel-theme-banner-content border-t border-[color:var(--hotel-border)] bg-[image:var(--hotel-surface-muted)] px-5 py-4 md:px-7 md:py-5">
          <div className="max-w-4xl">
            <p className="hotel-theme-banner-eyebrow text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              {copy.eyebrow}
            </p>
            <h3 className="hotel-theme-banner-title hotel-theme-heading mt-2 text-xl font-semibold tracking-[-0.02em] md:text-[1.8rem]">
              {banner.title}
            </h3>
            <p className="hotel-theme-banner-description hotel-theme-muted mt-2.5 max-w-3xl text-sm leading-6 md:text-[15px] md:leading-6">
              {banner.subtitle || copy.fallback}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="hotel-theme-banner-period text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {periodLabel}
            </p>

            {banner.cta_url ? (
              <a
                href={banner.cta_url}
                target="_blank"
                rel="noreferrer"
                className="hotel-theme-banner-cta hotel-theme-button inline-flex h-11 items-center justify-center bg-[var(--hotel-text)] px-4 text-sm font-medium text-[color:var(--hotel-surface)] shadow-[0_16px_32px_-24px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
              >
                {ctaLabel}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="hotel-theme-banner hotel-theme-banner-fallback overflow-hidden border border-[color:var(--hotel-border)] shadow-[0_28px_65px_-42px_rgba(15,23,42,0.58)]">
      <div className="relative min-h-[240px] overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#162033_42%,#24334d_100%)] px-5 py-6 text-white md:px-8 md:py-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_34%)]"
        />

        <div className="relative flex h-full flex-col justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-200/92">
              {copy.eyebrow}
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-white md:text-[2rem]">
              {banner.title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-100/92 md:text-[15px]">
              {banner.subtitle || copy.fallback}
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="hotel-theme-banner-missing-image inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-slate-200 backdrop-blur">
                <ImageIcon className="h-3.5 w-3.5" />
                Imagem opcional não configurada
              </span>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300">
                {periodLabel}
              </p>
            </div>

            {banner.cta_url ? (
              <a
                href={banner.cta_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-white px-4 text-sm font-medium text-slate-950 shadow-[0_12px_28px_-18px_rgba(255,255,255,0.42)] transition hover:-translate-y-0.5 hover:bg-slate-100"
              >
                {ctaLabel}
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function PromotionalBannerCarousel({
  banners,
  language,
  showEmptyFallback = false,
}: {
  banners: PublicHotelPromotionalBanner[];
  language: SupportedPublicLanguage;
  showEmptyFallback?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const copy = getBannerCopy(language);

  if (!banners.length) {
    if (!showEmptyFallback) return null;

    return (
      <article className="hotel-theme-banner hotel-theme-banner-fallback overflow-hidden border border-[color:var(--hotel-border)] shadow-[0_28px_65px_-42px_rgba(15,23,42,0.4)]">
        <div className="relative min-h-[240px] overflow-hidden bg-[linear-gradient(145deg,#003B7A_0%,#005DA8_58%,#0877BE_100%)] px-6 py-7 text-white md:min-h-[320px] md:px-9 md:py-10">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_36%)]" />
          <div className="relative flex min-h-[190px] max-w-xl flex-col justify-end md:min-h-[240px]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
              {copy.eyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">
              {copy.emptyTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-blue-50 md:text-base">
              {copy.emptyDescription}
            </p>
          </div>
        </div>
      </article>
    );
  }

  if (banners.length === 1) {
    return (
      <div>
        <BannerSlide banner={banners[0]} language={language} />
        <div className="mt-3 flex justify-center" aria-hidden="true">
          <span className="h-2 w-7 rounded-full bg-[var(--hotel-navigation)]" />
        </div>
      </div>
    );
  }

  const previous = () => {
    setActiveIndex((current) => (current === 0 ? banners.length - 1 : current - 1));
  };

  const next = () => {
    setActiveIndex((current) => (current === banners.length - 1 ? 0 : current + 1));
  };

  return (
    <div className="hotel-theme-banner overflow-hidden border border-[color:var(--hotel-border)] shadow-[0_28px_65px_-42px_rgba(15,23,42,0.22)]">
      <BannerSlide banner={banners[activeIndex]} language={language} />

      <div className="flex items-center justify-between gap-4 border-t border-[color:var(--hotel-border)] bg-[image:var(--hotel-surface-muted)] px-5 py-3 md:px-6">
        <div className="flex items-center gap-2">
          {banners.map((banner, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={banner.id}
                type="button"
                aria-label={copy.slide(index)}
                aria-pressed={isActive}
                onClick={() => setActiveIndex(index)}
                className={
                  isActive
                    ? 'h-2 w-7 rounded-full bg-[var(--hotel-navigation)]'
                    : 'h-2 w-2 rounded-full bg-slate-300 transition hover:bg-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] focus-visible:ring-offset-2'
                }
              />
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={copy.previous}
            onClick={previous}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] focus-visible:ring-offset-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={copy.next}
            onClick={next}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)] focus-visible:ring-offset-2"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
