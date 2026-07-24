'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { getPublicCopy } from '@/lib/public-copy';
import type { PublicHotelPromotionalBanner } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';

const FALLBACK_IMAGE = '/brand/mercure/mercure-banner-fallback.webp';

export function MercurePromotionalBanner({
  banners,
  language,
}: {
  banners: PublicHotelPromotionalBanner[];
  language: SupportedPublicLanguage;
}) {
  const copy = getPublicCopy(language);
  const [activeIndex, setActiveIndex] = useState(0);
  const banner = banners[activeIndex] || null;
  const imageUrl = banner?.image_url || FALLBACK_IMAGE;
  const title = banner?.title || copy.mercureBannerTitle;
  const description = banner?.subtitle || null;
  const ctaLabel = banner?.cta_label || copy.mercureBannerCta;
  const hasMultiple = banners.length > 1;

  const previous = () =>
    setActiveIndex((current) => (current === 0 ? banners.length - 1 : current - 1));
  const next = () =>
    setActiveIndex((current) => (current === banners.length - 1 ? 0 : current + 1));

  return (
    <section
      aria-label={copy.mercureBannerEyebrow}
      className="mercure-promotional-banner relative min-h-[180px] overflow-hidden rounded-[20px] bg-[#52204f] text-white shadow-[0_22px_48px_-30px_rgba(61,23,60,.58)] md:min-h-[280px] md:rounded-[28px]"
    >
      <Image
        src={imageUrl}
        alt={banner?.title || ''}
        fill
        unoptimized={Boolean(banner?.image_url)}
        className="mercure-banner-image object-cover object-[68%_center]"
        sizes="(min-width: 768px) 1120px, 100vw"
      />
      <div className="mercure-banner-overlay absolute inset-0" aria-hidden="true" />
      <div className="mercure-banner-botanical absolute inset-y-0 left-[36%] w-[32%] opacity-60" aria-hidden="true" />

      <div className="relative z-10 flex min-h-[180px] max-w-[62%] flex-col items-start justify-center px-6 py-5 md:min-h-[280px] md:max-w-[52%] md:px-12 md:py-9">
        <p className="text-[10px] leading-4 font-medium tracking-[.08em] text-white/88 md:text-sm">
          {copy.mercureBannerEyebrow}
        </p>
        <h2 className="mt-2 whitespace-pre-line text-[clamp(1.35rem,6vw,2rem)] leading-[1.08] font-light tracking-[.01em] md:mt-3 md:text-5xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 line-clamp-2 max-w-md text-xs leading-5 text-white/82 md:mt-3 md:text-base md:leading-6">
            {description}
          </p>
        ) : null}

        {banner?.cta_url ? (
          <a
            href={banner.cta_url}
            target="_blank"
            rel="noreferrer"
            data-analytics-event="banner_click"
            data-analytics-target-url={banner.cta_url}
            data-analytics-label={banner.title}
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-sm border border-white/80 px-5 text-[11px] font-medium tracking-[.04em] transition hover:bg-white hover:text-[#52204f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#52204f] md:mt-6 md:min-h-12 md:px-7 md:text-sm"
          >
            {ctaLabel}
          </a>
        ) : (
          <span className="mt-4 inline-flex min-h-10 items-center justify-center rounded-sm border border-white/80 px-5 text-[11px] font-medium tracking-[.04em] md:mt-6 md:min-h-12 md:px-7 md:text-sm">
            {ctaLabel}
          </span>
        )}
      </div>

      {hasMultiple ? (
        <div className="absolute right-3 bottom-3 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={previous}
            aria-label={copy.mercureBannerPrevious}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-[#3d173c]/55 text-white backdrop-blur transition hover:bg-[#3d173c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label={copy.mercureBannerNext}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-[#3d173c]/55 text-white backdrop-blur transition hover:bg-[#3d173c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
