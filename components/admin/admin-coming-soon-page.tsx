import { Construction } from 'lucide-react';
import { AdminBreadcrumbs, AdminEmptyState, AdminPageHero, AdminSurface } from '@/components/admin/ui';

export function AdminComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="space-y-6">
      <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: title }]} />
      <AdminPageHero eyebrow="Estrutura preparada" title={title} description={description} />
      <AdminSurface>
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
          <Construction className="h-6 w-6" aria-hidden="true" />
        </div>
        <AdminEmptyState
          title="Em breve"
          description="Este espaço já faz parte da arquitetura do painel, mas ainda não possui operação, dados ou configurações disponíveis."
        />
      </AdminSurface>
    </main>
  );
}
