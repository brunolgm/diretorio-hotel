import { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { MobileMenu } from '@/components/admin/mobile-menu';
import { NavLinks, type NavItem } from '@/components/admin/nav-links';
import { hasMinimumRole, requireAdminAccess, type AppRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

interface AdminLayoutProps {
  children: ReactNode;
}

async function signOut() {
  'use server';

  const supabase = await createClient();
  await supabase.auth.signOut();
}

function getNavItemsForRole(role: AppRole) {
  const items: NavItem[] = [{ href: '/admin', label: 'Dashboard', icon: 'dashboard' }];

  if (hasMinimumRole(role, 'editor')) {
    items.push({
      href: '/admin/hotel',
      label: 'Informações do hotel',
      icon: 'hotel' as const,
    });
  }

  items.push(
    { href: '/admin/servicos', label: 'Serviços', icon: 'services' as const },
    { href: '/admin/departamentos', label: 'Departamentos', icon: 'departments' as const },
    { href: '/admin/politicas', label: 'Políticas', icon: 'policies' as const },
    { href: '/admin/comunicados', label: 'Comunicados', icon: 'announcements' as const },
    { href: '/admin/banners', label: 'Banners', icon: 'banners' as const }
  );

  if (hasMinimumRole(role, 'administrador')) {
    items.push({ href: '/admin/usuarios', label: 'Usuários', icon: 'users' as const });
  }

  return items;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const { profile } = await requireAdminAccess('visualizador');
  const navItems = getNavItemsForRole(profile.normalizedRole);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between rounded-[28px] bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200/70 lg:hidden">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              LibGuest
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
              Painel administrativo
            </h1>
          </div>

          <MobileMenu navItems={navItems} signOutAction={signOut} />
        </div>

        <div className="flex gap-6">
          <aside className="hidden w-72 shrink-0 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 lg:block">
            <div className="border-b border-slate-200 pb-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                LibGuest
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Painel administrativo
              </h2>
            </div>

            <div className="mt-5">
              <NavLinks items={navItems} />
            </div>

            <div className="mt-8 border-t border-slate-200 pt-5">
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                LibGuest
              </p>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </form>
            </div>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
