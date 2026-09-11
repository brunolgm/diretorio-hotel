import { hasMinimumRole, requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { TOURISM_CATEGORIES, TOURISM_TYPES } from '@/lib/tourism/catalog';
import { AdminEmptyState, AdminInfoBadge, AdminInlineError, AdminLinkButton, AdminListItem, AdminPageHero, AdminSectionTitle, AdminStatusPill, AdminSurface } from '@/components/admin/ui';
import { FeedbackToast } from '@/components/feedback-toast';
import { TourismForm } from '@/components/admin/tourism-form';
import { TourismItemActions } from '@/components/admin/tourism-item-actions';
import { createTourismItemAction } from './actions';

export default async function AdminTourismPage({ searchParams }: { searchParams?: Promise<{ success?: string; error?: string }> }) {
  const { profile } = await requireAdminAccess('visualizador');
  await requireHotelModule('content.tourism');
  const supabase = await createClient();
  const { data: items, error } = await supabase.from('hotel_tourism_items').select('*').eq('hotel_id', profile.hotel_id).order('sort_order').order('id');
  if (error) throw new Error('Não foi possível carregar o Turismo deste hotel.');
  const feedback = await searchParams || {};
  const canManage = hasMinimumRole(profile.normalizedRole, 'operador');
  return <main className="space-y-6">
    <FeedbackToast {...feedback} /><AdminInlineError message={feedback.error} />
    <AdminPageHero eyebrow="Conteúdo do hotel" title="Turismo" description="Organize lugares, experiências e gastronomia recomendados aos hóspedes." />
    {!canManage ? <p className="text-sm text-[var(--admin-muted)]">Seu perfil possui acesso somente para visualização.</p> : null}
    <AdminSurface><AdminSectionTitle title="Catálogo do hotel" description={`${items?.length || 0} itens cadastrados`} />
      <div className="mt-5 space-y-4">{items?.length ? items.map((item, index) => <AdminListItem key={item.id} title={item.name} description={item.short_description}
        status={<AdminStatusPill active={item.is_published} activeText="Publicado" inactiveText="Não publicado" />}
        meta={<><span>{TOURISM_TYPES.find((type) => type.key === item.type)?.labels.pt}</span><span>{TOURISM_CATEGORIES.find((category) => category.type === item.type && category.key === item.category_key)?.labels.pt}</span>{item.featured ? <AdminInfoBadge>Destaque</AdminInfoBadge> : null}{item.recommended_by_hotel ? <AdminInfoBadge>Recomendado pelo hotel</AdminInfoBadge> : null}</>}
        actions={canManage ? <TourismItemActions item={item} position={index} total={items.length} /> : <AdminLinkButton href={`/admin/turismo/${item.id}`}>Ver detalhes</AdminLinkButton>} />)
        : <AdminEmptyState title="Nenhum item cadastrado" description={canManage ? 'Cadastre o primeiro item no formulário abaixo.' : 'Os itens cadastrados pelo hotel aparecerão aqui.'} />}</div>
    </AdminSurface>
    {canManage ? <AdminSurface><AdminSectionTitle title="Novo item" description="Preencha o conteúdo em português." /><div className="mt-5"><TourismForm action={createTourismItemAction} /></div></AdminSurface> : null}
  </main>;
}
