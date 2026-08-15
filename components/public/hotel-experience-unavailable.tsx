import { Building2 } from 'lucide-react';

export function HotelExperienceUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-xl rounded-[32px] bg-white p-8 text-center shadow-sm ring-1 ring-slate-200/80 md:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <Building2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          LibGuest
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
          Experiência indisponível
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Esta experiência não está disponível no momento. Consulte a equipe responsável pelo
          hotel ou tente novamente mais tarde.
        </p>
      </section>
    </main>
  );
}
