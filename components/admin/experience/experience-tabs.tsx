import Link from 'next/link';
import { Eye, LayoutDashboard, Navigation, Palette, Search, Text } from 'lucide-react';
import { cn } from '@/lib/utils';

export const EXPERIENCE_TABS = [
  { key: 'visao-geral', label: 'Visão Geral', icon: LayoutDashboard, available: true },
  { key: 'aparencia', label: 'Aparência', icon: Palette, available: false },
  { key: 'conteudo', label: 'Conteúdo', icon: Text, available: false },
  { key: 'navegacao', label: 'Navegação', icon: Navigation, available: false },
  { key: 'seo', label: 'SEO e Compartilhamento', icon: Search, available: false },
  { key: 'preview', label: 'Pré-visualização', icon: Eye, available: false },
] as const;

export function ExperienceTabs({ activeTab }: { activeTab: string }) {
  return (
    <nav aria-label="Áreas da experiência pública" className="admin-scrollbar-hidden -mx-4 overflow-x-auto border-b border-[var(--admin-border)] px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-5 scroll-smooth sm:gap-7">
        {EXPERIENCE_TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return <Link key={key} href={key === 'visao-geral' ? '/admin/experiencia' : `/admin/experiencia?tab=${key}`} className={cn('relative flex h-11 items-center gap-2 whitespace-nowrap px-1 text-xs font-medium transition', active ? 'text-[var(--admin-accent)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--admin-accent)]' : 'text-[var(--admin-muted)] hover:text-[var(--admin-text-strong)]')} aria-current={active ? 'page' : undefined}><Icon className="h-3.5 w-3.5" />{label}</Link>;
        })}
      </div>
    </nav>
  );
}
