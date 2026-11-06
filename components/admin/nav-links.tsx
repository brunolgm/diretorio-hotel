'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, UtensilsCrossed } from 'lucide-react';
import { fbWorkspaceSection } from '@/lib/fb/admin-workspace';
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
    case 'gastronomy':
      return <UtensilsCrossed className={className} />;
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
  const query = useSearchParams();
  const fbSection = fbWorkspaceSection(pathname, query.get('kind'), query.get('id'));

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
              if (item.children?.length) return <details key="gastronomy" open={fbSection !== null} className="group/fb" data-fb-sidebar>
                <summary className={cn('flex min-h-10 cursor-pointer list-none items-center gap-2.5 rounded-[10px] px-3 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] [&::-webkit-details-marker]:hidden', fbSection !== null ? 'bg-[var(--admin-active-bg)] text-[var(--admin-active-text)]' : 'text-[var(--admin-sidebar-muted)] hover:bg-white/10 hover:text-[var(--admin-sidebar-text)]')}>
                  <NavIcon icon={item.icon} className="h-4 w-4 shrink-0"/><span className="min-w-0 flex-1">{item.label}</span><ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition group-open/fb:rotate-180"/>
                </summary>
                <div className="ml-6 mt-1 space-y-0.5 border-l border-[var(--admin-sidebar-border)] pl-2">{item.children.map(child => <Link key={child.href} href={child.href} onClick={onNavigate} aria-current={fbSection === child.section ? 'page' : undefined} className={cn('flex min-h-9 items-center rounded-lg px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]', fbSection === child.section ? 'bg-[var(--admin-active-bg)] font-semibold text-[var(--admin-active-text)]' : 'text-[var(--admin-sidebar-muted)] hover:bg-white/10 hover:text-[var(--admin-sidebar-text)]')}>{child.label}</Link>)}</div>
              </details>;

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
