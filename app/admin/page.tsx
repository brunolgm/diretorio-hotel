import { requireUser } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';

export default async function AdminPage() {
  await requireUser();
  const hotel = await getAdminHotel();

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">Painel administrador</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{hotel.name}</h1>
          <p className="mt-2 text-slate-600">Gerencie as informações do diretório digital do hotel.</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Cidade</p>
              <p className="mt-1 font-semibold">{hotel.city || 'Não informada'}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Check-in</p>
              <p className="mt-1 font-semibold">{hotel.checkin_time || 'Não informado'}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-sm text-slate-500">Check-out</p>
              <p className="mt-1 font-semibold">{hotel.checkout_time || 'Não informado'}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}