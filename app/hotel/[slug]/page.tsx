import Image from 'next/image';
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
import type { Database } from '@/types/database';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

type HotelRow = Database['public']['Tables']['hotels']['Row'];
type HotelSection = Database['public']['Tables']['hotel_sections']['Row'];
type HotelDepartment = Database['public']['Tables']['hotel_departments']['Row'];
type HotelPolicy = Database['public']['Tables']['hotel_policies']['Row'];

function SectionIcon({
  iconName,
  className,
}: {
  iconName?: string | null;
  className?: string;
}) {
  switch (iconName) {
    case 'Wifi':
      return <Wifi className={className} />;
    case 'Coffee':
      return <Coffee className={className} />;
    case 'Building2':
      return <Building2 className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'Phone':
      return <Phone className={className} />;
    case 'Hotel':
      return <Hotel className={className} />;
    case 'Info':
      return <Info className={className} />;
    case 'Globe':
    default:
      return <Globe className={className} />;
  }
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

function SectionCard({ item }: { item: HotelSection }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <SectionIcon iconName={item.icon} className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-slate-950">{item.title}</h3>

            {item.category ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {item.category}
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            {item.content || 'InformaÃ§Ã£o nÃ£o disponÃ­vel.'}
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

function DepartmentCard({ item }: { item: HotelDepartment }) {
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

function PolicyCard({ item }: { item: HotelPolicy }) {
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
          <ShieldCheck className="h-4 w-4" />
        </div>

        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-950">{item.title}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {item.description || 'PolÃ­tica do hotel.'}
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

  const typedHotel: HotelRow = hotel;
  const typedSections: HotelSection[] = sections || [];
  const typedDepartments: HotelDepartment[] = departments || [];
  const typedPolicies: HotelPolicy[] = policies || [];

  const whatsappHref = typedHotel.whatsapp_number
    ? `https://wa.me/${String(typedHotel.whatsapp_number).replace(/\D/g, '')}`
    : null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <section className="overflow-hidden rounded-[36px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_55%,#1e293b_100%)] p-6 text-white shadow-sm md:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                DiretÃ³rio digital
              </div>

              <div className="mt-6 flex items-start gap-4">
                {typedHotel.logo_url ? (
                  <Image
                    loader={() => typedHotel.logo_url || ''}
                    unoptimized
                    src={typedHotel.logo_url}
                    alt={typedHotel.name}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-[20px] bg-white object-cover p-1 shadow-sm"
                  />
                ) : (
                  <div className="rounded-[20px] bg-white/10 p-4">
                    <Hotel className="h-6 w-6" />
                  </div>
                )}

                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    {typedHotel.name}
                  </h1>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-200">
                    {typedHotel.city ? (
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {typedHotel.city}
                      </span>
                    ) : null}

                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      InformaÃ§Ãµes Ãºteis em um sÃ³ lugar
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                Acesse serviÃ§os, contatos, orientaÃ§Ãµes e links importantes do hotel com uma
                experiÃªncia mais rÃ¡pida, bonita e organizada.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              {typedHotel.booking_url ? (
                <a
                  href={typedHotel.booking_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
                >
                  Reservar agora
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              ) : (
                <div className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white/80">
                  Reservas indisponÃ­veis
                </div>
              )}

              {typedHotel.website_url ? (
                <a
                  href={typedHotel.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  Site oficial
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              ) : (
                <div className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/10 px-5 text-sm font-medium text-white/80">
                  Site indisponÃ­vel
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
            title="CafÃ© da manhÃ£"
            value={typedHotel.breakfast_hours || 'NÃ£o informado'}
            helper="HorÃ¡rio de serviÃ§o"
          />
          <QuickInfoCard
            icon={Wifi}
            title="Wi-Fi"
            value={typedHotel.wifi_name || 'NÃ£o informado'}
            helper={typedHotel.wifi_password ? `Senha: ${typedHotel.wifi_password}` : 'Consulte a recepÃ§Ã£o'}
          />
          <QuickInfoCard
            icon={Clock3}
            title="Check-in"
            value={typedHotel.checkin_time || 'NÃ£o informado'}
            helper="Entrada padrÃ£o"
          />
          <QuickInfoCard
            icon={Clock3}
            title="Check-out"
            value={typedHotel.checkout_time || 'NÃ£o informado'}
            helper="SaÃ­da padrÃ£o"
          />
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Explorar</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                ServiÃ§os e informaÃ§Ãµes
              </h2>
            </div>

            <div className="hidden rounded-full bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/70 md:inline-flex">
              {typedSections.length} itens disponÃ­veis
            </div>
          </div>

          {typedSections.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {typedSections.map((item) => (
                <SectionCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-base font-semibold text-slate-900">
                Nenhum serviÃ§o disponÃ­vel no momento
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                As informaÃ§Ãµes do diretÃ³rio serÃ£o atualizadas em breve.
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

            {typedDepartments.length ? (
              <div className="space-y-4">
                {typedDepartments.map((item) => (
                  <DepartmentCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
                <p className="text-base font-semibold text-slate-900">
                  Nenhum canal disponÃ­vel no momento
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Os contatos do hotel serÃ£o disponibilizados em breve.
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-4">
              <p className="text-sm text-slate-500">InformaÃ§Ãµes importantes</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                PolÃ­ticas do hotel
              </h2>
            </div>

            {typedPolicies.length ? (
              <div className="space-y-4">
                {typedPolicies.map((item) => (
                  <PolicyCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
                <p className="text-base font-semibold text-slate-900">
                  Nenhuma polÃ­tica publicada
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  As orientaÃ§Ãµes do hotel aparecerÃ£o aqui quando estiverem disponÃ­veis.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm text-slate-500">Links Ãºteis</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Acesso rÃ¡pido
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Utilize os canais oficiais do hotel para reservas, atendimento e informaÃ§Ãµes
                institucionais.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {typedHotel.website_url ? (
                <a
                  href={typedHotel.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Globe className="mr-2 h-4 w-4" />
                  Site oficial
                </a>
              ) : null}

              {typedHotel.booking_url ? (
                <a
                  href={typedHotel.booking_url}
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
