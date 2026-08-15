import Link from 'next/link';
import { ArrowRight, Languages } from 'lucide-react';
import { AdminBreadcrumbs, AdminLanguageBadge, AdminPageHero, AdminSectionTitle, AdminStatCard, AdminSurface } from '@/components/admin/ui';
import { requireAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const contentAreas = [
  { label: 'Serviços', href: '/admin/servicos' },
  { label: 'Departamentos', href: '/admin/departamentos' },
  { label: 'Políticas', href: '/admin/politicas' },
  { label: 'Anúncios', href: '/admin/comunicados' },
  { label: 'Banners', href: '/admin/banners' },
] as const;

export default async function AdminLanguagesPage() {
  const { profile } = await requireAdminAccess('visualizador');
  const supabase = await createClient();
  const [sections, departments, policies, announcements, banners] = await Promise.all([
    supabase.from('hotel_sections').select('id').eq('hotel_id', profile.hotel_id),
    supabase.from('hotel_departments').select('id').eq('hotel_id', profile.hotel_id),
    supabase.from('hotel_policies').select('id').eq('hotel_id', profile.hotel_id),
    supabase.from('hotel_announcements').select('id').eq('hotel_id', profile.hotel_id),
    supabase.from('hotel_promotional_banners').select('id').eq('hotel_id', profile.hotel_id),
  ]);
  const sources = [sections, departments, policies, announcements, banners];
  if (sources.some((result) => result.error)) throw new Error('Não foi possível carregar o status de idiomas.');

  const sectionIds = (sections.data ?? []).map(({ id }) => id);
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
  const translations = [sectionTranslations, departmentTranslations, policyTranslations, announcementTranslations, bannerTranslations];
  if (translations.some((result) => result.error)) throw new Error('Não foi possível carregar o status de traduções.');

  const sourceCount = sources.reduce((total, result) => total + (result.data?.length ?? 0), 0);
  const translatedRows = translations.flatMap((result) => result.data ?? []);
  const englishCount = translatedRows.filter(({ language }) => language === 'en').length;
  const spanishCount = translatedRows.filter(({ language }) => language === 'es').length;
  const completion = (count: number) => sourceCount === 0 ? 'Sem conteúdo' : `${count}/${sourceCount}`;

  return (
    <main className="space-y-6">
      <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Idiomas' }]} />
      <AdminPageHero eyebrow="Gestão" title="Idiomas" description="Status real das traduções ligadas aos conteúdos atuais do hotel." />
      <section className="grid gap-4 md:grid-cols-3">
        <AdminStatCard icon={<Languages className="h-5 w-5" />} title="Português" value={String(sourceCount)} description="Conteúdos fonte cadastrados" />
        <AdminStatCard icon={<Languages className="h-5 w-5" />} title="Inglês" value={completion(englishCount)} description="Registros de tradução disponíveis" />
        <AdminStatCard icon={<Languages className="h-5 w-5" />} title="Espanhol" value={completion(spanishCount)} description="Registros de tradução disponíveis" />
      </section>
      <AdminSurface>
        <AdminSectionTitle title="Fluxo atual" description="Português é a fonte; EN e ES são gerados ao salvar e usam PT como fallback quando ausentes." />
        <div className="mt-5 flex flex-wrap gap-2">
          <AdminLanguageBadge label="PT" available source />
          <AdminLanguageBadge label="EN" available={englishCount === sourceCount && sourceCount > 0} />
          <AdminLanguageBadge label="ES" available={spanishCount === sourceCount && sourceCount > 0} />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contentAreas.map((area) => (
            <Link key={area.href} href={area.href} className="flex items-center justify-between rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-4 text-sm font-medium text-[var(--admin-text)] transition hover:border-[var(--admin-focus)]">
              {area.label}<ArrowRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </AdminSurface>
    </main>
  );
}
