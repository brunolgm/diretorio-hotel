'use client';

import { Grid2X2, House, Info, MessageCircle, Utensils } from 'lucide-react';
import type { NovotelNavigationKey } from '@/components/public/novotel/novotel-mobile-navigation';

type NavigationItem = {
  key: NovotelNavigationKey;
  href: string;
  label: string;
};

const ICONS = {
  home: House,
  services: Grid2X2,
  menu: Utensils,
  information: Info,
  contact: MessageCircle,
};

export function MercureBottomDock({
  items,
  activeItem,
  ariaLabel,
}: {
  items: NavigationItem[];
  activeItem: NovotelNavigationKey;
  ariaLabel: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="mercure-bottom-dock fixed inset-x-0 bottom-0 z-40 border-t border-[#52204f]/10 bg-[#fffdfd]/96 pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_42px_-28px_rgba(61,23,60,.34)] backdrop-blur-xl min-[1025px]:hidden"
    >
      <div className="mx-auto grid min-h-[68px] max-w-[430px] grid-cols-5 px-1.5 py-1.5">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          const isActive = item.key === activeItem;

          return (
            <a
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1 text-[9px] font-medium transition min-[360px]:text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#71386e] focus-visible:ring-offset-2 ${
                isActive
                  ? 'text-[#52204f]'
                  : 'text-[#685d64] hover:bg-[#f4ecef] hover:text-[#52204f]'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.35 : 1.7} aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
