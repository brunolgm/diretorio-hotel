import { AdminEmptyState } from '@/components/admin/ui';
import { ExperienceHeader } from '@/components/admin/experience/experience-header';
import { ExperienceMetrics } from '@/components/admin/experience/experience-metrics';
import { EXPERIENCE_TABS, ExperienceTabs } from '@/components/admin/experience/experience-tabs';
import { HomeCompositionCard, type HomeCompositionItem } from '@/components/admin/experience/home-composition-card';
import { MainBannerPreview } from '@/components/admin/experience/main-banner-preview';
import { PublicExperiencePreview } from '@/components/admin/experience/public-experience-preview';
import { QuickTips } from '@/components/admin/experience/quick-tips';
import { requireAdminAccess } from '@/lib/auth';
import { hasHotelModule, requireHotelModule } from '@/lib/admin-entitlements';
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
  const previewEnabled = await hasHotelModule('experience.preview');
  if (params.tab === 'preview' && !previewEnabled) await requireHotelModule('experience.preview');
  const activeTab = EXPERIENCE_TABS.some(({ key }) => key === params.tab) ? params.tab! : 'visao-geral';
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
  const mainBanner = eligibleBanners[0] ?? null;
  const compositionItems: HomeCompositionItem[] = [
    { title: 'Saudação e Marca', description: 'Identidade e informações do hotel', href: '/admin/hotel', status: informationReady ? 'Ativo' : 'Sem conteúdo', icon: 'brand' },
    { title: 'Atalhos Principais', description: 'Serviços e acessos rápidos', href: '/admin/servicos', status: enabledServices + enabledDepartments > 0 ? 'Ativo' : 'Sem conteúdo', icon: 'shortcuts' },
    { title: 'Banner Promocional', description: 'Carrossel de destaques', href: '/admin/banners', status: eligibleBanners.length > 0 ? 'Ativo' : 'Sem conteúdo', icon: 'banner' },
    { title: 'Contato / Ajuda', description: 'Canais informados pelo hotel', href: '/admin/hotel', status: hotel.whatsapp_number || hotel.website_url || hotel.booking_url ? 'Ativo' : 'Sem conteúdo', icon: 'contact' },
  ];
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(now);
  const timeLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(now);

  return (
    <main className="min-w-0 space-y-4 font-sans">
      <ExperienceHeader hotelName={hotel.name} publicUrl={publicUrl} dateLabel={dateLabel} timeLabel={timeLabel} />
      <ExperienceMetrics status={statusCopy[hotel.platform_status]} lastUpdated={formatLastUpdate(latestUpdate, now)} languages={languages} publishedAreas={publishedAreas} totalAreas={6} featuredItems={eligibleBanners.length} />
      <ExperienceTabs activeTab={activeTab} previewEnabled={previewEnabled} />
      {activeTab === 'visao-geral' ? <><div className={previewEnabled ? "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(280px,30fr)_minmax(390px,43fr)_minmax(260px,27fr)]" : "grid min-w-0 gap-3 xl:grid-cols-2"}><HomeCompositionCard items={compositionItems} additionalCount={6} /><MainBannerPreview banner={mainBanner ? { title: mainBanner.title, subtitle: mainBanner.subtitle, imageUrl: mainBanner.image_url, ctaLabel: mainBanner.cta_label } : null} position={mainBanner ? 1 : 0} total={eligibleBanners.length} />{previewEnabled ? <PublicExperiencePreview publicUrl={publicUrl} hotelName={hotel.name} /> : null}</div><QuickTips /></> : activeTab === 'preview' ? <PublicExperiencePreview publicUrl={publicUrl} hotelName={hotel.name} /> : <section className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5"><AdminEmptyState title={`${EXPERIENCE_TABS.find(({ key }) => key === activeTab)?.label} em preparação`} description="Esta área já ocupa seu lugar na arquitetura, mas ainda não possui controles ou persistência. Nenhuma configuração fictícia foi adicionada." /></section>}
    </main>
  );
}
