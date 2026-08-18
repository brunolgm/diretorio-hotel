import Link from 'next/link';
import { ExperienceHeader } from '@/components/admin/experience/experience-header';
import { ExperienceMetrics } from '@/components/admin/experience/experience-metrics';
import { EXPERIENCE_TABS, ExperienceTabs } from '@/components/admin/experience/experience-tabs';
import { HomeCompositionCard } from '@/components/admin/experience/home-composition-card';
import { PublicExperiencePreview } from '@/components/admin/experience/public-experience-preview';
import { requireAdminAccess } from '@/lib/auth';
import { getCurrentHotelEntitlements, requireHotelModule } from '@/lib/admin-entitlements';
import { hasMinimumRole } from '@/lib/app-roles';
import { getCurrentHotelExperienceLayout } from '@/lib/experience-layout-queries';
import { getAdminHotel } from '@/lib/queries';
import { hasPassedReadinessChecks } from '@/lib/hotel-readiness';
import { getCurrentHotelReadiness } from '@/lib/readiness-queries';
import { createClient } from '@/lib/supabase/server';

interface ExperiencePageProps { searchParams?: Promise<{ tab?: string }> }

const statusCopy = {
  active: { label: 'Ativa', description: 'Visível para os hóspedes', active: true },
  draft: { label: 'Em preparação', description: 'Experiência pública indisponível', active: false },
  suspended: { label: 'Suspensa', description: 'Experiência pública indisponível', active: false },
  archived: { label: 'Arquivada', description: 'Contexto operacional encerrado', active: false },
} as const;

function isEligible(item: { is_active: boolean; starts_at: string | null; ends_at: string | null }, now: number) {
  return item.is_active && (!item.starts_at || new Date(item.starts_at).getTime() <= now) && (!item.ends_at || new Date(item.ends_at).getTime() >= now);
}

function formatLastUpdate(value: string | null, now: Date) {
  if (!value) return 'Não registrada';
  const updated = new Date(value);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  if (day.format(updated) === day.format(now)) return `Hoje, ${time.format(updated)}`;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(updated);
}

