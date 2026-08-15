'use client';

import { useState } from 'react';
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
  userName: string;
  userRole: string;
}

export function MobileMenu({
  navItems,
  signOutAction,
  hotelName,
  hotelCity,
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
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#07182f] shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 lg:hidden"
            aria-label="Abrir menu administrativo"
          />
        }
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>

      <SheetContent side="left" showCloseButton={false} className="w-[88%] max-w-[310px] gap-0 border-0 bg-[#07182f] p-0">
        <AdminSidebar
          hotelName={hotelName}
          hotelCity={hotelCity}
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
