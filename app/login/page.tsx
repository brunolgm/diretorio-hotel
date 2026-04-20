'use client';

import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#f8fafc_100%)] p-6">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 xl:grid-cols-[1.08fr,0.92fr]">
          <section className="relative hidden overflow-hidden rounded-[38px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_52%,#1e293b_100%)] p-10 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.85)] ring-1 ring-slate-900/10 xl:block">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(148,163,184,0.14),transparent_30%)]" />

            <div className="relative">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                GuestDesk
              </div>

              <h1 className="mt-7 text-4xl font-semibold tracking-tight leading-[1.04]">
                Controle a operação do diretório digital com um painel mais elegante e pronto para
                o dia a dia do hotel.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200">
                Gerencie conteúdos, contatos e informações importantes com uma experiência
                consistente, organizada e preparada para apresentação comercial e operação real.
              </p>

              <div className="mt-8 grid gap-4">
                <div className="rounded-[26px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <p className="text-sm font-semibold text-white">Atualizações rápidas</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Hotel, serviços, departamentos e políticas em um único fluxo de gestão.
                  </p>
                </div>

                <div className="rounded-[26px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                  <p className="text-sm font-semibold text-white">Leitura consistente</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    Painel administrativo e experiência pública alinhados na mesma linguagem visual
                    do produto.
                  </p>
                </div>
              </div>

              <div className="mt-10 border-t border-white/10 pt-6">
                <p className="text-sm text-slate-300">
                  Plataforma para hospitalidade digital com apresentação premium.
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  GuestDesk by BLID Tecnologia
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[34px] bg-white p-8 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-600 ring-1 ring-slate-200/70">
              <ShieldCheck className="h-3.5 w-3.5" />
              Acesso administrativo
            </div>

            <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
              Entrar no GuestDesk
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              Acesse o painel do hotel com seu e-mail e senha para gerenciar a experiência digital
              do hóspede.
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
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.75)] transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 disabled:opacity-60"
              >
                {loading ? 'Entrando...' : 'Entrar no painel'}
              </button>
            </form>

            <div className="mt-8 rounded-[24px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 ring-1 ring-slate-200/70 xl:hidden">
              <p className="text-sm text-slate-500">Assinatura institucional</p>
              <p className="mt-2 text-sm font-medium text-slate-800">
                GuestDesk by BLID Tecnologia
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