export default async function AdminExperiencePage({ searchParams }: ExperiencePageProps) {
  const { profile } = await requireAdminAccess('visualizador');
  const params = searchParams ? await searchParams : {};
  const enabledModules = await getCurrentHotelEntitlements();
  const previewEnabled = enabledModules.has('experience.preview');
  const compositionEnabled = enabledModules.has('experience.navigation');
  const appearanceEnabled = enabledModules.has('experience.appearance');
  if (params.tab === 'preview' && !previewEnabled) await requireHotelModule('experience.preview');
  if ((!params.tab || params.tab === 'composicao') && !compositionEnabled) await requireHotelModule('experience.navigation');
  if (params.tab === 'aparencia' && !appearanceEnabled) await requireHotelModule('experience.appearance');
  const activeTab = EXPERIENCE_TABS.some(({ key }) => key === params.tab) ? params.tab! : 'composicao';
  const layout = compositionEnabled ? await getCurrentHotelExperienceLayout() : [];
  const hotel = await getAdminHotel();
  const supabase = await createClient();
  const [readiness, services, departments, policies, announcements, banners] = await Promise.all([
    getCurrentHotelReadiness(),
    supabase.from('hotel_sections').select('id, enabled, updated_at').eq('hotel_id', profile.hotel_id),
    supabase.from('hotel_departments').select('id, enabled, updated_at').eq('hotel_id', profile.hotel_id),
    supabase.from('hotel_policies').select('id, enabled, updated_at').eq('hotel_id', profile.hotel_id),
    supabase.from('hotel_announcements').select('id, is_active, starts_at, ends_at, updated_at').eq('hotel_id', profile.hotel_id),
    supabase.from('hotel_promotional_banners').select('id, title, subtitle, image_url, cta_label, is_active, starts_at, ends_at, display_order, updated_at').eq('hotel_id', profile.hotel_id).order('display_order', { ascending: true }),
  ]);
  const sources = [services, departments, policies, announcements, banners];
  if (sources.some(({ error }) => error)) throw new Error('Não foi possível carregar a experiência pública.');

  const sectionIds = (services.data ?? []).map(({ id }) => id);
  const departmentIds = (departments.data ?? []).map(({ id }) => id);
  const policyIds = (policies.data ?? []).map(({ id }) => id);
  const announcementIds = (announcements.data ?? []).map(({ id }) => id);
  const bannerIds = (banners.data ?? []).map(({ id }) => id);
  const [sectionTranslations, departmentTranslations, policyTranslations, announcementTranslations, bannerTranslations] = await Promise.all([
    sectionIds.length ? supabase.from('hotel_section_translations').select('language').in('section_id', sectionIds) : Promise.resolve({ data: [], error: null }),
    departmentIds.length ? supabase.from('hotel_department_translations').select('language').in('department_id', departmentIds) : Promise.resolve({ data: [], error: null }),
    policyIds.length ? supabase.from('hotel_policy_translations').select('language').in('policy_id', policyIds) : Promise.resolve({ data: [], error: null }),
    announcementIds.length ? supabase.from('hotel_announcement_translations').select('language').in('announcement_id', announcementIds) : Promise.resolve({ data: [], error: null }),
    bannerIds.length ? supabase.from('hotel_promotional_banner_translations').select('language').in('banner_id', bannerIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const translationResults = [sectionTranslations, departmentTranslations, policyTranslations, announcementTranslations, bannerTranslations];
  if (translationResults.some(({ error }) => error)) throw new Error('Não foi possível carregar os idiomas da experiência.');

  const now = new Date();
  const nowValue = now.getTime();
  const enabledServices = (services.data ?? []).filter(({ enabled }) => enabled).length;
  const enabledDepartments = (departments.data ?? []).filter(({ enabled }) => enabled).length;
  const enabledPolicies = (policies.data ?? []).filter(({ enabled }) => enabled).length;
  const eligibleAnnouncements = (announcements.data ?? []).filter((item) => isEligible(item, nowValue)).length;
  const eligibleBanners = (banners.data ?? []).filter((item) => isEligible(item, nowValue));
  const informationReady = hasPassedReadinessChecks(readiness, [
    'identity.name', 'identity.city', 'operation.checkin', 'operation.checkout', 'contact.primary',
  ]);
  const publishedAreas = [informationReady, enabledServices > 0, enabledDepartments > 0, enabledPolicies > 0, eligibleAnnouncements > 0, eligibleBanners.length > 0].filter(Boolean).length;
  const languageRows = translationResults.flatMap(({ data }) => data ?? []);
  const languages = ['PT', ...(languageRows.some(({ language }) => language === 'en') ? ['EN'] : []), ...(languageRows.some(({ language }) => language === 'es') ? ['ES'] : [])];
  const timestamps = [hotel.updated_at, ...sources.flatMap(({ data }) => (data ?? []).map(({ updated_at }) => updated_at))].filter((value): value is string => Boolean(value));
  const latestUpdate = timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const publicUrl = `/hotel/${encodeURIComponent(hotel.slug)}`;
  const previewVersion = layout.map((block) => `${block.blockKey}:${block.position}:${block.isEnabled}`).join('|');
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(now);
  const timeLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(now);

  return (
    <main className="min-w-0 space-y-4 font-sans">
      <ExperienceHeader hotelName={hotel.name} publicUrl={publicUrl} dateLabel={dateLabel} timeLabel={timeLabel} />
      <ExperienceMetrics status={statusCopy[hotel.platform_status]} lastUpdated={formatLastUpdate(latestUpdate, now)} languages={languages} publishedAreas={publishedAreas} totalAreas={6} featuredItems={eligibleBanners.length} />
      <ExperienceTabs activeTab={activeTab} previewEnabled={previewEnabled} />
      {activeTab === 'composicao' ? <div className={previewEnabled ? "grid min-w-0 gap-4 xl:grid-cols-[minmax(340px,1fr)_minmax(430px,1.15fr)]" : "min-w-0"}><HomeCompositionCard layout={layout} enabledModules={enabledModules} canEdit={hasMinimumRole(profile.normalizedRole,'editor')} />{previewEnabled ? <PublicExperiencePreview publicUrl={publicUrl} hotelName={hotel.name} previewVersion={previewVersion} /> : null}</div> : activeTab === 'preview' ? <PublicExperiencePreview publicUrl={publicUrl} hotelName={hotel.name} previewVersion={previewVersion} /> : <section className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"><h2 className="text-base font-bold text-[var(--admin-text-strong)]">Aparência</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">A composição não altera a bandeira ou o tema. Continue usando os controles já existentes de identidade e mídia do hotel.</p><Link href="/admin/hotel" className="mt-4 inline-flex rounded-xl bg-[var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white">Abrir aparência do hotel</Link></section>}
    </main>
  );
}
