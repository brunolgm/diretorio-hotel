import Link from 'next/link';
import { ReactNode } from 'react';
import {
  Menu,
  Hotel,
  LayoutDashboard,
  Building2,
  ConciergeBell,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface AdminLayoutProps {
  children: ReactNode;
}

async function signOut() {
  'use server';

  const supabase = await createClient();
  await supabase.auth.signOut();
}

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/hotel', label: 'Informações do hotel', icon: Hotel },
  { href: '/admin/servicos', label: 'Serviços', icon: ConciergeBell },
  { href: '/admin/departamentos', label: 'Departamentos', icon: Building2 },
  { href: '/admin/politicas', label: 'Políticas', icon: ShieldCheck },
];

function NavLinks() {
  return (
    <nav className="space-y-2">
      {navItems.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileMenu() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
          />
        }
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>

      <SheetContent side="left" className="w-[88%] max-w-[320px] border-0 bg-white p-0">
        <div className="flex h-full flex-col">
          <div className="border-b px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Painel administrador
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Diretório do Hotel
            </h2>
          </div>

          <div className="flex-1 px-4 py-4">
            <NavLinks />
          </div>

          <div className="border-t p-4">
            <form action={signOut}>
              <button className="flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
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

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between rounded-[28px] bg-white px-4 py-4 shadow-sm lg:hidden">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Painel administrador
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
              Diretório do Hotel
            </h1>
          </div>

          <MobileMenu />
        </div>

        <div className="flex gap-6">
          <aside className="hidden w-72 shrink-0 rounded-[32px] bg-white p-5 shadow-sm lg:block">
            <div className="border-b pb-5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Painel administrador
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Diretório do Hotel
              </h2>
            </div>

            <div className="mt-5">
              <NavLinks />
            </div>

            <div className="mt-8 border-t pt-5">
              <form action={signOut}>
                <button className="flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </form>
            </div>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
