import { Building2, LogOut } from 'lucide-react';
import { NavLinks, type NavItem } from '@/components/admin/nav-links';

interface AdminSidebarProps {
  hotelName: string;
  hotelCity: string | null;
  navItems: NavItem[];
  userName: string;
  userRole: string;
  signOutAction: () => Promise<void>;
  onNavigate?: () => void;
}

export function AdminSidebar({
  hotelName,
  hotelCity,
  navItems,
  userName,
  userRole,
  signOutAction,
  onNavigate,
}: AdminSidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#07182f] text-white">
      <div className="border-b border-white/10 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-base font-bold text-[#07182f] shadow-sm">
            LG
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight">LibGuest</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
              Hotel admin
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.06] p-3.5">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{hotelName}</p>
              <p className="mt-1 truncate text-xs text-slate-400">
                {hotelCity || 'Cidade não informada'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Navegação
        </p>
        <NavLinks items={navItems} onNavigate={onNavigate} />
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white ring-1 ring-white/10">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="truncate text-xs capitalize text-slate-400">{userRole}</p>
          </div>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
