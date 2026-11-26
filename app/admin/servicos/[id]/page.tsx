import { ServiceTranslationManager } from '@/components/admin/service-translation-manager';
import { reviewServiceTranslationAction, translateServiceLanguageAction } from '../translation-actions';
import { buildRoomServiceHref, buildPublicHotelServiceHref } from '@/lib/public-routes';
import { MIN_SERVICE_DETAIL_CONTENT_LENGTH } from '@/lib/service-destinations';
import { GuestServiceFields } from '@/components/admin/guest-service-fields';
import {ServiceGuideEditor} from '@/components/admin/service-guide-editor';
import {saveServiceGuideAction} from './guide-actions';
import {parseRoomGuide} from '@/lib/room-guides';
import { notFound } from 'next/navigation';
import { FeedbackToast } from '@/components/feedback-toast';
import { AdminSubmitButton } from '@/components/admin/form-submit-button';
import {
  AdminBreadcrumbs,
  AdminInfoBadge,
  AdminPageHero,
  AdminSectionTitle,
  AdminSurface,
} from '@/components/admin/ui';
import { requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import { buildServiceCategoryOptions } from '@/lib/service-options';
import { createClient } from '@/lib/supabase/server';
import { updateSectionAction } from './actions';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
  }>;
}

export default async function EditServicePage({ params, searchParams }: PageProps) {
  const {profile}=await requireAdminAccess('operador');
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const success = resolvedSearchParams?.success;
  const errorMessage = resolvedSearchParams?.error;
  const warning = resolvedSearchParams?.warning;

  const supabase = await createClient();
  const hotel = await getAdminHotel();

  const [{ data: section, error }, { data: hotelSectionCategories, error: categoryError }] =
    await Promise.all([
      supabase
        .from('hotel_sections')
        .select('*')
        .eq('id', id)
        .eq('hotel_id', hotel.id)
        .maybeSingle(),
      supabase.from('hotel_sections').select('category').eq('hotel_id', hotel.id),
    ]);

  if (error) {
    throw new Error('Nao foi possivel carregar o servico solicitado.');
  }

  if (!section) {
    notFound();
  }

  if (categoryError) {
    throw new Error('Não foi possível carregar as categorias de serviço do hotel.');
  }

  const guideModules=await supabase.rpc('get_current_hotel_modules');
  if(guideModules.error)throw new Error('Não foi possível validar os módulos do hotel.');
  const guidesEnabled=guideModules.data?.some(m=>m.module_key==='content.languages'&&m.is_enabled);
  const guideResult=guidesEnabled?await supabase.rpc('get_current_hotel_service_guide',{p_service_id:section.id}):{data:null,error:null};
  if(guideResult.error)throw new Error('Não foi possível carregar o guia deste serviço.');
  const guideRow=guideResult.data?.[0];
  const canPreviewGuides=profile.normalizedRole==='administrador'&&['experience.preview','core.directory','content.services','content.languages'].every(key=>guideModules.data?.some(m=>m.module_key===key&&m.is_enabled));
  const {data:translationRows,error:translationError}=await supabase.from('hotel_section_translations').select('*').eq('section_id',section.id);
  if(translationError)throw new Error('Não foi possível carregar as traduções.');
  const action = updateSectionAction.bind(null, id);
  const serviceCategoryOptions = buildServiceCategoryOptions(
    (hotelSectionCategories || []).map((item) => item.category)
  );

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} warning={warning} />
      <AdminBreadcrumbs items={[{ label: 'Painel', href: '/admin' }, { label: 'Serviços', href: '/admin/servicos' }, { label: 'Editar serviço' }]} />

      <AdminPageHero
        eyebrow="editar serviço"
        title="Editar serviço"
        description="Atualize as informações em português e revise os idiomas quando necessário."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Registro</p>
              <p className="mt-2 text-lg font-semibold text-white">#{section.sort_order ?? 0}</p>
            </div>
          </div>
        }
      />

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="edição individual"
          title={section.title || 'Serviço'}
          description="Português continua como conteúdo fonte deste cadastro. EN e ES são atualizados a partir do texto salvo em PT."
          action={<AdminInfoBadge>Serviço do diretório</AdminInfoBadge>}
        />



        <form action={action} className="mt-6">
          <input type="hidden" name="source_version" value={section.updated_at||''}/>
          <GuestServiceFields initial={section.guest_presentation} title={section.title} content={section.content} icon={section.icon} themePreset={hotel.theme_preset} serviceId={section.id} hotelId={hotel.id} hotelSlug={hotel.slug} hotelSubdomain={hotel.subdomain} canonicalRoomHref={buildRoomServiceHref({slug:hotel.slug,language:'pt'})} category={section.category} actionType={section.service_action_type} url={section.url} cta={section.cta} hasGuide={Boolean(guideRow?.published)} internalHref={buildPublicHotelServiceHref({slug:hotel.slug,serviceId:section.id,language:'pt'})} minDetailLength={MIN_SERVICE_DETAIL_CONTENT_LENGTH} categoryOptions={serviceCategoryOptions} sortOrder={section.sort_order||0} enabled={Boolean(section.enabled)} allowRoomActions={Boolean(guideModules.data?.some(m=>m.module_key==='rooms.qr'&&m.is_enabled))}/>
          <div className="mt-6"><AdminSubmitButton label="Salvar alterações" pendingLabel="Salvando e traduzindo..."/></div>
        </form>
        <ServiceTranslationManager source={section} rows={translationRows||[]} sectionId={section.id} sourceVersion={section.updated_at} reviewAction={guidesEnabled?reviewServiceTranslationAction:undefined} translateAction={guidesEnabled?translateServiceLanguageAction:undefined}/>

      </AdminSurface>
      {guideRow?.draft&&canPreviewGuides?<AdminSurface><h2 className="font-semibold">Prévia privada do rascunho</h2><p className="mt-2 text-sm">Somente leitura; não habilita o Serviço nem publica o guia.</p><nav className="mt-3 flex flex-wrap gap-3">{(['pt','en','es'] as const).map(lang=><a className="inline-flex min-h-11 items-center rounded-xl border px-4" key={lang} href={'/preview/guias/'+section.id+'?lang='+lang} target="_blank" rel="noopener noreferrer">Prévia {lang.toUpperCase()}</a>)}</nav></AdminSurface>:null}
      {guidesEnabled&&section.service_action_type!=='room_restaurant_menu'?<details className="rounded-2xl border border-slate-200 bg-white p-5"><summary className="min-h-11 cursor-pointer font-semibold">Guias vinculados · configurações avançadas</summary><ServiceGuideEditor published={Boolean(guideRow?.published)} serviceId={section.id} revision={guideRow?.revision??0} initial={parseRoomGuide(guideRow?.draft,hotel.id,section.id)} action={saveServiceGuideAction}/></details>:null}
    </main>
  );
}
