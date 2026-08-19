'use client';

import { Grid2X2, House, Info, MessageCircle, Utensils } from 'lucide-react';

export type NovotelNavigationKey = 'home' | 'services' | 'menu' | 'information' | 'contact';

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

export function NovotelMobileNavigation({
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-100 bg-white/96 pb-[env(safe-area-inset-bottom)] shadow-[0_-14px_34px_-26px_rgba(15,23,42,0.35)] backdrop-blur-xl min-[1025px]:hidden"
    >
      <div className="mx-auto grid min-h-[60px] max-w-[430px] px-1 py-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = ICONS[item.key];
          const isActive = item.key === activeItem;

          return (
            <a
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-[9px] font-medium transition min-[360px]:text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005DA8] focus-visible:ring-offset-2 ${
                isActive ? 'text-[#005DA8]' : 'text-slate-600 hover:bg-blue-50 hover:text-[#003B7A]'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
