'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { LogOut, Menu } from 'lucide-react';
import { NavLinks, type NavItem } from '@/components/admin/nav-links';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface MobileMenuProps {
  navItems: NavItem[];
  signOutAction: () => Promise<void>;
}

export function MobileMenu({ navItems, signOutAction }: MobileMenuProps) {
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
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 lg:hidden"
            aria-label="Abrir menu administrativo"
          />
        }
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>

      <SheetContent side="left" className="w-[88%] max-w-[320px] border-0 bg-white p-0">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              LibGuest
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Painel administrativo
            </h2>
          </div>

          <div className="flex-1 px-4 py-4">
            <NavLinks items={navItems} onNavigate={() => setOpen(false)} />
          </div>

          <div className="border-t border-slate-200 p-4">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              LibGuest
            </p>
            <form
              action={async () => {
                setOpen(false);
                await signOutAction();
              }}
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
