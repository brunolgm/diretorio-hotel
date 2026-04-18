'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ConciergeBell,
  Hotel,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: 'dashboard' | 'hotel' | 'services' | 'departments' | 'policies';
}

interface NavLinksProps {
  items: NavItem[];
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
    case 'departments':
      return <Building2 className={className} />;
    case 'policies':
      return <ShieldCheck className={className} />;
    case 'dashboard':
    default:
      return <LayoutDashboard className={className} />;
  }
}

export function NavLinks({ items }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {items.map((item) => {
        const isActive = isActiveRoute(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
              isActive
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <NavIcon icon={item.icon} className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
