import {
  ArrowDown,
  ArrowUp,
  Clock3,
  ExternalLink,
  House,
  Link2,
  MapPin,
  Plane,
  Settings2,
} from 'lucide-react';
import { FeedbackToast } from '@/components/feedback-toast';
import { AdminSubmitButton } from '@/components/admin/form-submit-button';
import {
  AdminCheckboxRow,
  AdminEmptyState,
  AdminField,
  AdminFormGrid,
  AdminPageHero,
  AdminSectionTitle,
  AdminSelect,
  AdminStatCard,
  AdminStatusPill,
  AdminSurface,
  AdminTextInput,
  AdminTextarea,
} from '@/components/admin/ui';
import { hasMinimumRole, requireAdminAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import {
  addHotelAirportAction,
  moveHotelAirportAction,
  removeHotelAirportAction,
  updateFlightSettingsAction,
  updateHotelAirportAction,
} from './actions';

type Airport = Database['public']['Tables']['airports']['Row'];
type HotelAirport = Database['public']['Tables']['hotel_airports']['Row'];
type FlightSettings = Database['public']['Tables']['hotel_flight_settings']['Row'];

const DEFAULT_SETTINGS: Omit<FlightSettings, 'hotel_id' | 'created_at' | 'updated_at'> = {
  home_card_enabled: false,
  transfer_enabled: false,
  wake_up_enabled: false,
  breakfast_box_enabled: false,
  reception_enabled: false,
  official_links_enabled: false,
  departure_planning_enabled: false,
  home_card_title: null,
  home_card_description: null,
  departure_notice: null,
};

function SettingsCheckbox({
  name,
  label,
  description,
  checked,
  canManage,
}: {
  name: string;
  label: string;
  description: string;
  checked: boolean;
  canManage: boolean;
}) {
  return (
    <AdminCheckboxRow className="items-start">
      <input
        form="flight-settings-form"
        type="checkbox"
        name={name}
        defaultChecked={checked}
        disabled={!canManage}
        className="mt-0.5 h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-accent)] focus:ring-[var(--admin-focus)]"
      />
      <span>
        <span className="block">{label}</span>
        <span className="mt-1 block text-xs font-normal leading-5 text-[var(--admin-muted)]">{description}</span>
      </span>
    </AdminCheckboxRow>
  );
}

function AirportLink({ href, children }: { href: string | null; children: string }) {
  if (!href) return <span className="text-sm text-[var(--admin-muted)]">{children}: não informado</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-accent)] hover:underline"
    >
      {children}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

