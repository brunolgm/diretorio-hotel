import { notFound } from 'next/navigation';
import { hasMinimumRole, requireAdminAccess } from '@/lib/auth';
import { hasHotelModule, requireHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/security/identifiers';
import { TOURISM_FIELD_LABELS } from '@/lib/tourism/admin';
import { TOURISM_CATEGORIES, TOURISM_TYPES } from '@/lib/tourism/catalog';
import { getTourismTranslationStatus, TOURISM_TRANSLATION_STATUS_LABELS } from '@/lib/tourism/translations';
import { AdminBreadcrumbs, AdminInfoBadge, AdminLanguageBadge, AdminPageHero, AdminStatusPill, AdminSurface } from '@/components/admin/ui';
import { AdminSubmitButton } from '@/components/admin/form-submit-button';
import { FeedbackToast } from '@/components/feedback-toast';
import { TourismForm } from '@/components/admin/tourism-form';
import { TourismItemActions } from '@/components/admin/tourism-item-actions';
import { retranslateTourismItemAction, updateTourismItemAction } from '../actions';

export default async function TourismDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ success?: string; error?: string; warning?: string }> }) {
  const { profile } = await requireAdminAccess('visualizador');
  await requireHotelModule('content.tourism');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: item, error } = await supabase.from('hotel_tourism_items').select('*').eq('id', id).eq('hotel_id', profile.hotel_id).maybeSingle();
  if (error) throw new Error('Não foi possível carregar o item.');
  if (!item) notFound();
  const [languagesEnabled, { data: translations, error: translationError }] = await Promise.all([
    hasHotelModule('content.languages'),
    supabase.from('hotel_tourism_item_translations')
      .select('language,name,short_description,full_description,opening_hours,price_info,duration_info').eq('item_id', item.id),
  ]);
  const feedback = await searchParams || {};
  const canManage = hasMinimumRole(profile.normalizedRole, 'operador');
  return <main className="space-y-6">
    <FeedbackToast {...feedback} />
    <AdminBreadcrumbs items={[{ label: 'Turismo', href: '/admin/turismo' }, { label: item.name }]} />
    <AdminPageHero eyebrow="Turismo" title={item.name} description={`${TOURISM_TYPES.find((type) => type.key === item.type)?.labels.pt} · ${TOURISM_CATEGORIES.find((category) => category.type === item.type && category.key === item.category_key)?.labels.pt}`} />
    <div className="flex flex-wrap gap-3"><AdminStatusPill active={item.is_published} activeText="Publicado" inactiveText="Não publicado" />{item.featured ? <AdminInfoBadge>Destaque</AdminInfoBadge> : null}{item.recommended_by_hotel ? <AdminInfoBadge>Recomendado pelo hotel</AdminInfoBadge> : null}</div>
    <AdminSurface>
      <div className="flex flex-wrap items-center gap-3" aria-label="Estado dos idiomas">
        <AdminLanguageBadge label="Português —" available source />
        {translationError ? <p className="text-sm text-[var(--admin-muted)]">Não foi possível consultar o estado das traduções.</p> :
          (['en', 'es'] as const).map((language) => {
            const status = getTourismTranslationStatus(item, translations?.find((row) => row.language === language));
            return <AdminLanguageBadge key={language} label={`${language === 'en' ? 'English' : 'Español'} — ${TOURISM_TRANSLATION_STATUS_LABELS[status]}`} available={status === 'complete'} />;
          })}
        {canManage && languagesEnabled ? <form action={retranslateTourismItemAction}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="expected_updated_at" value={item.updated_at} />
          <AdminSubmitButton label="Traduzir novamente" pendingLabel="Traduzindo..." variant="secondary" />
        </form> : null}
      </div>
      <p className="mt-3 text-sm text-[var(--admin-muted)]">{languagesEnabled ? 'Português é a fonte. EN e ES são gerados ao salvar; campos sem tradução usam PT como fallback.' : 'Português é a fonte. A tradução automática está desabilitada para este hotel.'}</p>
    </AdminSurface>
    <AdminSurface>{canManage ? <TourismForm key={`${item.id}:${item.updated_at}`} item={item} action={updateTourismItemAction.bind(null, item.id)} /> : <>
      <p className="mb-5 text-sm text-[var(--admin-muted)]">Seu perfil possui acesso somente para visualização.</p>
      <dl className="space-y-5">{Object.entries(TOURISM_FIELD_LABELS).map(([key, label]) => <div key={key}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap break-words text-[var(--admin-muted)]">{item[key as keyof typeof TOURISM_FIELD_LABELS] || 'Não informado'}</dd></div>)}</dl>
    </>}</AdminSurface>
    {canManage ? <div className="flex flex-wrap gap-3"><TourismItemActions item={item} /></div> : null}
  </main>;
}
