'use client';
import Link from 'next/link';
import { BookOpen, ClipboardList, FileText, LayoutDashboard, Printer, Store } from 'lucide-react';
import type { FbWorkspaceLink, FbWorkspaceSection } from '@/lib/fb/admin-workspace';
import { cn } from '@/lib/utils';

const icons = { overview: LayoutDashboard, outlet: Store, menu: FileText, item: BookOpen, orders: ClipboardList, printing: Printer };
export function FbWorkspaceNav({ links, active }: { links: FbWorkspaceLink[]; active: FbWorkspaceSection }) {
  return <nav aria-label="Gastronomia" className="fb-workspace-nav" data-fb-workspace-nav>
    {links.map(link => { const Icon = icons[link.section]; return <Link key={link.section} href={link.href} aria-current={active === link.section ? 'page' : undefined} className={cn('fb-workspace-tab', active === link.section && 'is-active')}><Icon aria-hidden="true" size={18}/>{link.label}</Link>; })}
  </nav>;
}
