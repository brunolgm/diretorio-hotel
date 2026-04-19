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
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    lang?: string;
  }>;
}

type SupportedLanguage = 'pt' | 'en' | 'es';
type HotelRow = Database['public']['Tables']['hotels']['Row'];
type HotelSection = Database['public']['Tables']['hotel_sections']['Row'];
type HotelDepartment = Database['public']['Tables']['hotel_departments']['Row'];
type HotelPolicy = Database['public']['Tables']['hotel_policies']['Row'];
type HotelSectionTranslation =
  Database['public']['Tables']['hotel_section_translations']['Row'];
type HotelDepartmentTranslation =
  Database['public']['Tables']['hotel_department_translations']['Row'];
type HotelPolicyTranslation = Database['public']['Tables']['hotel_policy_translations']['Row'];

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
            {item.description || 'Política do hotel.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function HotelPublicPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedLang = resolvedSearchParams?.lang;
  const lang: SupportedLanguage =
    requestedLang === 'en' || requestedLang === 'es' ? requestedLang : 'pt';
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

  const [sectionTranslationsResult, departmentTranslationsResult, policyTranslationsResult] =
    lang === 'pt'
      ? [{ data: [] }, { data: [] }, { data: [] }]
      : await Promise.all([
          typedSections.length
            ? supabase
                .from('hotel_section_translations')
                .select('*')
                .in(
                  'section_id',
                  typedSections.map((item) => item.id)
                )
                .eq('language', lang)
            : Promise.resolve({ data: [], error: null }),
          typedDepartments.length
            ? supabase
                .from('hotel_department_translations')
                .select('*')
                .in(
                  'department_id',
                  typedDepartments.map((item) => item.id)
                )
                .eq('language', lang)
            : Promise.resolve({ data: [], error: null }),
          typedPolicies.length
            ? supabase
                .from('hotel_policy_translations')
                .select('*')
                .in(
                  'policy_id',
                  typedPolicies.map((item) => item.id)
                )
                .eq('language', lang)
            : Promise.resolve({ data: [], error: null }),
        ]);

  if (lang !== 'pt') {
    if (sectionTranslationsResult.error) {
      console.error('Failed to load section translations:', sectionTranslationsResult.error);
    }
    if (departmentTranslationsResult.error) {
      console.error(
        'Failed to load department translations:',
        departmentTranslationsResult.error
      );
    }
    if (policyTranslationsResult.error) {
      console.error('Failed to load policy translations:', policyTranslationsResult.error);
    }
  }

  const sectionTranslations = (sectionTranslationsResult.data || []) as HotelSectionTranslation[];
  const departmentTranslations = (departmentTranslationsResult.data ||
    []) as HotelDepartmentTranslation[];
  const policyTranslations = (policyTranslationsResult.data || []) as HotelPolicyTranslation[];

  const sectionTranslationsById = new Map(
    sectionTranslations.map((translation) => [translation.section_id, translation])
  );
  const departmentTranslationsById = new Map(
    departmentTranslations.map((translation) => [translation.department_id, translation])
  );
  const policyTranslationsById = new Map(
    policyTranslations.map((translation) => [translation.policy_id, translation])
  );

  const displaySections = typedSections.map((item) => {
    const translation = sectionTranslationsById.get(item.id);

    return {
      ...item,
      title: translation?.title ?? item.title,
      content: translation?.content ?? item.content,
      cta: translation?.cta ?? item.cta,
      category: translation?.category ?? item.category,
    };
  });

  const displayDepartments = typedDepartments.map((item) => {
    const translation = departmentTranslationsById.get(item.id);

    return {
      ...item,
      name: translation?.name ?? item.name,
      description: translation?.description ?? item.description,
      action: translation?.action ?? item.action,
    };
  });

  const displayPolicies = typedPolicies.map((item) => {
    const translation = policyTranslationsById.get(item.id);

    return {
      ...item,
      title: translation?.title ?? item.title,
      description: translation?.description ?? item.description,
    };
  });

  const whatsappHref = typedHotel.whatsapp_number
    ? `https://wa.me/${String(typedHotel.whatsapp_number).replace(/\D/g, '')}`
    : null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <section className="overflow-hidden rounded-[36px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_55%,#1e293b_100%)] p-6 text-white shadow-sm md:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-start justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  Diretório digital
                </div>

                <div className="shrink-0">
                  <LanguageSwitcher slug={typedHotel.slug} currentLanguage={lang} />
                </div>
              </div>

              <div className="mt-6 flex items-start gap-4">
                {typedHotel.logo_url ? (
                  <img
                    src={typedHotel.logo_url}
                    alt={typedHotel.name}
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
                  Reservas indisponíveis
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
            value={typedHotel.breakfast_hours || 'Não informado'}
            helper="Horário de serviço"
          />
          <QuickInfoCard
            icon={Wifi}
            title="Wi-Fi"
            value={typedHotel.wifi_name || 'Não informado'}
            helper={typedHotel.wifi_password ? `Senha: ${typedHotel.wifi_password}` : 'Consulte a recepção'}
          />
          <QuickInfoCard
            icon={Clock3}
            title="Check-in"
            value={typedHotel.checkin_time || 'Não informado'}
            helper="Entrada padrão"
          />
          <QuickInfoCard
            icon={Clock3}
            title="Check-out"
            value={typedHotel.checkout_time || 'Não informado'}
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
              {displaySections.length} itens disponíveis
            </div>
          </div>

          {displaySections.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {displaySections.map((item) => (
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

            {displayDepartments.length ? (
              <div className="space-y-4">
                {displayDepartments.map((item) => (
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

            {displayPolicies.length ? (
              <div className="space-y-4">
                {displayPolicies.map((item) => (
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
