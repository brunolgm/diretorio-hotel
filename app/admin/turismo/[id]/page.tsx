import { notFound } from 'next/navigation';
import { hasMinimumRole, requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/security/identifiers';
import { TOURISM_FIELD_LABELS } from '@/lib/tourism/admin';
import { TOURISM_CATEGORIES, TOURISM_TYPES } from '@/lib/tourism/catalog';
import { AdminBreadcrumbs, AdminInfoBadge, AdminPageHero, AdminStatusPill, AdminSurface } from '@/components/admin/ui';
import { FeedbackToast } from '@/components/feedback-toast';
import { TourismForm } from '@/components/admin/tourism-form';
import { TourismItemActions } from '@/components/admin/tourism-item-actions';
import { updateTourismItemAction } from '../actions';

export default async function TourismDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ success?: string; error?: string }> }) {
  const { profile } = await requireAdminAccess('visualizador');
  await requireHotelModule('content.tourism');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: item, error } = await supabase.from('hotel_tourism_items').select('*').eq('id', id).eq('hotel_id', profile.hotel_id).maybeSingle();
  if (error) throw new Error('Não foi possível carregar o item.');
  if (!item) notFound();
  const feedback = await searchParams || {};
  const canManage = hasMinimumRole(profile.normalizedRole, 'operador');
  return <main className="space-y-6">
    <FeedbackToast {...feedback} />
    <AdminBreadcrumbs items={[{ label: 'Turismo', href: '/admin/turismo' }, { label: item.name }]} />
    <AdminPageHero eyebrow="Turismo" title={item.name} description={`${TOURISM_TYPES.find((type) => type.key === item.type)?.labels.pt} · ${TOURISM_CATEGORIES.find((category) => category.type === item.type && category.key === item.category_key)?.labels.pt}`} />
    <div className="flex flex-wrap gap-3"><AdminStatusPill active={item.is_published} activeText="Publicado" inactiveText="Não publicado" />{item.featured ? <AdminInfoBadge>Destaque</AdminInfoBadge> : null}{item.recommended_by_hotel ? <AdminInfoBadge>Recomendado pelo hotel</AdminInfoBadge> : null}</div>
    <AdminSurface>{canManage ? <TourismForm key={`${item.id}:${item.updated_at}`} item={item} action={updateTourismItemAction.bind(null, item.id)} /> : <>
      <p className="mb-5 text-sm text-[var(--admin-muted)]">Seu perfil possui acesso somente para visualização.</p>
      <dl className="space-y-5">{Object.entries(TOURISM_FIELD_LABELS).map(([key, label]) => <div key={key}><dt className="font-semibold">{label}</dt><dd className="whitespace-pre-wrap break-words text-[var(--admin-muted)]">{item[key as keyof typeof TOURISM_FIELD_LABELS] || 'Não informado'}</dd></div>)}</dl>
    </>}</AdminSurface>
    {canManage ? <div className="flex flex-wrap gap-3"><TourismItemActions item={item} /></div> : null}
  </main>;
}
