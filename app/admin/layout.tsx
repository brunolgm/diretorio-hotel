import { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { MobileMenu } from '@/components/admin/mobile-menu';
import { type NavItem } from '@/components/admin/nav-links';
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
    .select('name, city')
    .eq('id', profile.hotel_id)
    .single();
  const hotelName = hotel?.name || 'Hotel';
  const hotelCity = hotel?.city || null;
  const userName = profile.full_name?.trim() || 'Usuário do hotel';

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-slate-900/10 lg:block">
        <AdminSidebar
          hotelName={hotelName}
          hotelCity={hotelCity}
          navItems={navItems}
          userName={userName}
          userRole={profile.normalizedRole}
          signOutAction={signOut}
        />
      </aside>

      <div className="min-w-0 lg:pl-[260px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <MobileMenu
                navItems={navItems}
                signOutAction={signOut}
                hotelName={hotelName}
                hotelCity={hotelCity}
                userName={userName}
                userRole={profile.normalizedRole}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Administrando este hotel
                </p>
                <p className="truncate text-sm font-semibold text-[#07182f] sm:text-base">{hotelName}</p>
              </div>
            </div>

            <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              <span>{hotelCity || 'Cidade não informada'}</span>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 xl:p-8">{children}</div>
      </div>
    </div>
  );
}
