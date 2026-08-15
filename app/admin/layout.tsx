import { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminThemeProvider } from '@/components/admin/admin-theme-provider';
import { MobileMenu } from '@/components/admin/mobile-menu';
import { type NavItem } from '@/components/admin/nav-links';
import { hasMinimumRole, requireAdminAccess, type AppRole } from '@/lib/auth';
import { getAdminThemeStyle, resolveAdminTheme } from '@/lib/admin-theme';
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
      icon: 'hotel',
    });
    items.push({ href: '/admin/apartamentos', label: 'Apartamentos', icon: 'rooms' });
  }

  items.push(
    { href: '/admin/servicos', label: 'Serviços', icon: 'services' },
    { href: '/admin/departamentos', label: 'Departamentos', icon: 'departments' },
    { href: '/admin/politicas', label: 'Políticas', icon: 'policies' },
    { href: '/admin/comunicados', label: 'Anúncios', icon: 'announcements' },
    { href: '/admin/banners', label: 'Banners', icon: 'banners' }
  );

  if (hasMinimumRole(role, 'administrador')) {
    items.push({ href: '/admin/usuarios', label: 'Usuários', icon: 'users' });
  }

  return items;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const { profile } = await requireAdminAccess('visualizador');
  const navItems = getNavItemsForRole(profile.normalizedRole);
  const supabase = await createClient();
  const { data: hotel } = await supabase
    .from('hotels')
    .select('name, city, logo_url, brand_code, theme_preset')
    .eq('id', profile.hotel_id)
    .single();
  const hotelName = hotel?.name || 'Hotel';
  const hotelCity = hotel?.city || null;
  const userName = profile.full_name?.trim() || 'Usuário do hotel';
  const adminTheme = resolveAdminTheme(hotel?.brand_code, hotel?.theme_preset);
  const adminThemeStyle = getAdminThemeStyle(adminTheme);

  return (
    <AdminThemeProvider theme={adminTheme}>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-[var(--admin-sidebar-border)] lg:block">
        <AdminSidebar
          hotelName={hotelName}
          hotelCity={hotelCity}
          hotelLogoUrl={hotel?.logo_url || null}
          themeLabel={adminTheme.brandCode ? adminTheme.label : null}
          navItems={navItems}
          userName={userName}
          userRole={profile.normalizedRole}
          signOutAction={signOut}
        />
      </aside>

      <div className="min-w-0 lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-[var(--admin-border)] bg-[color:var(--admin-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--admin-surface)]/90">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <MobileMenu
                navItems={navItems}
                signOutAction={signOut}
                hotelName={hotelName}
                hotelCity={hotelCity}
                hotelLogoUrl={hotel?.logo_url || null}
                themeLabel={adminTheme.brandCode ? adminTheme.label : null}
                themeCode={adminTheme.code}
                themePreset={adminTheme.themePreset}
                logoTreatment={adminTheme.logoTreatment}
                themeStyle={adminThemeStyle}
                userName={userName}
                userRole={profile.normalizedRole}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-muted)]">
                  Administrando este hotel
                </p>
                <p className="truncate text-sm font-semibold text-[var(--admin-text-strong)] sm:text-base">{hotelName}</p>
              </div>
            </div>

            <div className="hidden items-center gap-2 text-sm text-[var(--admin-muted)] sm:flex">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              <span>{hotelCity || 'Cidade não informada'}</span>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 xl:p-8">{children}</div>
      </div>
    </AdminThemeProvider>
  );
}
