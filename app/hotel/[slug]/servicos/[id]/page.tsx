import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Hotel, MapPin, Sparkles } from 'lucide-react';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { PublicAnalytics } from '@/components/public/public-analytics';
import { ServiceIcon } from '@/components/service-icon';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { normalizePublicLanguage, type SupportedPublicLanguage } from '@/lib/public-language';
import {
  canOpenInternalServiceDetail,
  MIN_SERVICE_DETAIL_CONTENT_LENGTH,
} from '@/lib/service-destinations';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

interface PageProps {
  params: Promise<{
    slug: string;
    id: string;
  }>;
  searchParams?: Promise<{
    lang?: string;
  }>;
}

type HotelRow = Database['public']['Tables']['hotels']['Row'];
type HotelSection = Database['public']['Tables']['hotel_sections']['Row'];
type HotelSectionTranslation =
  Database['public']['Tables']['hotel_section_translations']['Row'];

function buildHotelBackHref(slug: string, language: SupportedPublicLanguage) {
  return `/hotel/${slug}${language === 'pt' ? '' : `?lang=${language}`}#servicos`;
}

export default async function HotelServiceDetailPage({ params, searchParams }: PageProps) {
  const { slug, id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const lang: SupportedPublicLanguage = normalizePublicLanguage(resolvedSearchParams?.lang);
  const supabase = await createClient();

  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', slug)
    .single();

  if (hotelError || !hotel) {
    notFound();
  }

  const { data: section, error: sectionError } = await supabase
    .from('hotel_sections')
    .select('*')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .eq('enabled', true)
    .single();

  if (sectionError || !section) {
    notFound();
  }

  const typedHotel = hotel as HotelRow;
  const typedSection = section as HotelSection;

  const translationResult =
    lang === 'pt'
      ? { data: null, error: null }
      : await supabase
          .from('hotel_section_translations')
          .select('*')
          .eq('section_id', typedSection.id)
          .eq('language', lang)
          .maybeSingle();

  if (translationResult.error) {
    console.error('Failed to load service translation:', translationResult.error);
  }

  const translation = (translationResult.data || null) as HotelSectionTranslation | null;
  const displaySection: HotelSection = {
    ...typedSection,
    title: translation?.title ?? typedSection.title,
    content: translation?.content ?? typedSection.content,
    cta: translation?.cta ?? typedSection.cta,
    category: translation?.category ?? typedSection.category,
  };

  if (!canOpenInternalServiceDetail(displaySection)) {
    notFound();
  }

  const theme = resolveHotelTheme(typedHotel.theme_preset, typedHotel.theme_primary_color);
  const backHref = buildHotelBackHref(typedHotel.slug, lang);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_45%,#f8fafc_100%)]">
      <PublicAnalytics hotelId={typedHotel.id} hotelSlug={typedHotel.slug} language={lang} />

      <div
        className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8"
        style={theme.cssVars}
      >
        <section
          className={`relative overflow-hidden rounded-[40px] p-6 text-white shadow-[0_30px_90px_-48px_rgba(15,23,42,0.85)] ring-1 ring-slate-900/10 md:p-10 ${theme.heroClassName}`}
        >
          <div className={`pointer-events-none absolute inset-0 ${theme.heroOverlayClassName}`} />

          <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <a
                href={backHref}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-badge-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur transition hover:bg-white/15"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar aos serviços
              </a>

              <LanguageSwitcher
                slug={typedHotel.slug}
                currentLanguage={lang}
                basePath={`/hotel/${typedHotel.slug}/servicos/${typedSection.id}`}
              />
            </div>

            <div className="mt-7 flex items-start gap-4">
              <div className="rounded-[22px] border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <ServiceIcon iconName={displaySection.icon} className="h-6 w-6 text-[color:var(--hotel-badge-text)]" />
              </div>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--hotel-badge-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  GuestDesk
                </div>

                <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
                  {displaySection.title}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[color:var(--hotel-hero-muted)]">
                  {displaySection.category ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hotel-badge-border)] bg-[var(--hotel-badge-bg)] px-3 py-1 text-xs font-medium tracking-[0.14em] text-[color:var(--hotel-badge-text)]">
                      {displaySection.category}
                    </span>
                  ) : null}

                  <span className="inline-flex items-center gap-2">
                    <Hotel className="h-4 w-4" />
                    {typedHotel.name}
                  </span>

                  {typedHotel.city ? (
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {typedHotel.city}
                    </span>
                  ) : null}

                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Conteúdo interno detalhado
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[34px] bg-white p-6 shadow-[0_22px_60px_-38px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 md:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Detalhes do serviço
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Informações completas
            </h2>
            <p className="mt-4 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-8 text-slate-600 md:text-base">
              {displaySection.content}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={backHref}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </a>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-white/80 px-6 py-5 text-sm leading-6 text-slate-500 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.18)]">
          Esta página interna aparece apenas quando o serviço não tem link externo e possui pelo
          menos {MIN_SERVICE_DETAIL_CONTENT_LENGTH} caracteres de conteúdo útil para leitura.
        </section>
      </div>
    </main>
  );
}
