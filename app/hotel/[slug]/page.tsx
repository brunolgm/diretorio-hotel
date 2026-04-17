import {
  getHotelBySlug,
  getHotelDepartments,
  getHotelSections,
  getHotelPolicies,
} from '@/lib/queries';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function HotelDirectoryPage({ params }: PageProps) {
  const { slug } = await params;
  const hotel = await getHotelBySlug(slug);
  const sections = await getHotelSections(hotel.id);
  const departments = await getHotelDepartments(hotel.id);
  const policies = await getHotelPolicies(hotel.id);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-[32px] bg-slate-900 p-6 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-300">Diretório digital</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{hotel.name}</h1>
              <p className="mt-2 text-sm text-slate-300">{hotel.city || 'Cidade não informada'}</p>
            </div>

            {hotel.logo_url ? (
              <img
                src={hotel.logo_url}
                alt="Logo do hotel"
                className="h-14 w-14 rounded-2xl bg-white object-cover p-1"
              />
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <a
              href={hotel.booking_url || '#'}
              className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-slate-900"
            >
              Reservar
            </a>
            <a
              href={hotel.website_url || '#'}
              className="rounded-2xl bg-slate-700 px-4 py-3 text-center text-sm font-medium text-white"
            >
              Site
            </a>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Café da manhã</p>
            <p className="mt-1 text-sm font-semibold">{hotel.breakfast_hours || 'Não informado'}</p>
          </div>
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Wi-Fi</p>
            <p className="mt-1 text-sm font-semibold">{hotel.wifi_name || 'Não informado'}</p>
          </div>
        </section>

        <section className="space-y-3">
          {sections.map((item) => (
            <div key={item.id} className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-base font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.content}</p>
              {item.cta ? (
                <a
                  href={item.url || '#'}
                  className="mt-4 inline-block rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
                >
                  {item.cta}
                </a>
              ) : null}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Fale com o hotel</h2>
          {departments.map((item) => (
            <div key={item.id} className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-base font-semibold text-slate-900">{item.name}</p>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              <p className="mt-2 text-sm text-slate-500">{item.hours}</p>
              {item.action ? (
                <a
                  href={item.url || '#'}
                  className="mt-4 inline-block rounded-2xl border px-4 py-3 text-sm font-medium"
                >
                  {item.action}
                </a>
              ) : null}
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Políticas do hotel</h2>
          {policies.map((item) => (
            <div key={item.id} className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-base font-semibold text-slate-900">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}