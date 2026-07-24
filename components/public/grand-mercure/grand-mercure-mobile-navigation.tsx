'use client';

import { Grid2X2, House, Info, MessageCircle, Utensils } from 'lucide-react';
import type { NovotelNavigationKey } from '@/components/public/novotel/novotel-mobile-navigation';

const ICONS = { home: House, services: Grid2X2, menu: Utensils, information: Info, contact: MessageCircle };

export function GrandMercureMobileNavigation({ items, activeItem, ariaLabel }: {
  items: Array<{ key: NovotelNavigationKey; href: string; label: string }>;
  activeItem: NovotelNavigationKey;
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="grand-mercure-mobile-dock fixed inset-x-0 bottom-0 z-30 box-content h-[94px] bg-[#292826] pb-[env(safe-area-inset-bottom)] text-[#eee3d1] shadow-[0_-16px_38px_-26px_rgba(34,30,24,.65)] min-[1025px]:hidden">
      <div className="mx-auto grid h-[68px] max-w-[430px] grid-cols-5 px-1 pt-1.5">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          const active = item.key === activeItem;
          return <a key={item.key} href={item.href} aria-current={active ? 'page' : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[8px] transition min-[360px]:text-[9px] ${active ? 'text-[#d1a34d]' : 'text-[#ddd2c0] hover:bg-white/5'}`}>
            <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.55} aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </a>;
        })}
      </div>
      <p className="h-[26px] pt-1 text-center text-[8px] uppercase tracking-[0.25em] text-[#9d9589]">Powered by <span className="normal-case tracking-normal text-[#d7d0c6]">LibGuest</span></p>
    </nav>
  );
}
