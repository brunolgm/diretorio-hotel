import type { ElementType } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { GrandMercureBrandSignature } from './grand-mercure-brand-signature';
import { getGrandMercurePropertyLabel } from '@/lib/grand-mercure-property';
import type { PublicHotel } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';

export function GrandMercureAreaHero({ hotel, language, languageBasePath, homeHref, backLabel, title, description, icon: Icon }: {
  hotel: PublicHotel; language: SupportedPublicLanguage; languageBasePath: string; homeHref: string;
  backLabel: string; title: string; description: string; icon: ElementType;
}) {
  const propertyLabel = getGrandMercurePropertyLabel(hotel.name);

  return <header className="relative -mx-4 overflow-hidden border-b border-[#d9c8ae] bg-[#fbf7ef]/60 px-5 pt-3 pb-6 md:mx-0 md:rounded-[28px] md:border md:px-9 md:py-6">
    {hotel.hero_image_url ? <div className="absolute inset-0 bg-cover bg-center opacity-[.035] grayscale" style={{ backgroundImage: `url(${JSON.stringify(hotel.hero_image_url)})` }} /> : null}
    <div className="relative">
      <div className="flex items-start justify-between gap-3">
        <a href={homeHref} className="inline-flex min-h-11 items-center rounded-full border border-[#d7c7b0] bg-[#fffdf9]/80 px-4 text-xs font-medium uppercase tracking-[.1em] text-[#4b4640]"><ArrowLeft className="mr-2 h-4 w-4" />{backLabel}</a>
        <LanguageSwitcher slug={hotel.slug} currentLanguage={language} basePath={languageBasePath} />
      </div>
      <div className="mt-2 flex justify-center md:mt-3"><GrandMercureBrandSignature logoUrl={hotel.logo_url} propertyLabel={propertyLabel} compact /></div>
      <div className="mx-auto mt-3 max-w-2xl text-center md:mt-5">
        <Icon className="mx-auto h-7 w-7 text-[#a97c32] md:h-8 md:w-8" strokeWidth={1.4} />
        <h1 className="mt-2 font-serif text-2xl font-normal text-[#3c3833] md:text-4xl">{title}</h1>
        <div className="mx-auto mt-3 h-px w-12 bg-[#c69a4d]" />
        <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-[#756b60] md:text-sm md:leading-6">{description}</p>
      </div>
    </div>
  </header>;
}
