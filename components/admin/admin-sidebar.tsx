import { Building2, LogOut } from 'lucide-react';
import { NavLinks, type NavItem } from '@/components/admin/nav-links';

interface AdminSidebarProps {
  hotelName: string;
  hotelCity: string | null;
  hotelLogoUrl: string | null;
  themeLabel: string | null;
  navItems: NavItem[];
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
  navItems,
  userName,
  userRole,
  signOutAction,
  onNavigate,
}: AdminSidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--admin-sidebar)] text-[var(--admin-sidebar-text)]">
      <div className="border-b border-[var(--admin-sidebar-border)] px-5 py-6">
        <div className="flex items-center gap-3">
          <div
            className="admin-brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-active-bg)] bg-contain bg-center bg-no-repeat text-base font-bold text-[var(--admin-active-text)] shadow-sm"
            role={hotelLogoUrl ? 'img' : undefined}
            aria-label={hotelLogoUrl ? `Logo de ${hotelName}` : undefined}
            style={hotelLogoUrl ? { backgroundImage: `url(${JSON.stringify(hotelLogoUrl)})` } : undefined}
          >
            {hotelLogoUrl ? <span className="sr-only">{hotelName}</span> : 'LG'}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">LibGuest</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--admin-sidebar-muted)]">
              Administração do hotel
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-[var(--admin-sidebar-border)] bg-white/[0.06] p-3.5">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-focus)]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--admin-sidebar-text)]">{hotelName}</p>
              <p className="mt-1 truncate text-xs text-[var(--admin-sidebar-muted)]">
                {hotelCity || 'Cidade não informada'}
              </p>
              {themeLabel ? (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-focus)]">
                  {themeLabel}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--admin-sidebar-muted)]">
          Navegação
        </p>
        <NavLinks items={navItems} onNavigate={onNavigate} />
      </div>

      <div className="border-t border-[var(--admin-sidebar-border)] p-4">
        <div className="mb-3 flex items-center gap-3 px-2">
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
            className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--admin-sidebar-muted)] transition hover:bg-white/10 hover:text-[var(--admin-sidebar-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus)]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
