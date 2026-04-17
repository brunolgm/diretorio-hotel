import Link from 'next/link';
import { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
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
  await requireUser();

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6">
        <aside className="hidden w-72 shrink-0 rounded-3xl bg-white p-5 shadow-sm lg:block">
          <p className="text-sm text-slate-500">Painel administrador</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">Diretório do Hotel</h2>

          <nav className="mt-6 space-y-2">
            <Link href="/admin" className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Dashboard
            </Link>
            <Link href="/admin/hotel" className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Informações do hotel
            </Link>
            <Link href="/admin/servicos" className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Serviços
            </Link>
            <Link href="/admin/departamentos" className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Departamentos
            </Link>
            <Link href="/admin/politicas" className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Políticas
            </Link>
          </nav>

          <form action={signOut} className="mt-8">
            <button className="w-full rounded-2xl border px-4 py-3 text-sm font-medium hover:bg-slate-50">
              Sair
            </button>
          </form>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}