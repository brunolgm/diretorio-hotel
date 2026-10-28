import { Home, Info, MessageCircle, BellRing } from 'lucide-react';
import type { CanonicalPublicNavigationKey } from '@/lib/public-navigation';

const icons = { home: Home, services: BellRing, information: Info, contact: MessageCircle };

export function PublicBottomDock({ items, activeItem, ariaLabel }: {
  items: { key: CanonicalPublicNavigationKey; href: string; label: string }[];
  activeItem: CanonicalPublicNavigationKey;
  ariaLabel: string;
}) {
  const visibleItems = items.filter((item) => item.key !== 'menu');
  return <nav aria-label={ariaLabel} className="public-bottom-dock fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] pb-[env(safe-area-inset-bottom)]">
    <div className="mx-auto flex max-w-3xl">
      {visibleItems.map((item) => {
        const Icon = icons[item.key as keyof typeof icons];
        return <a key={item.key} href={item.href} aria-current={item.key === activeItem ? 'page' : undefined}
          className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-t-2 px-1 text-center text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--hotel-accent)] ${item.key === activeItem ? 'border-[color:var(--hotel-accent)] bg-[var(--hotel-active-bg)] font-semibold text-[color:var(--hotel-primary)]' : 'border-transparent text-[color:var(--hotel-text-muted)]'}`}>
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="max-w-full break-words">{item.label}</span>
        </a>;
      })}
    </div>
  </nav>;
}
