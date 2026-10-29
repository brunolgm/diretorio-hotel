import Image from 'next/image';
import type { ElementType } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LanguageSwitcher } from './language-switcher';
import type { PublicHotel } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';

export function PublicAreaHero({ hotel, language, languageBasePath, homeHref, backLabel, title, description, icon: Icon }: {
  hotel: PublicHotel; language: SupportedPublicLanguage; languageBasePath: string;
  homeHref: string; backLabel: string; title: string; description: string; icon: ElementType;
}) {
  return <header className="public-area-hero rounded-[20px] border border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] p-5 text-[color:var(--hotel-text)] md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <a href={homeHref} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hotel-accent)]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{backLabel}</a>
      <LanguageSwitcher compact slug={hotel.slug} currentLanguage={language} basePath={languageBasePath} />
    </div>
    <div className="mt-6 flex items-center gap-3">{hotel.logo_url ? <Image src={hotel.logo_url} alt={hotel.name} width={128} height={64} unoptimized className="h-auto max-h-16 min-h-[23px] w-32 object-contain" /> : <p className="text-sm font-semibold">{hotel.name}</p>}</div>
    <Icon className="mt-6 h-7 w-7 text-[color:var(--hotel-accent)]" aria-hidden="true" />
    <h1 className="mt-3 break-words text-2xl font-semibold md:text-4xl">{title}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--hotel-text-muted)]">{description}</p>
  </header>;
}