export default async function FlightCenterAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string; warning?: string }>;
}) {
  const params = await searchParams;
  const { profile } = await requireAdminAccess('visualizador');
  const canManage = hasMinimumRole(profile.normalizedRole, 'editor');
  const supabase = await createClient();

  const [settingsResult, hotelAirportsResult, airportsResult] = await Promise.all([
    supabase.from('hotel_flight_settings').select('*').eq('hotel_id', profile.hotel_id).maybeSingle(),
    supabase.from('hotel_airports').select('*').eq('hotel_id', profile.hotel_id).order('sort_order'),
    supabase.from('airports').select('*').eq('is_active', true).order('city').order('iata_code'),
  ]);

  if (settingsResult.error || hotelAirportsResult.error || airportsResult.error) {
    throw new Error('Não foi possível carregar a configuração da Central de Voos.');
  }

  const settings = settingsResult.data || DEFAULT_SETTINGS;
  const hotelAirports = (hotelAirportsResult.data || []) as HotelAirport[];
  const airports = (airportsResult.data || []) as Airport[];
  const airportsById = new Map(airports.map((airport) => [airport.id, airport]));
  const configuredIds = new Set(hotelAirports.map((item) => item.airport_id));
  const availableAirports = airports.filter((airport) => !configuredIds.has(airport.id));
  const enabledActions = [
    settings.transfer_enabled,
    settings.wake_up_enabled,
    settings.breakfast_box_enabled,
    settings.reception_enabled,
  ].filter(Boolean).length;

  return (
    <main className="space-y-6">
      <FeedbackToast success={params?.success} error={params?.error} warning={params?.warning} />

      <AdminPageHero
        eyebrow="experiência do hóspede"
        title="Central de Voos"
        description="Configure aeroportos próximos, tempos de planejamento e os serviços que poderão apoiar a saída do hóspede."
        rightSlot={
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Disponibilidade</p>
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <Plane className="h-5 w-5" aria-hidden="true" /> Módulo ativo
            </div>
            <p className="text-xs leading-5 text-slate-300">A ativação é administrada pela equipe da plataforma.</p>
          </div>
        }
      />

      <section aria-labelledby="flight-overview-title" className="space-y-4">
        <AdminSectionTitle
          eyebrow="visão geral"
          title="Configuração atual"
          description="Um resumo operacional, sem alterar a disponibilidade contratada do módulo."
        />
        <h2 id="flight-overview-title" className="sr-only">Visão geral da Central de Voos</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard icon={<Plane className="h-5 w-5" />} title="Central de Voos" value="Ativa" description="Disponível para configuração neste hotel." />
          <AdminStatCard icon={<House className="h-5 w-5" />} title="Card da página inicial" value={settings.home_card_enabled ? 'Visível' : 'Oculto'} description="Estado preparado para a futura experiência pública." />
          <AdminStatCard icon={<MapPin className="h-5 w-5" />} title="Aeroportos próximos" value={String(hotelAirports.length)} description="Aeroportos associados e ordenados para este hotel." />
          <AdminStatCard icon={<Settings2 className="h-5 w-5" />} title="Serviços disponíveis" value={`${enabledActions} de 4`} description="Ações que poderão ser oferecidas futuramente ao hóspede." />
        </div>
      </section>

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="geral"
          title="Planejamento da saída"
          description="Defina quais informações operacionais estarão disponíveis na futura Central de Voos."
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SettingsCheckbox name="departure_planning_enabled" label="Mostrar planejamento de saída" description="Disponibiliza recomendações de antecedência e margem de segurança." checked={settings.departure_planning_enabled} canManage={canManage} />
          <SettingsCheckbox name="official_links_enabled" label="Mostrar links oficiais" description="Permite apresentar os links oficiais dos aeroportos configurados." checked={settings.official_links_enabled} canManage={canManage} />
        </div>
        <AdminField label="Orientação geral de saída" className="mt-5">
          <AdminTextarea form="flight-settings-form" name="departure_notice" maxLength={500} defaultValue={settings.departure_notice || ''} disabled={!canManage} placeholder="Ex.: Considere o trânsito e confirme o terminal antes de sair." />
        </AdminField>
      </AdminSurface>

      <AdminSurface>
        <AdminSectionTitle
          eyebrow="aeroportos"
          title="Aeroportos próximos"
          description="Associe aeroportos do catálogo oficial e organize a ordem exibida para o hotel."
        />

        {canManage ? (
          <form action={addHotelAirportAction} className="mt-6 flex flex-col gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-4 sm:flex-row sm:items-end">
            <AdminField label="Adicionar aeroporto" className="min-w-0 flex-1">
              <AdminSelect name="airport_id" required defaultValue="" className="w-full">
                <option value="" disabled>Selecione um aeroporto ativo</option>
                {availableAirports.map((airport) => (
                  <option key={airport.id} value={airport.id}>{airport.iata_code} — {airport.city} · {airport.name}</option>
                ))}
              </AdminSelect>
            </AdminField>
            <AdminSubmitButton label="Adicionar aeroporto" pendingLabel="Adicionando..." className="w-full sm:w-auto" />
          </form>
        ) : (
          <p className="mt-5 rounded-xl bg-[var(--admin-surface-muted)] p-4 text-sm text-[var(--admin-muted)]">Seu perfil pode consultar esta configuração. Alterações exigem perfil Editor ou Administrador.</p>
        )}

        <div className="mt-6 space-y-4">
          {!hotelAirports.length ? (
            <AdminEmptyState title="Nenhum aeroporto configurado" description={canManage ? 'Selecione um aeroporto ativo acima para iniciar a configuração.' : 'Um Editor ou Administrador pode adicionar os aeroportos próximos ao hotel.'} />
          ) : hotelAirports.map((item, index) => {
            const airport = airportsById.get(item.airport_id);
            return (
              <article key={item.airport_id} className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-[var(--admin-accent-soft)] px-2.5 py-1 text-sm font-bold text-[var(--admin-accent)]">{airport?.iata_code || '—'}</span>
                      <h3 className="text-lg font-semibold text-[var(--admin-text-strong)]">{airport?.name || 'Aeroporto indisponível no catálogo ativo'}</h3>
                      <AdminStatusPill active={item.is_active} activeText="Em operação" inactiveText="Pausado" />
                    </div>
                    <p className="mt-2 text-sm text-[var(--admin-muted)]">{airport ? `${airport.city} · ${airport.timezone}` : 'Os detalhes globais não estão disponíveis para edição pelo hotel.'}</p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <form action={moveHotelAirportAction}>
                        <input type="hidden" name="airport_id" value={item.airport_id} />
                        <input type="hidden" name="direction" value="up" />
                        <button type="submit" disabled={index === 0} aria-label={`Mover ${airport?.iata_code || 'aeroporto'} para cima`} className="rounded-lg border border-[var(--admin-border)] p-2 text-[var(--admin-muted)] disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                      </form>
                      <form action={moveHotelAirportAction}>
                        <input type="hidden" name="airport_id" value={item.airport_id} />
                        <input type="hidden" name="direction" value="down" />
                        <button type="submit" disabled={index === hotelAirports.length - 1} aria-label={`Mover ${airport?.iata_code || 'aeroporto'} para baixo`} className="rounded-lg border border-[var(--admin-border)] p-2 text-[var(--admin-muted)] disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                      </form>
                    </div>
                  ) : null}
                </div>

                {canManage ? (
                  <form action={updateHotelAirportAction} className="mt-5 border-t border-[var(--admin-border)] pt-5">
                    <input type="hidden" name="airport_id" value={item.airport_id} />
                    <AdminFormGrid className="mt-0">
                      <AdminField label="Tempo estimado até o aeroporto (minutos)"><AdminTextInput type="number" name="estimated_transfer_minutes" min={0} max={1440} defaultValue={item.estimated_transfer_minutes ?? ''} /></AdminField>
                      <AdminField label="Antecedência para voos nacionais (minutos)"><AdminTextInput type="number" name="domestic_lead_minutes" min={0} max={2880} defaultValue={item.domestic_lead_minutes ?? ''} /></AdminField>
                      <AdminField label="Antecedência para voos internacionais (minutos)"><AdminTextInput type="number" name="international_lead_minutes" min={0} max={2880} defaultValue={item.international_lead_minutes ?? ''} /></AdminField>
                      <AdminField label="Margem de segurança (minutos)"><AdminTextInput type="number" name="safety_margin_minutes" min={0} max={720} defaultValue={item.safety_margin_minutes ?? ''} /></AdminField>
                    </AdminFormGrid>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <AdminCheckboxRow><input type="checkbox" name="is_active" defaultChecked={item.is_active} className="h-4 w-4 rounded" /><span>Disponível para a operação do hotel</span></AdminCheckboxRow>
                      <AdminSubmitButton label="Salvar aeroporto" pendingLabel="Salvando..." />
                    </div>
                  </form>
                ) : (
                  <dl className="mt-5 grid gap-3 border-t border-[var(--admin-border)] pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-[var(--admin-muted)]">Tempo até o aeroporto</dt><dd className="mt-1 font-medium text-[var(--admin-text)]">{item.estimated_transfer_minutes ?? '—'} min</dd></div>
                    <div><dt className="text-[var(--admin-muted)]">Voo nacional</dt><dd className="mt-1 font-medium text-[var(--admin-text)]">{item.domestic_lead_minutes ?? '—'} min</dd></div>
                    <div><dt className="text-[var(--admin-muted)]">Voo internacional</dt><dd className="mt-1 font-medium text-[var(--admin-text)]">{item.international_lead_minutes ?? '—'} min</dd></div>
                    <div><dt className="text-[var(--admin-muted)]">Margem de segurança</dt><dd className="mt-1 font-medium text-[var(--admin-text)]">{item.safety_margin_minutes ?? '—'} min</dd></div>
                  </dl>
                )}

                {canManage ? (
                  <form action={removeHotelAirportAction} className="mt-4 flex justify-end">
                    <input type="hidden" name="airport_id" value={item.airport_id} />
                    <AdminSubmitButton label="Remover associação" pendingLabel="Removendo..." variant="danger" />
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      </AdminSurface>

      <AdminSurface>
        <AdminSectionTitle eyebrow="informações oficiais" title="Links dos aeroportos" description="Dados mantidos no catálogo global e disponíveis aqui somente para consulta." />
        {!settings.official_links_enabled ? (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">Os links oficiais estão desativados operacionalmente para este hotel.</p>
        ) : null}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {!hotelAirports.length ? (
            <AdminEmptyState title="Sem links para exibir" description="Adicione um aeroporto para consultar suas referências oficiais." />
          ) : hotelAirports.map((item) => {
            const airport = airportsById.get(item.airport_id);
            return (
              <div key={item.airport_id} className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-4">
                <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-[var(--admin-accent)]" /><p className="font-semibold text-[var(--admin-text-strong)]">{airport ? `${airport.iata_code} · ${airport.city}` : 'Aeroporto indisponível'}</p></div>
                <p className="mt-2 text-xs text-[var(--admin-muted)]">Fuso horário: {airport?.timezone || 'não disponível'}</p>
                <div className="mt-4 flex flex-col gap-2"><AirportLink href={airport?.official_departures_url || null}>Partidas oficiais</AirportLink><AirportLink href={airport?.official_arrivals_url || null}>Chegadas oficiais</AirportLink></div>
              </div>
            );
          })}
        </div>
      </AdminSurface>

      <AdminSurface>
        <AdminSectionTitle eyebrow="ações e serviços" title="Serviços disponíveis" description="Estas opções apenas preparam o que poderá ser oferecido futuramente. Nenhuma solicitação é criada nesta etapa." />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <SettingsCheckbox name="transfer_enabled" label="Transfer" description="Indica que o hotel poderá orientar o hóspede sobre transfer." checked={settings.transfer_enabled} canManage={canManage} />
          <SettingsCheckbox name="wake_up_enabled" label="Despertar" description="Indica que o serviço de despertar poderá ser apresentado." checked={settings.wake_up_enabled} canManage={canManage} />
          <SettingsCheckbox name="breakfast_box_enabled" label="Café da manhã para viagem" description="Indica disponibilidade futura de orientação sobre breakfast box." checked={settings.breakfast_box_enabled} canManage={canManage} />
          <SettingsCheckbox name="reception_enabled" label="Falar com a recepção" description="Indica que o contato com a recepção poderá ser oferecido." checked={settings.reception_enabled} canManage={canManage} />
        </div>
      </AdminSurface>

      <AdminSurface>
        <AdminSectionTitle eyebrow="card da página inicial" title="Chamada para a Central de Voos" description="Prepare o conteúdo do card. A publicação pública será implementada em uma etapa posterior." />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <SettingsCheckbox name="home_card_enabled" label="Mostrar card na página inicial" description="Guarda a preferência para o futuro card público da Central de Voos." checked={settings.home_card_enabled} canManage={canManage} />
            <AdminField label="Título do card"><AdminTextInput form="flight-settings-form" name="home_card_title" maxLength={120} defaultValue={settings.home_card_title || ''} disabled={!canManage} placeholder="Ex.: Organize seu voo" /></AdminField>
            <AdminField label="Descrição do card"><AdminTextarea form="flight-settings-form" name="home_card_description" maxLength={280} defaultValue={settings.home_card_description || ''} disabled={!canManage} placeholder="Ex.: Consulte aeroportos e planeje sua saída com tranquilidade." /></AdminField>
          </div>
          <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-muted)]">Prévia administrativa</p>
            <div className="mt-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"><Plane className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--admin-text-strong)]">{settings.home_card_title || 'Central de Voos'}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{settings.home_card_description || 'Planeje sua saída e consulte informações dos aeroportos próximos.'}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-[var(--admin-muted)]"><Clock3 className="h-4 w-4" /> Prévia sem publicação pública</div>
            </div>
          </div>
        </div>
      </AdminSurface>

      {canManage ? (
        <form id="flight-settings-form" action={updateFlightSettingsAction} className="sticky bottom-4 z-10 flex justify-end rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]/95 p-3 shadow-lg backdrop-blur">
          <AdminSubmitButton label="Salvar configurações" pendingLabel="Salvando..." />
        </form>
      ) : null}
    </main>
  );
}
