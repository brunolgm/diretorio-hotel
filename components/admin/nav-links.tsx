'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BedDouble,
  BarChart3,
  BookOpenText,
  Building2,
  ConciergeBell,
  FileClock,
  Globe2,
  Hotel,
  Images,
  Languages,
  LayoutDashboard,
  Megaphone,
  Map,
  Plane,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminNavigationGroup, AdminNavIcon } from '@/lib/admin-navigation';

interface NavLinksProps {
  groups: AdminNavigationGroup[];
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
  icon: AdminNavIcon;
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
    case 'settings':
      return <Settings className={className} />;
    case 'experience':
      return <Globe2 className={className} />;
    case 'menu':
      return <BookOpenText className={className} />;
    case 'tourism':
      return <Map className={className} />;
    case 'languages':
      return <Languages className={className} />;
    case 'logs':
      return <FileClock className={className} />;
    case 'analytics':
      return <BarChart3 className={className} />;
    case 'flights':
      return <Plane className={className} />;
    case 'dashboard':
    default:
      return <LayoutDashboard className={className} />;
  }
}

export function NavLinks({ groups, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação administrativa" className="space-y-4">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={group.label ? `admin-nav-${group.key}` : undefined} className={group.key === 'management' ? 'border-t border-[var(--admin-sidebar-border)] pt-3' : undefined}>
          {group.label ? <p id={`admin-nav-${group.key}`} className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-sidebar-muted)]">
            {group.label}
          </p> : null}
          <div className="space-y-1">
            {group.items.map((item) => {
              const isActive = isActiveRoute(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'relative flex min-h-9 items-center gap-2.5 rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]',
                    isActive
                      ? 'bg-[var(--admin-active-bg)] text-[var(--admin-active-text)] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.8)] before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--admin-accent)]'
                      : 'text-[var(--admin-sidebar-muted)] hover:bg-white/10 hover:text-[var(--admin-sidebar-text)]'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <NavIcon icon={item.icon} className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}
