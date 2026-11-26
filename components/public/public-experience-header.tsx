import Image from 'next/image';
import type { CSSProperties } from 'react';
import { LanguageSwitcher } from './language-switcher';
import { PublicCommunicationAccess } from './public-communication-access';
import { PublicExperienceMenu } from './public-experience-menu';
import type { PublicHotel, PublicHotelPageData } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';

/** Shared Home identity and navigation; each page supplies its enabled destinations. */
export function PublicExperienceHeader({ hotel, language, basePath, homeHref, links, reserve, reserveLabel, menuLabel, navigationLabel, style, activeHref, communicationData, announcementsHref }: {
  hotel: PublicHotel; language: SupportedPublicLanguage; basePath?: string; homeHref: string;
  links: { href: string; label: string }[]; reserve: string | null; reserveLabel: string;
  menuLabel: string; navigationLabel: string; style?: CSSProperties; activeHref?: string;
  communicationData?: PublicHotelPageData; announcementsHref?: string;
}) {
  return <header className="v3-header">
    <PublicExperienceMenu title={hotel.name} label={menuLabel} links={reserve ? [...links, { href: reserve, label: reserveLabel }] : links} style={style} />
    <a href={homeHref} className="v3-brand" aria-label={hotel.name}>{hotel.logo_url ? <><Image src={hotel.logo_url} alt={hotel.name} width={220} height={66} unoptimized /><small>{hotel.city}</small></> : <><span>{hotel.name}</span>{hotel.city ? <small>{hotel.city}</small> : null}</>}</a>
    <nav className="v3-desktop-nav" aria-label={navigationLabel}>{links.map(link => <a key={link.href} href={link.href} aria-current={activeHref === link.href ? 'page' : undefined}>{link.label}</a>)}</nav>
    {communicationData && announcementsHref ? <PublicCommunicationAccess data={communicationData} language={language} href={announcementsHref} basePath={basePath} /> : <LanguageSwitcher compact slug={hotel.slug} currentLanguage={language} basePath={basePath} />}
    {reserve ? <a className="v3-reserve" href={reserve} target="_blank" rel="noopener noreferrer">{reserveLabel}</a> : null}
  </header>;
}
