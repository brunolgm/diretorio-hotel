'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push('/admin');
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] p-6">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 xl:grid-cols-[1.05fr,0.95fr]">
          <section className="hidden overflow-hidden rounded-[36px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_55%,#1e293b_100%)] p-10 text-white shadow-sm xl:block">
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 backdrop-blur">
              GuestDesk
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight">
              Painel premium para operar o diretório digital do hotel.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200">
              Gerencie conteúdos, contatos e informações importantes com uma experiência visual mais
              organizada e preparada para a operação do dia a dia.
            </p>

            <div className="mt-8 grid gap-4">
              <div className="rounded-[24px] bg-white/10 p-5 backdrop-blur">
                <p className="text-sm font-semibold text-white">Atualizações rápidas</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Hotel, serviços, departamentos e políticas centralizados em um só fluxo.
                </p>
              </div>

              <div className="rounded-[24px] bg-white/10 p-5 backdrop-blur">
                <p className="text-sm font-semibold text-white">Experiência consistente</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  O painel e o diretório público seguem a mesma linguagem visual do produto.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70 md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              Acesso administrativo
            </div>

            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
              Entrar no painel
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Acesse a administração do diretório digital do hotel com seu e-mail e senha.
            </p>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">E-mail</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Senha</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-slate-200"
                    required
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
