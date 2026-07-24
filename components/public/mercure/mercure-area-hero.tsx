import type { ElementType } from 'react';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import type { PublicHotel } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { MercureBrandSignature } from './mercure-brand-signature';

const HERO_FALLBACK = '/brand/mercure/mercure-hero-fallback.webp';

export function MercureAreaHero({
  hotel,
  language,
  languageBasePath,
  homeHref,
  backLabel,
  title,
  description,
  icon: AreaIcon,
}: {
  hotel: PublicHotel;
  language: SupportedPublicLanguage;
  languageBasePath: string;
  homeHref: string;
  backLabel: string;
  title: string;
  description: string;
  icon: ElementType;
}) {
  const heroImage = hotel.hero_image_url || HERO_FALLBACK;

  return (
    <header className="mercure-internal-hero relative -mx-4 overflow-hidden border-b border-[#52204f]/8 bg-[#fbf7f8] px-5 pt-4 pb-7 shadow-[0_28px_72px_-50px_rgba(61,23,60,.42)] md:mx-0 md:min-h-[390px] md:rounded-[30px] md:border md:px-9 md:pt-6 md:pb-8">
      <div className="mercure-internal-hero-media pointer-events-none absolute inset-0" aria-hidden="true">
        <Image
          src={heroImage}
          alt=""
          fill
          unoptimized={Boolean(hotel.hero_image_url)}
          className="object-cover object-[68%_center] md:object-[64%_center]"
          sizes="(min-width: 1280px) 1240px, (min-width: 768px) calc(100vw - 48px), 100vw"
          priority
        />
      </div>
      <div className="mercure-internal-hero-overlay pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="mercure-internal-hero-floral pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative z-10 flex min-h-[300px] flex-col md:min-h-[324px]">
        <div className="flex items-start justify-between gap-3">
          <a
            href={homeHref}
            className="mercure-internal-back inline-flex min-h-11 items-center rounded-full border border-[#52204f]/20 bg-[#fffdfd]/88 px-3.5 text-sm font-medium text-[#52204f] shadow-[0_12px_28px_-20px_rgba(61,23,60,.48)] backdrop-blur-md transition hover:bg-[#fffdfd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71386e] focus-visible:ring-offset-2 sm:px-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            <span className="hidden min-[360px]:inline">{backLabel}</span>
            <span className="sr-only min-[360px]:hidden">{backLabel}</span>
          </a>
          <LanguageSwitcher
            slug={hotel.slug}
            currentLanguage={language}
            basePath={languageBasePath}
          />
        </div>

        <div className="mt-1 flex justify-center md:mt-0">
          <MercureBrandSignature logoUrl={hotel.logo_url} compact />
        </div>

        <div className="mt-auto max-w-[280px] pt-5 text-[#52204f] md:max-w-xl md:pt-7">
          <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-[#52204f]/12 bg-[#fffdfd]/82 shadow-[0_14px_30px_-22px_rgba(61,23,60,.4)] backdrop-blur-sm md:h-13 md:w-13">
            <AreaIcon className="h-6 w-6 md:h-7 md:w-7" strokeWidth={1.65} aria-hidden="true" />
          </div>
          <h1 className="mt-3 text-[1.7rem] leading-tight font-semibold tracking-[-.025em] md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[#685d64] md:text-base md:leading-7">
            {description}
          </p>
        </div>
      </div>
    </header>
  );
}
