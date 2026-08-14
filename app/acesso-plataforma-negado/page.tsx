import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function returnToLogin() {
  'use server';

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login?next=/platform');
}

export default function PlatformAccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-lg rounded-[32px] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/70">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
          LibGuest Platform
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Acesso não autorizado
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sua conta não possui uma associação global ativa para administrar a plataforma.
        </p>
        <form action={returnToLogin} className="mt-6">
          <button
            type="submit"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Voltar ao login
          </button>
        </form>
      </section>
    </main>
  );
}
