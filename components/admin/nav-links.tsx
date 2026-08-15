'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BedDouble,
  Building2,
  ConciergeBell,
  Hotel,
  Images,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  icon:
    | 'dashboard'
    | 'hotel'
    | 'services'
    | 'rooms'
    | 'departments'
    | 'policies'
    | 'announcements'
    | 'banners'
    | 'users';
}

interface NavLinksProps {
  items: NavItem[];
  onNavigate?: () => void;
}

function isActiveRoute(pathname: string, href: string) {
  if (href === '/admin') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({
  icon,
  className,
}: {
  icon: NavItem['icon'];
  className?: string;
}) {
  switch (icon) {
    case 'hotel':
      return <Hotel className={className} />;
    case 'services':
      return <ConciergeBell className={className} />;
    case 'rooms':
      return <BedDouble className={className} />;
    case 'departments':
      return <Building2 className={className} />;
    case 'policies':
      return <ShieldCheck className={className} />;
    case 'announcements':
      return <Megaphone className={className} />;
    case 'banners':
      return <Images className={className} />;
    case 'users':
      return <Users className={className} />;
    case 'dashboard':
    default:
      return <LayoutDashboard className={className} />;
  }
}

export function NavLinks({ items, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const isActive = isActiveRoute(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]',
              isActive
                ? 'bg-[var(--admin-active-bg)] text-[var(--admin-active-text)] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.8)] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--admin-accent)]'
                : 'text-[var(--admin-sidebar-muted)] hover:bg-white/10 hover:text-[var(--admin-sidebar-text)]'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <NavIcon icon={item.icon} className="h-[18px] w-[18px] shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
