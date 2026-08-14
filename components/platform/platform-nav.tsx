'use client';

import Link from 'next/link';
import { Building2, LayoutDashboard } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const items = [
  { href: '/platform', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/platform/hoteis', label: 'Hotéis', icon: Building2 },
] as const;

export function PlatformNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administração da plataforma" className="flex gap-2 lg:flex-col">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === '/platform'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
              active
                ? 'bg-slate-950 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
