import { Bell } from 'lucide-react';
import { LanguageSwitcher } from './language-switcher';
import { eligibleAnnouncementRows } from '@/lib/public-communications';
import type { PublicHotelPageData } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';

/** Shared V4 header action. Count means currently active communications, not unread items. */
export function PublicCommunicationAccess({ data, language, href, basePath, compact = true }: {
  data: PublicHotelPageData; language: SupportedPublicLanguage; href: string;
  basePath?: string; compact?: boolean;
}) {
  const { hotel, layout, announcements } = data;
  const enabled = layout.some(block => block.blockKey === 'announcements' && block.isEnabled);
  const count = eligibleAnnouncementRows(hotel.id, announcements, enabled).length;
  const label = language === 'en' ? 'Hotel announcements' : language === 'es' ? 'Comunicados del hotel' : 'Comunicados do hotel';
  const active = language === 'en' ? 'active' : language === 'es' ? 'vigentes' : 'vigentes';
  return <div className="public-communication-actions">
    {enabled ? <a href={href} className="public-communication-bell" aria-label={`${label}${count ? `, ${count} ${active}` : ''}`} title={label} data-communication-access data-active-count={count}>
      <Bell aria-hidden="true" />{count > 0 ? <span className="public-communication-count" aria-hidden="true">{count > 99 ? '99+' : count}</span> : null}
    </a> : null}
    <LanguageSwitcher compact={compact} slug={hotel.slug} currentLanguage={language} basePath={basePath} />
  </div>;
}
