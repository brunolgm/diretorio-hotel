import { notFound } from 'next/navigation';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Globe,
  Hotel,
  Info,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

const iconMap = {
  Globe,
  Wifi,
  Coffee,
  Building2,
  ShieldCheck,
  Phone,
  Hotel,
  Info,
};

function getIcon(iconName?: string) {
  if (!iconName) return Globe;
  return iconMap[iconName as keyof typeof iconMap] || Globe;
}

function QuickInfoCard({
  icon: Icon,
  title,
  value,
  helper,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-base font-semibold tracking-tight text-slate-950">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>

        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ item }: { item: any }) {
  const Icon = getIcon(item.icon);

  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">
              {item.title}
            </h3>

            {item.category ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {item.category}
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            {item.content || 'Informação não disponível.'}
          </p>

          <div className="mt-4">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {item.cta || 'Acessar'}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            ) : (
              <div className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-100 px-4 text-sm font-medium text-slate-700">
                {item.cta || 'Consultar'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DepartmentCard({ item }: { item: any }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">{item.name}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {item.description || 'Canal de atendimento do hotel.'}
          </p>

          {item.hours ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <Clock3 className="h-3.5 w-3.5" />
              {item.hours}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Phone className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {item.action || `Falar com ${item.name}`}
            <ChevronRight className="ml-2 h-4 w-4" />
          </a>
        ) : (
          <div className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-500">
            {item.action || `Contato com ${item.name}`}
          </div>
        )}
      </div>
    </div>
  );
}

function PolicyCard({ item }: { item: any }) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
          <ShieldCheck className="h-4 w-4" />
        </div>

        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-950">{item.title}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {item.description || 'Política do hotel.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function HotelPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', slug)
    .single();

  if (hotelError || !hotel) {
    notFound();
  }

  const [{ data: sections }, { data: departments }, { data: policies }] = await Promise.all([
    supabase
      .from('hotel_sections')
      .select('*')
      .eq('hotel_id', hotel.id)
      .eq('enabled', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('hotel_departments')
      .select('*')
      .eq('hotel_id', hotel.id)
      .eq('enabled', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('hotel_policies')
      .select('*')
      .eq('hotel_id', hotel.id)
      .eq('enabled', true)
      .order('created_at', { ascending: true }),
  ]);

  const whatsappHref = hotel.whatsapp_number
    ? `https://wa.me/${String(hotel.whatsapp_number).replace(/\D/g, '')}`
    : null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <section className="overflow-hidden rounded-[36px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_55%,#1e293b_100%)] p-6 text-white shadow-sm md:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Diretório digital
              </div>

              <div className="mt-6 flex items-start gap-4">
                {hotel.logo_url ? (
                  <img
                    src={hotel.logo_url}
                    alt={hotel.name}
                    className="h-16 w-16 rounded-[20px] bg-white object-cover p-1 shadow-sm"
                  />
                ) : (
                  <div className="rounded-[20px] bg-white/10 p-4">
                    <Hotel className="h-6 w-6" />
                  </div>
                )}

                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    {hotel.name}
                  </h1>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-200">
                    {hotel.city ? (
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {hotel.city}
                      </span>
                    ) : null}

                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Informações úteis em um só lugar
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                Acesse serviços, contatos, orientações e links importantes do hotel com uma
                experiência mais rápida, bonita e organizada.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              {hotel.booking_url ? (
                <a
                  href={hotel.booking_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
                >
                  Reservar agora
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              ) : (
                <div className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white/80">
                  Reservas indisponíveis
                </div>
              )}

              {hotel.website_url ? (
                <a
                  href={hotel.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Site oficial
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              ) : (
                <div className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white/80">
                  Site indisponível
                </div>
              )}

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/20 sm:col-span-2"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Atendimento via WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QuickInfoCard
            icon={Coffee}
            title="Café da manhã"
            value={hotel.breakfast_hours || 'Não informado'}
            helper="Horário de serviço"
          />
          <QuickInfoCard
            icon={Wifi}
            title="Wi-Fi"
            value={hotel.wifi_name || 'Não informado'}
            helper={hotel.wifi_password ? `Senha: ${hotel.wifi_password}` : 'Consulte a recepção'}
          />
          <QuickInfoCard
            icon={Clock3}
            title="Check-in"
            value={hotel.checkin_time || 'Não informado'}
            helper="Entrada padrão"
          />
          <QuickInfoCard
            icon={Clock3}
            title="Check-out"
            value={hotel.checkout_time || 'Não informado'}
            helper="Saída padrão"
          />
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Explorar</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Serviços e informações
              </h2>
            </div>

            <div className="hidden rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/70 md:inline-flex">
              {sections?.length || 0} itens disponíveis
            </div>
          </div>

          {sections?.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {sections.map((item) => (
                <SectionCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-base font-semibold text-slate-900">
                Nenhum serviço disponível no momento
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                As informações do diretório serão atualizadas em breve.
              </p>
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-[1fr,1fr]">
          <div>
            <div className="mb-4">
              <p className="text-sm text-slate-500">Atendimento</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Fale com o hotel
              </h2>
            </div>

            {departments?.length ? (
              <div className="space-y-4">
                {departments.map((item) => (
                  <DepartmentCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
                <p className="text-base font-semibold text-slate-900">
                  Nenhum canal disponível no momento
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Os contatos do hotel serão disponibilizados em breve.
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-4">
              <p className="text-sm text-slate-500">Informações importantes</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Políticas do hotel
              </h2>
            </div>

            {policies?.length ? (
              <div className="space-y-4">
                {policies.map((item) => (
                  <PolicyCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
                <p className="text-base font-semibold text-slate-900">
                  Nenhuma política publicada
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  As orientações do hotel aparecerão aqui quando estiverem disponíveis.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm text-slate-500">Links úteis</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Acesso rápido
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Utilize os canais oficiais do hotel para reservas, atendimento e informações
                institucionais.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {hotel.website_url ? (
                <a
                  href={hotel.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Globe className="mr-2 h-4 w-4" />
                  Site oficial
                </a>
              ) : null}

              {hotel.booking_url ? (
                <a
                  href={hotel.booking_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Reservas
                </a>
              ) : null}

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-5 right-5 z-50 inline-flex h-14 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white shadow-lg transition hover:bg-slate-800"
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          WhatsApp
        </a>
      ) : null}
    </main>
  );
}