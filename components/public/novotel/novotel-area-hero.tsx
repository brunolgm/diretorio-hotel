import type { ElementType } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { NovotelHeroBackdrop } from '@/components/public/novotel/novotel-hero-backdrop';
import type { PublicHotel } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';

export function NovotelAreaHero({
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
  return (
    <header className="relative min-h-[270px] overflow-hidden rounded-[30px] bg-[var(--hotel-hero-background)] p-5 text-white shadow-[0_28px_68px_-40px_rgba(0,43,92,0.72)] sm:p-6 md:min-h-[350px] md:p-10">
      <NovotelHeroBackdrop imageUrl={hotel.hero_image_url} imageAlt={hotel.name} />

      <div className="relative flex min-h-[240px] flex-col md:min-h-[280px]">
        <div className="flex items-start justify-between gap-3">
          <a
            href={homeHref}
            className="inline-flex min-h-11 items-center rounded-full border border-white/25 bg-[#003B7A]/55 px-3.5 text-sm font-medium text-white backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:px-4"
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

        <div className="mt-auto max-w-2xl pt-10 drop-shadow-[0_2px_12px_rgba(0,25,65,0.48)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-[17px] border border-white/20 bg-white/12 backdrop-blur-sm md:h-14 md:w-14">
            <AreaIcon className="h-7 w-7 md:h-8 md:w-8" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-blue-50 md:mt-3 md:text-base md:leading-7">
            {description}
          </p>
        </div>
      </div>
    </header>
  );
}
