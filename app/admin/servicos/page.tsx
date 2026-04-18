import {
  Plus,
  Sparkles,
  LayoutGrid,
  CheckCircle2,
  Eye,
  Tag,
  FileText,
  Power,
  Pencil,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAdminHotel } from '@/lib/queries';
import { createSectionAction, deleteSectionAction, toggleSectionAction } from './actions';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminActionGroup,
  AdminCheckboxRow,
  AdminEmptyState,
  AdminField,
  AdminFormGrid,
  AdminInfoBadge,
  AdminLinkButton,
  AdminListItem,
  AdminPageHero,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminDangerButton,
  AdminSectionTitle,
  AdminStatCard,
  AdminStatusPill,
  AdminSurface,
  AdminTextInput,
  AdminTextarea,
} from '@/components/admin/ui';

interface AdminServicesPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
}

export default async function AdminServicesPage({
  searchParams,
}: AdminServicesPageProps) {
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const errorMessage = params?.error;

  const { data: sections, error } = await supabase
    .from('hotel_sections')
    .select('*')
    .eq('hotel_id', hotel.id)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error('Erro ao carregar serviços do hotel.');
  }

  const totalServices = sections?.length || 0;
  const activeServices = sections?.filter((item) => item.enabled).length || 0;
  const inactiveServices = totalServices - activeServices;

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={errorMessage} />

      <AdminPageHero
        eyebrow="gestão de serviços"
        title="Serviços e seções do diretório"
        description="Cadastre, organize e mantenha atualizados os cards que aparecem para o hóspede no diretório digital."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Status</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                <CheckCircle2 className="h-4 w-4" />
                Operacional
              </p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          icon={<LayoutGrid className="h-5 w-5" />}
          title="Total de serviços"
          value={String(totalServices)}
          description="Quantidade total de cards cadastrados no diretório."
        />
        <AdminStatCard
          icon={<Eye className="h-5 w-5" />}
          title="Ativos"
          value={String(activeServices)}
          description="Serviços atualmente visíveis para o hóspede."
        />
        <AdminStatCard
          icon={<Power className="h-5 w-5" />}
          title="Inativos"
          value={String(inactiveServices)}
          description="Itens cadastrados, mas temporariamente ocultos."
        />
        <AdminStatCard
          icon={<Sparkles className="h-5 w-5" />}
          title="Organização"
          value="Dinâmica"
          description="Os cards podem ser ordenados e administrados a qualquer momento."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Cadastro rápido"
            title="Novo serviço"
            description="Adicione um novo card com título, categoria, descrição, botão e link."
            action={<AdminInfoBadge>Publicação direta no diretório</AdminInfoBadge>}
          />

          <form action={createSectionAction}>
            <AdminFormGrid>
              <AdminField label="Título" className="md:col-span-2">
                <AdminTextInput name="title" required />
              </AdminField>

              <AdminField label="Ícone">
                <AdminTextInput name="icon" defaultValue="Globe" />
              </AdminField>

              <AdminField label="Categoria">
                <div className="relative">
                  <Tag className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <AdminTextInput
                    name="category"
                    className="pl-11"
                    placeholder="Ex.: Estrutura"
                  />
                </div>
              </AdminField>

              <AdminField label="Descrição" className="md:col-span-2">
                <AdminTextarea
                  name="content"
                  placeholder="Descreva o serviço que será exibido no diretório."
                />
              </AdminField>

              <AdminField label="Texto do botão">
                <AdminTextInput name="cta" placeholder="Ex.: Ver mais" />
              </AdminField>

              <AdminField label="Link">
                <AdminTextInput name="url" placeholder="https://..." />
              </AdminField>

              <AdminField label="Ordem">
                <AdminTextInput type="number" name="sort_order" defaultValue="0" />
              </AdminField>

              <AdminCheckboxRow className="md:col-span-2">
                <input type="checkbox" name="enabled" defaultChecked />
                Ativo no diretório
              </AdminCheckboxRow>
            </AdminFormGrid>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <AdminPrimaryButton type="submit">
                <Plus className="mr-2 h-4 w-4" />
                Criar serviço
              </AdminPrimaryButton>

              <AdminInfoBadge>
                <FileText className="h-3.5 w-3.5" />
                Os serviços aparecem automaticamente no diretório público
              </AdminInfoBadge>
            </div>
          </form>
        </AdminSurface>

        <AdminSurface>
          <AdminSectionTitle
            eyebrow="Itens cadastrados"
            title="Lista de serviços"
            description="Edite, ative, desative ou remova cada card do diretório."
            action={<AdminInfoBadge>Gestão rápida</AdminInfoBadge>}
          />

          <div className="mt-6 space-y-4">
            {sections?.length ? (
              sections.map((item) => (
                <AdminListItem
                  key={item.id}
                  title={item.title}
                  description={item.content || 'Sem descrição cadastrada.'}
                  status={
                    <>
                      <AdminInfoBadge>{item.category || 'Sem categoria'}</AdminInfoBadge>
                      <AdminStatusPill active={Boolean(item.enabled)} />
                    </>
                  }
                  meta={
                    <>
                      <span>Botão: {item.cta || '—'}</span>
                      <span>Ordem: {item.sort_order ?? 0}</span>
                    </>
                  }
                  actions={
                    <AdminActionGroup>
                      <AdminLinkButton href={`/admin/servicos/${item.id}`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </AdminLinkButton>

                      <form action={toggleSectionAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="enabled" value={String(!item.enabled)} />
                        <AdminSecondaryButton type="submit">
                          <Power className="mr-2 h-4 w-4" />
                          {item.enabled ? 'Desativar' : 'Ativar'}
                        </AdminSecondaryButton>
                      </form>

                      <form action={deleteSectionAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <AdminDangerButton type="submit">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </AdminDangerButton>
                      </form>
                    </AdminActionGroup>
                  }
                />
              ))
            ) : (
              <AdminEmptyState
                title="Nenhum serviço cadastrado ainda"
                description="Crie o primeiro card para começar a montar o diretório digital do hóspede."
              />
            )}
          </div>
        </AdminSurface>
      </section>
    </main>
  );
}
