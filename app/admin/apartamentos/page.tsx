import { BedDouble, CheckCircle2, QrCode, RefreshCw } from 'lucide-react';
import { RoomQrCard } from '@/components/admin/room-qr-card';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminActionGroup,
  AdminCheckboxRow,
  AdminEmptyState,
  AdminField,
  AdminFormGrid,
  AdminGuideCard,
  AdminHelpList,
  AdminHelpText,
  AdminInfoBadge,
  AdminListSummary,
  AdminPageHero,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminSectionTitle,
  AdminStatCard,
  AdminSurface,
  AdminTextInput,
  AdminTextarea,
} from '@/components/admin/ui';
import { hasMinimumRole, requireAdminAccess } from '@/lib/auth';
import { getAdminHotel } from '@/lib/queries';
import { buildRoomPublicUrl } from '@/lib/room-links';
import { createClient } from '@/lib/supabase/server';
import {
  createRoomLinkAction,
  regenerateRoomTokenAction,
  toggleRoomLinkStatusAction,
  updateRoomLinkAction,
} from './actions';

interface AdminRoomsPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
    warning?: string;
  }>;
}

export default async function AdminRoomsPage({ searchParams }: AdminRoomsPageProps) {
  const { profile } = await requireAdminAccess('visualizador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const canManageRooms = hasMinimumRole(profile.normalizedRole, 'editor');
  const params = searchParams ? await searchParams : {};

  const { data: roomLinks, error } = await supabase
    .from('hotel_room_links')
    .select('*')
    .eq('hotel_id', hotel.id);

  if (error) {
    throw new Error('Não foi possível carregar os apartamentos do hotel.');
  }

  const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
  const orderedRoomLinks = [...(roomLinks || [])].sort((a, b) =>
    collator.compare(a.room_number, b.room_number)
  );
  const activeRooms = orderedRoomLinks.filter((item) => item.is_active).length;

  return (
    <main className="space-y-6">
      <FeedbackToast
        success={params?.success}
        error={params?.error}
        warning={params?.warning}
      />

      <AdminPageHero
        eyebrow="qrs por apartamento"
        title="Apartamentos e links dinâmicos"
        description="Centralize o QR de cada apartamento no LibGuest para manter o cardápio externo atualizado sem reimprimir a peça física."
        rightSlot={
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Hotel</p>
              <p className="mt-2 text-lg font-semibold text-white">{hotel.name}</p>
            </div>
            <div className="rounded-[28px] bg-white/10 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Modelo</p>
              <p className="mt-2 text-lg font-semibold text-white">QR dinâmico por apartamento</p>
            </div>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <AdminStatCard
          icon={<BedDouble className="h-5 w-5" />}
          title="Apartamentos"
          value={String(orderedRoomLinks.length)}
          description="Total de apartamentos cadastrados com QR dinâmico."
        />
        <AdminStatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Ativos"
          value={String(activeRooms)}
          description="QRs válidos para entrar no diretório com contexto de quarto."
        />
        <AdminStatCard
          icon={<QrCode className="h-5 w-5" />}
          title="Fluxo Thex"
          value="server-side"
          description="O link do cardápio é resolvido no servidor no momento do clique."
        />
      </section>

      {canManageRooms ? (
        <AdminSurface>
          <AdminSectionTitle
            eyebrow="cadastro rápido"
            title="Novo apartamento"
            description="Crie o QR dinâmico do apartamento e informe o link Thex atual da mesa correspondente."
            action={<AdminInfoBadge>Editor pode gerenciar</AdminInfoBadge>}
          />

          <AdminGuideCard
            title="Boas práticas deste módulo"
            description="O QR físico aponta para o LibGuest. O link Thex pode mudar no admin depois, sem reimpressão."
            className="mt-8"
          >
            <AdminHelpList
              items={[
                'Use o número real do apartamento e revise a URL do cardápio antes de ativar.',
                'Inativar um apartamento invalida o QR imediatamente.',
                'Regenerar token invalida o QR antigo e exige a nova impressão do código.',
              ]}
            />
          </AdminGuideCard>

          <form action={createRoomLinkAction}>
            <AdminFormGrid className="mt-8">
              <AdminField label="Número do apartamento">
                <AdminTextInput name="room_number" required placeholder="Ex.: 749" />
              </AdminField>

              <AdminField label="Etiqueta interna">
                <AdminTextInput name="label" placeholder="Ex.: Apto luxo 749" />
                <AdminHelpText>Opcional. Ajuda a equipe a localizar o registro no painel.</AdminHelpText>
              </AdminField>

              <AdminField label="Link do cardápio Thex" className="md:col-span-2">
                <AdminTextInput
                  name="restaurant_menu_url"
                  placeholder="https://..."
                />
                <AdminHelpText>
                  Este link é resolvido no servidor quando o hóspede toca no serviço configurado como cardápio por apartamento.
                </AdminHelpText>
              </AdminField>

              <AdminField label="Observações" className="md:col-span-2">
                <AdminTextarea
                  name="notes"
                  className="min-h-28"
                  placeholder="Ex.: mesa Thex espelha o número do apartamento."
                />
              </AdminField>
            </AdminFormGrid>

            <div className="mt-6">
              <AdminCheckboxRow>
                <input type="checkbox" name="is_active" defaultChecked />
                Ativo para leitura do QR
              </AdminCheckboxRow>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <AdminPrimaryButton type="submit">Criar apartamento</AdminPrimaryButton>
              <AdminInfoBadge>O token é aleatório e não expõe o número do quarto na URL</AdminInfoBadge>
            </div>
          </form>
        </AdminSurface>
      ) : (
        <AdminSurface>
          <AdminSectionTitle
            eyebrow="acesso em leitura"
            title="Leitura de apartamentos e QR"
            description="Seu papel pode revisar status, links públicos e a configuração geral, mas sem alterar tokens ou cardápios."
            action={<AdminInfoBadge>Modo leitura</AdminInfoBadge>}
          />
        </AdminSurface>
      )}

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="registros ativos"
          title="Apartamentos cadastrados"
          description="Cada QR aponta para o LibGuest e resolve o cardápio do apartamento no momento do clique."
          action={<AdminListSummary total={orderedRoomLinks.length} label="apartamento(s)" />}
        />

        <div className="mt-8 space-y-5">
          {orderedRoomLinks.length ? (
            orderedRoomLinks.map((roomLink) => {
              const publicUrl = buildRoomPublicUrl(hotel, roomLink.room_token);

              return (
                <div
                  key={roomLink.id}
                  className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.22)]"
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                          Apartamento {roomLink.room_number}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            roomLink.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {roomLink.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                        {roomLink.label ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            {roomLink.label}
                          </span>
                        ) : null}
                      </div>

                      {canManageRooms ? (
                        <form action={updateRoomLinkAction} className="mt-5">
                          <input type="hidden" name="id" value={roomLink.id} />

                          <AdminFormGrid>
                            <AdminField label="Número do apartamento">
                              <AdminTextInput
                                name="room_number"
                                defaultValue={roomLink.room_number}
                                required
                              />
                            </AdminField>

                            <AdminField label="Etiqueta interna">
                              <AdminTextInput
                                name="label"
                                defaultValue={roomLink.label || ''}
                                placeholder="Ex.: Frente elevador"
                              />
                            </AdminField>

                            <AdminField label="Link do cardápio Thex" className="md:col-span-2">
                              <AdminTextInput
                                name="restaurant_menu_url"
                                defaultValue={roomLink.restaurant_menu_url || ''}
                                placeholder="https://..."
                              />
                              <AdminHelpText>
                                Se este campo ficar vazio, o serviço configurado como cardápio por apartamento mostrará uma mensagem operacional em vez de quebrar.
                              </AdminHelpText>
                            </AdminField>

                            <AdminField label="Observações" className="md:col-span-2">
                              <AdminTextarea
                                name="notes"
                                className="min-h-24"
                                defaultValue={roomLink.notes || ''}
                                placeholder="Observações internas do apartamento."
                              />
                            </AdminField>
                          </AdminFormGrid>

                          <div className="mt-5">
                            <AdminCheckboxRow>
                              <input
                                type="checkbox"
                                name="is_active"
                                defaultChecked={roomLink.is_active}
                              />
                              Ativo para leitura do QR
                            </AdminCheckboxRow>
                          </div>

                          <div className="mt-6">
                            <AdminActionGroup>
                              <AdminPrimaryButton type="submit">Salvar apartamento</AdminPrimaryButton>
                            </AdminActionGroup>
                          </div>
                        </form>
                      ) : (
                        <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                          <p>
                            <span className="font-medium text-slate-900">Link do cardápio:</span>{' '}
                            {roomLink.restaurant_menu_url || 'Ainda não configurado'}
                          </p>
                          <p>
                            <span className="font-medium text-slate-900">Observações:</span>{' '}
                            {roomLink.notes || 'Sem observações'}
                          </p>
                        </div>
                      )}

                      {canManageRooms ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <form action={toggleRoomLinkStatusAction}>
                            <input type="hidden" name="id" value={roomLink.id} />
                            <input
                              type="hidden"
                              name="is_active"
                              value={String(!roomLink.is_active)}
                            />
                            <AdminSecondaryButton type="submit">
                              {roomLink.is_active ? 'Inativar' : 'Reativar'}
                            </AdminSecondaryButton>
                          </form>

                          <form action={regenerateRoomTokenAction}>
                            <input type="hidden" name="id" value={roomLink.id} />
                            <AdminSecondaryButton type="submit">
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Regenerar token
                            </AdminSecondaryButton>
                          </form>
                        </div>
                      ) : null}
                    </div>

                    <div className="w-full max-w-md shrink-0">
                      <RoomQrCard
                        publicUrl={publicUrl}
                        roomNumber={roomLink.room_number}
                        isActive={roomLink.is_active}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <AdminEmptyState
              title="Nenhum apartamento cadastrado ainda"
              description="Crie o primeiro QR dinâmico para começar a centralizar o acesso do apartamento no LibGuest."
            />
          )}
        </div>
      </AdminSurface>
    </main>
  );
}
