import type { ReactNode } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { PlatformNav } from '@/components/platform/platform-nav';
import { requirePlatformAccess } from '@/lib/platform-auth';
import { createClient } from '@/lib/supabase/server';

async function signOut() {
  'use server';

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  await requirePlatformAccess();

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="shrink-0 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 lg:w-72">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
              <div className="rounded-2xl bg-slate-950 p-3 text-white">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  LibGuest Platform
                </p>
                <p className="mt-1 font-semibold tracking-tight text-slate-950">
                  Administração Global
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto lg:overflow-visible">
              <PlatformNav />
            </div>

            <form action={signOut} className="mt-5 border-t border-slate-200 pt-5">
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sair
              </button>
            </form>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
