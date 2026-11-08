import type {ReactNode} from 'react';
import {AdminSidebar} from './admin-sidebar';
import {AdminThemeProvider} from './admin-theme-provider';
import {MobileMenu} from './mobile-menu';
import {getAdminThemeStyle,type AdminTheme} from '@/lib/admin-theme';
import type {AdminNavigationGroup} from '@/lib/admin-navigation';

// Shared presentation only. Authentication, entitlements and hotel resolution remain in AdminLayout.
export function AdminShell({children,adminTheme,hotelName,hotelCity,hotelLogoUrl,navGroups,userName,userRole,signOut}:{children:ReactNode;adminTheme:AdminTheme;hotelName:string;hotelCity:string|null;hotelLogoUrl:string|null;navGroups:AdminNavigationGroup[];userName:string;userRole:string;signOut:()=>Promise<void>}){
 const adminThemeStyle=getAdminThemeStyle(adminTheme);
  return (
    <AdminThemeProvider theme={adminTheme}>
      <aside className="fixed inset-y-0 left-0 z-40 hidden h-dvh w-64 border-r border-[var(--admin-sidebar-border)] lg:block">
        <AdminSidebar
          hotelName={hotelName}
          hotelCity={hotelCity}
          hotelLogoUrl={hotelLogoUrl}
          themeLabel={adminTheme.brandCode ? adminTheme.label : null}
          navGroups={navGroups}
          userName={userName}
          userRole={userRole}
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
                hotelLogoUrl={hotelLogoUrl}
                themeLabel={adminTheme.brandCode ? adminTheme.label : null}
                themeCode={adminTheme.code}
                themePreset={adminTheme.themePreset}
                logoTreatment={adminTheme.logoTreatment}
                themeStyle={adminThemeStyle}
                userName={userName}
                userRole={userRole}
              />
              <p className="min-w-0 truncate text-sm font-semibold text-[var(--admin-text-strong)]">{hotelName}</p>
          </div>
        </header>

        <div className="w-full min-w-0 p-4 sm:p-6 xl:px-7 xl:py-6">{children}</div>
      </div>
    </AdminThemeProvider>
  );
}
