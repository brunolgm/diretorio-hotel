'use client';

import { useState } from 'react';
import type { AdminLogoTreatment, AdminThemeCode, AdminThemeStyle } from '@/lib/admin-theme';
import { usePathname, useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { type NavItem } from '@/components/admin/nav-links';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface MobileMenuProps {
  navItems: NavItem[];
  signOutAction: () => Promise<void>;
  hotelName: string;
  hotelCity: string | null;
  hotelLogoUrl: string | null;
  themeLabel: string | null;
  themeCode: AdminThemeCode;
  themePreset: string | null;
  logoTreatment: AdminLogoTreatment;
  themeStyle: AdminThemeStyle;
  userName: string;
  userRole: string;
}

export function MobileMenu({
  navItems,
  signOutAction,
  hotelName,
  hotelCity,
  hotelLogoUrl,
  themeLabel,
  themeCode,
  themePreset,
  logoTreatment,
  themeStyle,
  userName,
  userRole,
}: MobileMenuProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const locationKey = `${pathname}?${searchParams.toString()}`;

  return (
    <Sheet key={locationKey} open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-strong)] shadow-sm transition hover:bg-[var(--admin-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)] lg:hidden"
            aria-label="Abrir menu administrativo"
          />
        }
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>

      <SheetContent
        side="left"
        showCloseButton={false}
        className="admin-theme w-[88%] max-w-[310px] gap-0 border-0 bg-[var(--admin-sidebar)] p-0"
        data-admin-theme={themeCode}
        data-admin-theme-preset={themePreset || 'default'}
        data-admin-logo-treatment={logoTreatment}
        style={themeStyle}
      >
        <AdminSidebar
          hotelName={hotelName}
          hotelCity={hotelCity}
          hotelLogoUrl={hotelLogoUrl}
          themeLabel={themeLabel}
          navItems={navItems}
          userName={userName}
          userRole={userRole}
          signOutAction={async () => {
            setOpen(false);
            await signOutAction();
          }}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
