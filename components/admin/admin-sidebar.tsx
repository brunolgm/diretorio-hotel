import { Building2, LogOut } from 'lucide-react';
import Image from 'next/image';
import { NavLinks } from '@/components/admin/nav-links';
import type { AdminNavigationGroup } from '@/lib/admin-navigation';

interface AdminSidebarProps {
  hotelName: string;
  hotelCity: string | null;
  hotelLogoUrl: string | null;
  themeLabel: string | null;
  navGroups: AdminNavigationGroup[];
  userName: string;
  userRole: string;
  signOutAction: () => Promise<void>;
  onNavigate?: () => void;
}

export function AdminSidebar({
  hotelName,
  hotelCity,
  hotelLogoUrl,
  themeLabel,
  navGroups,
  userName,
  userRole,
  signOutAction,
  onNavigate,
}: AdminSidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--admin-sidebar)] text-[var(--admin-sidebar-text)]">
      <div className="shrink-0 border-b border-[var(--admin-sidebar-border)] px-5 py-5">
        <div className="flex min-h-12 items-center gap-3">
          {hotelLogoUrl ? (
            <div className="relative h-12 w-14 shrink-0 overflow-hidden rounded-lg bg-white/95 p-1.5">
              <Image src={hotelLogoUrl} alt={`Logo de ${hotelName}`} fill sizes="56px" unoptimized className="object-contain p-1" />
            </div>
          ) : (
            <div className="admin-brand-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--admin-sidebar-border)] bg-white/[0.06] text-sm font-semibold text-[var(--admin-focus)]">
              {hotelName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold leading-4 text-[var(--admin-sidebar-text)]">{themeLabel || hotelName}</p>
            <p className="mt-1 truncate text-[10px] uppercase tracking-[0.1em] text-[var(--admin-sidebar-muted)]">{hotelCity || 'Administração do hotel'}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--admin-sidebar-muted)]"><Building2 className="h-3.5 w-3.5" /><span><strong className="font-semibold text-[var(--admin-sidebar-text)]">LibGuest</strong> · plataforma do hotel</span></div>
      </div>

      <div className="admin-scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        <NavLinks groups={navGroups} onNavigate={onNavigate} />
      </div>

      <div className="shrink-0 border-t border-[var(--admin-sidebar-border)] p-3.5">
        <div className="mb-2 flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-[var(--admin-sidebar-text)] ring-1 ring-[var(--admin-sidebar-border)]">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--admin-sidebar-text)]">{userName}</p>
            <p className="truncate text-xs capitalize text-[var(--admin-sidebar-muted)]">{userRole}</p>
          </div>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex h-9 w-full items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-[var(--admin-sidebar-muted)] transition hover:bg-white/10 hover:text-[var(--admin-sidebar-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
