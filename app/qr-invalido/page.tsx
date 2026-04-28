import Link from 'next/link';

export default function InvalidRoomQrPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#f8fafc_100%)] px-4 py-12 md:px-6">
      <div className="mx-auto max-w-2xl rounded-[32px] bg-white p-8 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 md:p-10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
          LibGuest
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          QR Code indisponível
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Este QR Code não está ativo no momento. Peça apoio à recepção ou leia novamente o QR do
          apartamento para acessar o diretório correto.
        </p>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Ir para a página inicial
          </Link>
        </div>
      </div>
    </main>
  );
}
