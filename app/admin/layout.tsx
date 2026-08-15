import { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminThemeProvider } from '@/components/admin/admin-theme-provider';
import { MobileMenu } from '@/components/admin/mobile-menu';
import { requireAdminAccess } from '@/lib/auth';
import { getAdminThemeStyle, resolveAdminTheme } from '@/lib/admin-theme';
import { getAdminNavigationForRole } from '@/lib/admin-navigation';
import { createClient } from '@/lib/supabase/server';

interface AdminLayoutProps {
  children: ReactNode;
}

async function signOut() {
  'use server';

  const supabase = await createClient();
  await supabase.auth.signOut();
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const { profile } = await requireAdminAccess('visualizador');
  const navGroups = getAdminNavigationForRole(profile.normalizedRole);
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden h-dvh w-64 border-r border-[var(--admin-sidebar-border)] lg:block">
        <AdminSidebar
          hotelName={hotelName}
          hotelCity={hotelCity}
          hotelLogoUrl={hotel?.logo_url || null}
          themeLabel={adminTheme.brandCode ? adminTheme.label : null}
          navGroups={navGroups}
          userName={userName}
          userRole={profile.normalizedRole}
          signOutAction={signOut}
        />
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-[var(--admin-border)] bg-[color:var(--admin-surface)]/95 backdrop-blur lg:hidden">
          <div className="flex min-h-14 items-center gap-3 px-4">
              <MobileMenu
                navGroups={navGroups}
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
              <p className="min-w-0 truncate text-sm font-semibold text-[var(--admin-text-strong)]">{hotelName}</p>
          </div>
        </header>

        <div className="w-full min-w-0 p-4 sm:p-6 xl:px-7 xl:py-6">{children}</div>
      </div>
    </AdminThemeProvider>
  );
}
