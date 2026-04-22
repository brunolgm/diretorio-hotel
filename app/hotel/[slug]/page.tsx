import { notFound } from 'next/navigation';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Globe,
  Hotel,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { PublicAnalytics } from '@/components/public/public-analytics';
import { ServiceIcon } from '@/components/service-icon';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { normalizePublicLanguage, type SupportedPublicLanguage } from '@/lib/public-language';
import { getServiceDestination } from '@/lib/service-destinations';
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
  return <ServiceIcon iconName={iconName} className={className} />;
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
    <div className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-base font-semibold tracking-tight text-slate-950">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>

        <div className="rounded-[20px] border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] p-3 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  item,
  hotelSlug,
  language,
}: {
  item: HotelSection;
  hotelSlug: string;
  language: SupportedPublicLanguage;
}) {
  const destination = getServiceDestination(item, hotelSlug, language);

  return (
    <div className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-[0_26px_55px_-36px_rgba(15,23,42,0.32)]">
      <div className="flex items-start gap-4">
        <div className="rounded-[20px] border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] p-3 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <SectionIcon iconName={item.icon} className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-lg font-semibold tracking-tight text-slate-950">
              {item.title}
            </h3>

            {item.category ? (
              <span className="rounded-full border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] px-3 py-1 text-xs font-medium text-slate-700">
                {item.category}
              </span>
            ) : null}
          </div>

          <p className="mt-3 line-clamp-4 break-words [overflow-wrap:anywhere] text-sm leading-7 text-slate-600">
            {item.content || 'Informação não disponível.'}
          </p>

          {destination ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                {destination.isExternal ? 'Destino externo' : 'Detalhe interno'}
              </p>
              {destination.isExternal ? (
              <a
                href={destination.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--hotel-accent)] px-4 text-center text-sm font-medium text-[color:var(--hotel-accent-foreground)] shadow-[0_14px_30px_-18px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:brightness-95"
              >
                {item.cta || 'Abrir site'}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
              ) : (
                <a
                  href={destination.href}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-[var(--hotel-accent)] px-4 text-center text-sm font-medium text-[color:var(--hotel-accent-foreground)] shadow-[0_14px_30px_-18px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:brightness-95"
                >
                  {item.cta || 'Ver serviço'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </a>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DepartmentCard({ item }: { item: HotelDepartment }) {
  return (
    <div className="rounded-[30px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-[0_26px_55px_-36px_rgba(15,23,42,0.32)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold tracking-tight text-slate-950">
            {item.name}
          </h3>
          <p className="mt-2 break-words text-sm leading-7 text-slate-600">
            {item.description || 'Canal de atendimento do hotel.'}
          </p>

          {item.hours ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              <Clock3 className="h-3.5 w-3.5" />
              {item.hours}
            </div>
          ) : null}
        </div>

        <div className="rounded-[20px] border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] p-3 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <Phone className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            data-analytics-event="department_click"
            data-analytics-department-id={item.id}
            data-analytics-target-url={item.url}
            data-analytics-label={item.name}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] px-4 text-center text-sm font-medium text-slate-800 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:bg-[var(--hotel-accent-soft-strong)]"
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
    <div className="rounded-[26px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/80">
      <div className="flex items-start gap-3">
        <div className="rounded-[18px] border border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent-soft)] p-2.5 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <ShieldCheck className="h-4 w-4" />
        </div>

        <div>
          <h3 className="break-words text-base font-semibold tracking-tight text-slate-950">
            {item.title}
          </h3>
          <p className="mt-2 break-words text-sm leading-7 text-slate-600">
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
  const lang: SupportedPublicLanguage = normalizePublicLanguage(requestedLang);
  const supabase = await createClient();

  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', slug)
    .single();

  if (hotelError || !hotel) {
    notFound();
  }

  const [
    { data: sections, error: sectionsError },
    { data: departments, error: departmentsError },
    { data: policies, error: policiesError },
  ] = await Promise.all([
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

  if (sectionsError) {
    console.error('Failed to load hotel sections:', sectionsError);
  }

  if (departmentsError) {
    console.error('Failed to load hotel departments:', departmentsError);
  }

  if (policiesError) {
    console.error('Failed to load hotel policies:', policiesError);
  }

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
  const theme = resolveHotelTheme(typedHotel.theme_preset, typedHotel.theme_primary_color);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#f8fafc_100%)]">
      <PublicAnalytics hotelId={typedHotel.id} hotelSlug={typedHotel.slug} language={lang} />

      <div className="mx-auto max-w-6xl px-4 py-6 pb-28 md:px-6 md:py-8 md:pb-8" style={theme.cssVars}>
        <section
          className={`relative overflow-hidden rounded-[40px] p-6 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.85)] ring-1 ring-slate-900/10 md:p-10 ${theme.heroClassName}`}
        >
          <div className={`pointer-events-none absolute inset-0 ${theme.heroOverlayClassName}`} />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-start justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-badge-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  GuestDesk
                </div>

                <div className="shrink-0">
                  <LanguageSwitcher slug={typedHotel.slug} currentLanguage={lang} />
                </div>
              </div>

              <div className="mt-7 flex items-start gap-4">
                {typedHotel.logo_url ? (
                  <img
                    src={typedHotel.logo_url}
                    alt={typedHotel.name}
                    className="h-16 w-16 rounded-[22px] bg-white object-cover p-1 shadow-[0_16px_32px_-22px_rgba(15,23,42,0.55)]"
                  />
                ) : (
                  <div className="rounded-[22px] border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <Hotel className="h-6 w-6 text-[color:var(--hotel-badge-text)]" />
                  </div>
                )}

                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    {typedHotel.name}
                  </h1>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[color:var(--hotel-hero-muted)]">
                    {typedHotel.city ? (
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {typedHotel.city}
                      </span>
                    ) : null}

                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Informações essenciais em um só lugar
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-7 max-w-2xl text-sm leading-7 text-[color:var(--hotel-hero-muted)] md:text-base">
                Acesse serviços, contatos, orientações e links importantes do hotel em uma
                experiência digital mais elegante, prática e organizada.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
              {typedHotel.booking_url ? (
                <a
                  href={typedHotel.booking_url}
                  target="_blank"
                  rel="noreferrer"
                  data-analytics-event="booking_click"
                  data-analytics-target-url={typedHotel.booking_url}
                  data-analytics-label="Hero booking button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--hotel-accent)] px-5 text-sm font-semibold text-[color:var(--hotel-accent-foreground)] shadow-[0_18px_35px_-18px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/55 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Reservar agora
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              ) : (
                <div className="inline-flex h-12 items-center justify-center rounded-2xl border border-[color:var(--hotel-hero-secondary-border)] bg-[var(--hotel-hero-disabled-bg)] px-5 text-sm font-medium text-[color:var(--hotel-hero-disabled-text)]">
                  Reservas indisponíveis
                </div>
              )}

              {typedHotel.website_url ? (
                <a
                  href={typedHotel.website_url}
                  target="_blank"
                  rel="noreferrer"
                  data-analytics-event="website_click"
                  data-analytics-target-url={typedHotel.website_url}
                  data-analytics-label="Hero website button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[color:var(--hotel-hero-secondary-border)] bg-[var(--hotel-hero-secondary-bg)] px-5 text-sm font-medium text-[color:var(--hotel-hero-secondary-text)] transition hover:-translate-y-0.5 hover:bg-[var(--hotel-hero-secondary-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Site oficial
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              ) : (
                <div className="inline-flex h-12 items-center justify-center rounded-2xl border border-[color:var(--hotel-hero-secondary-border)] bg-[var(--hotel-hero-disabled-bg)] px-5 text-sm font-medium text-[color:var(--hotel-hero-disabled-text)]">
                  Site indisponível
                </div>
              )}

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  data-analytics-event="whatsapp_click"
                  data-analytics-target-url={whatsappHref}
                  data-analytics-label="Hero WhatsApp button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-[color:var(--hotel-hero-secondary-border)] bg-[var(--hotel-hero-secondary-bg)] px-5 text-sm font-medium text-[color:var(--hotel-hero-secondary-text)] transition hover:-translate-y-0.5 hover:bg-[var(--hotel-hero-secondary-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:col-span-2"
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
            helper={
              typedHotel.wifi_password
                ? `Senha: ${typedHotel.wifi_password}`
                : 'Consulte a recepção'
            }
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

        <section className="mt-8" id="servicos">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-section-label)]">
                Explorar
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Serviços e informações
              </h2>
            </div>

            <div className="hidden rounded-full bg-[var(--hotel-accent-soft)] px-4 py-2 text-xs font-medium text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.22)] ring-1 ring-[color:var(--hotel-accent-border)] md:inline-flex">
              {displaySections.length} itens disponíveis
            </div>
          </div>

          {displaySections.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {displaySections.map((item) => (
                <SectionCard
                  key={item.id}
                  item={item}
                  hotelSlug={typedHotel.slug}
                  language={lang}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[30px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-[0_18px_45px_-36px_rgba(15,23,42,0.22)]">
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
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-section-label)]">
                Atendimento
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
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
              <div className="rounded-[30px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-[0_18px_45px_-36px_rgba(15,23,42,0.22)]">
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
            <div className="mb-5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-section-label)]">
                Informações importantes
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
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
              <div className="rounded-[30px] border border-dashed border-slate-200 bg-white p-10 text-center shadow-[0_18px_45px_-36px_rgba(15,23,42,0.22)]">
                <p className="text-base font-semibold text-slate-900">Nenhuma política publicada</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  As orientações do hotel aparecerão aqui quando estiverem disponíveis.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 rounded-[34px] border border-[color:var(--hotel-footer-border)] bg-[var(--hotel-footer-bg)] p-6 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.28)] md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-section-label)]">
                Links úteis
              </p>
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
                  data-analytics-event="website_click"
                  data-analytics-target-url={typedHotel.website_url}
                  data-analytics-label="Footer website button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-50"
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
                  data-analytics-event="booking_click"
                  data-analytics-target-url={typedHotel.booking_url}
                  data-analytics-label="Footer booking button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-50"
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
                  data-analytics-event="whatsapp_click"
                  data-analytics-target-url={whatsappHref}
                  data-analytics-label="Footer WhatsApp button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[var(--hotel-accent)] px-5 text-sm font-medium text-[color:var(--hotel-accent-foreground)] shadow-[0_12px_28px_-20px_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-[30px] border border-[color:var(--hotel-footer-border)] bg-[var(--hotel-footer-bg)] px-6 py-5 text-sm shadow-[0_18px_45px_-36px_rgba(15,23,42,0.22)] backdrop-blur md:mt-8">
          <div className="flex justify-center md:justify-end">
            <p className="font-medium tracking-[0.01em] text-[color:var(--hotel-footer-text)]">
              GuestDesk by BLID Tecnologia
            </p>
          </div>
        </section>
      </div>

      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          data-analytics-event="whatsapp_click"
          data-analytics-target-url={whatsappHref}
          data-analytics-label="Floating WhatsApp button"
          className="fixed bottom-5 right-5 z-50 inline-flex h-14 items-center justify-center rounded-full bg-[var(--hotel-accent)] px-5 text-sm font-medium text-[color:var(--hotel-accent-foreground)] shadow-[0_18px_40px_-22px_rgba(15,23,42,0.55)] transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
        >
          <MessageCircle className="mr-2 h-5 w-5" />
          WhatsApp
        </a>
      ) : null}
    </main>
  );
}
