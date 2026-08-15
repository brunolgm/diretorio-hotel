import Link from 'next/link';
import { ArrowRight, Building2, Globe2, Image, Plug } from 'lucide-react';
import { AdminBreadcrumbs, AdminPageHero, AdminSectionTitle, AdminSurface } from '@/components/admin/ui';
import { requireAdminAccess } from '@/lib/auth';

const configurationAreas = [
  { title: 'Geral', description: 'Identidade, operação, contato, Wi-Fi e links do hotel.', href: '/admin/hotel', icon: Building2 },
  { title: 'Identidade visual', description: 'Marca, logo, imagem principal e tema já disponíveis.', href: '/admin/hotel#marca', icon: Image },
  { title: 'Publicação', description: 'Consulte a visão consolidada da experiência pública.', href: '/admin/experiencia', icon: Globe2 },
] as const;

export default async function AdminSettingsPage() {
  await requireAdminAccess('editor');

  return (
    <main className="space-y-6">
      <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Configurações' }]} />
      <AdminPageHero eyebrow="Principal" title="Configurações" description="Atalhos para as configurações já disponíveis no painel." />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {configurationAreas.map(({ title, description, href, icon: Icon }) => (
          <Link key={title} href={href} className="admin-theme-surface group rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 transition hover:border-[var(--admin-focus)] hover:shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="rounded-xl bg-[var(--admin-accent-soft)] p-2.5 text-[var(--admin-accent)]"><Icon className="h-5 w-5" /></span>
              <ArrowRight className="h-5 w-5 text-[var(--admin-muted)] transition group-hover:translate-x-0.5" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-[var(--admin-text-strong)]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{description}</p>
          </Link>
        ))}
      </section>
      <AdminSurface>
        <AdminSectionTitle eyebrow="Integrações" title="Conexões externas" description="Nenhuma integração é configurável por este painel nesta etapa." />
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-4 text-sm text-[var(--admin-muted)]">
          <Plug className="h-5 w-5 shrink-0" />
          TheX e Opera permanecem somente no catálogo de evolução, sem conexão ativa criada pela Sprint 46.7.
        </div>
      </AdminSurface>
    </main>
  );
}
