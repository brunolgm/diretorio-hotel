import {
  CheckCircle2,
  Clock3,
  Coffee,
  Globe,
  Hotel,
  ImageIcon,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Upload,
  Wifi,
} from 'lucide-react';
import { HotelSubdomainField } from '@/components/admin/hotel-subdomain-field';
import { ThemeColorField } from '@/components/admin/theme-color-field';
import { FeedbackToast } from '@/components/feedback-toast';
import {
  AdminGuideCard,
  AdminHelpList,
  AdminHelpText,
  AdminInfoBadge,
  AdminPrimaryButton,
  AdminSecondaryButton,
} from '@/components/admin/ui';
import { requireAdminAccess } from '@/lib/auth';
import {
  DEFAULT_HOTEL_THEME_PRESET,
  HOTEL_THEME_PRESETS,
  resolveHotelTheme,
} from '@/lib/hotel-theme';
import { buildHotelSubdomainPreviewUrl } from '@/lib/hotel-subdomain';
import { getAdminHotel } from '@/lib/queries';
import { updateHotelAction, removeHotelLogoAction } from './actions';
import { uploadHotelLogoAction } from './upload-logo-action';

interface AdminHotelPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
}

function InfoCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function SetupChecklistItem({
  title,
  description,
  completed,
}: {
  title: string;
  description: string;
  completed: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[24px] bg-slate-50 p-4">
      <div
        className={`mt-0.5 rounded-full p-1 ${
          completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

export default async function AdminHotelPage({ searchParams }: AdminHotelPageProps) {
  await requireAdminAccess('editor');
  const hotel = await getAdminHotel();
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const error = params?.error;
  const currentTheme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const publicSubdomainPreview =
    buildHotelSubdomainPreviewUrl(hotel.subdomain) || buildHotelSubdomainPreviewUrl(hotel.slug);
  const slugFallbackPreview = buildHotelSubdomainPreviewUrl(hotel.slug);
  const hasIdentityReady = Boolean(hotel.name?.trim() && hotel.city?.trim());
  const hasPublicAddressReady = Boolean(hotel.subdomain?.trim() || hotel.slug?.trim());
  const hasThemeReady = Boolean(hotel.theme_preset || DEFAULT_HOTEL_THEME_PRESET);
  const hasPublicReviewReady = Boolean(
    hotel.name?.trim() &&
      (hotel.subdomain?.trim() || hotel.slug?.trim()) &&
      (hotel.booking_url || hotel.website_url || hotel.whatsapp_number)
  );

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={error} />

      <section className="overflow-hidden rounded-[32px] bg-[linear-gradient(145deg,#020617_0%,#0f172a_55%,#1e293b_100%)] p-8 text-white shadow-sm md:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-100 backdrop-blur">
              <Hotel className="h-3.5 w-3.5" />
              Configurações do hotel
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">
              Informações do hotel
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
              Atualize os dados principais do diretório digital e mantenha a experiência do hóspede
              sempre alinhada com a operação real do hotel.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
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
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          icon={MapPin}
          title="Cidade"
          value={hotel.city || 'Não informada'}
          description="Localização exibida no diretório e no painel administrativo."
        />
        <InfoCard
          icon={Clock3}
          title="Check-in"
          value={hotel.checkin_time || '—'}
          description="Horário padrão de entrada apresentado aos hóspedes."
        />
        <InfoCard
          icon={Clock3}
          title="Check-out"
          value={hotel.checkout_time || '—'}
          description="Horário padrão de saída informado no diretório."
        />
        <InfoCard
          icon={Coffee}
          title="Café da manhã"
          value={hotel.breakfast_hours || 'Não informado'}
          description="Horário de serviço publicado para consulta rápida."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <AdminGuideCard
          title="Onboarding rápido de hotel novo"
          description="Use esta tela para finalizar a identidade básica do hotel, confirmar o endereço público principal e revisar a aparência do diretório antes de validar a experiência pública."
        >
          <AdminHelpList
            items={[
              'Preencha primeiro nome, cidade, contatos e links principais para o hotel já ficar identificável.',
              'Depois confirme o subdomínio preferencial e saiba que o slug continua funcionando como fallback seguro.',
              'Escolha o preset visual e revise a rota pública no celular depois de salvar.',
            ]}
          />
        </AdminGuideCard>

        <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Checklist inicial</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                O hotel já está pronto para revisão?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Este resumo ajuda a entender rapidamente o que já está definido e o que ainda vale revisar antes de compartilhar a experiência pública.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <SetupChecklistItem
              title="Identidade do hotel preenchida"
              description={
                hasIdentityReady
                  ? 'Nome e cidade já estão preenchidos para contextualizar o hotel no painel e na experiência pública.'
                  : 'Preencha pelo menos nome e cidade para deixar a identidade do hotel mais clara.'
              }
              completed={hasIdentityReady}
            />
            <SetupChecklistItem
              title="Endereço público definido"
              description={
                hotel.subdomain
                  ? `O subdomínio preferencial já está configurado em ${publicSubdomainPreview}.`
                  : `O hotel ainda pode ser acessado pelo slug em ${slugFallbackPreview}. Configure o subdomínio quando quiser um endereço principal mais curto.`
              }
              completed={hasPublicAddressReady}
            />
            <SetupChecklistItem
              title="Tema visual selecionado"
              description={`O preset atual é ${currentTheme.label}. Ele define a atmosfera visual base da experiência pública.`}
              completed={hasThemeReady}
            />
            <SetupChecklistItem
              title="Experiência pública pronta para revisar"
              description={
                hasPublicReviewReady
                  ? 'Já existe base suficiente para testar a jornada pública e validar links, contatos e apresentação.'
                  : 'Depois de preencher contatos ou links principais, faça um teste rápido na rota pública para revisar a experiência do hóspede.'
              }
              completed={hasPublicReviewReady}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <form
          action={updateHotelAction}
          className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Cadastro principal</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Dados gerais do hotel
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Edite os dados institucionais, horários, conectividade, endereço público e identidade visual do hotel em um único fluxo.
              </p>
            </div>

            <div className="hidden rounded-2xl bg-slate-100 p-3 text-slate-700 md:block">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>

          <AdminGuideCard
            title="Como revisar este formulário"
            description="Este bloco concentra as definições mais importantes para colocar um novo hotel no ar com clareza e consistência."
            className="mt-8"
          >
            <AdminHelpList
              items={[
                'Revise primeiro nome, cidade, WhatsApp e links principais para garantir que o hóspede encontre o hotel certo.',
                'Depois confirme o endereço público preferencial e entenda como o slug continua funcionando como fallback.',
                'Finalize com tema, logo e um teste rápido da rota pública depois de salvar.',
              ]}
            />
          </AdminGuideCard>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Nome do hotel</label>
              <input
                name="name"
                defaultValue={hotel.name || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
              <AdminHelpText>
                Este nome aparece no painel e na experiência pública. Use a forma oficial da marca.
              </AdminHelpText>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Slug público</label>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm font-semibold text-slate-900">{hotel.slug}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  O slug continua como fallback público seguro e mantém compatibilidade com a rota
                  <span className="font-medium"> /hotel/{hotel.slug}</span>.
                </p>
              </div>
              <AdminHelpText>
                Nesta fase, use o subdomínio como endereço principal quando quiser uma URL mais curta. O slug continua disponível para validação e fallback.
              </AdminHelpText>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Subdomínio público
              </label>
              <HotelSubdomainField
                name="subdomain"
                defaultValue={hotel.subdomain || ''}
                slugFallback={hotel.slug}
              />
              <AdminHelpText>
                O endereço público principal continua dentro do domínio operacional atual
                <span className="font-medium"> guestdesk.digital</span>. Se o campo ficar vazio,
                a rota por slug seguirá disponível como fallback seguro.
              </AdminHelpText>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Cidade</label>
              <input
                name="city"
                defaultValue={hotel.city || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
              <AdminHelpText>
                Ajuda a contextualizar o hotel no painel e no material de demonstração.
              </AdminHelpText>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">WhatsApp</label>
              <div className="relative">
                <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="whatsapp_number"
                  defaultValue={hotel.whatsapp_number || ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                  placeholder="5571..."
                />
              </div>
              <AdminHelpText>
                Use o número final que deve receber mensagens do hóspede no formato completo.
              </AdminHelpText>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Link de reservas</label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="booking_url"
                  defaultValue={hotel.booking_url || ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                  placeholder="https://..."
                />
              </div>
              <AdminHelpText>
                Aponte para a página final de reserva para reduzir abandono e cliques perdidos.
              </AdminHelpText>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Link do site</label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="website_url"
                  defaultValue={hotel.website_url || ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                  placeholder="https://..."
                />
              </div>
              <AdminHelpText>
                Use o site institucional quando ele complementar a jornada do diretório com mais detalhes.
              </AdminHelpText>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Instagram</label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="instagram_url"
                  defaultValue={hotel.instagram_url || ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                  placeholder="https://instagram.com/..."
                />
              </div>
              <AdminHelpText>
                Preencha apenas se o perfil estiver ativo e alinhado com a apresentação atual do hotel.
              </AdminHelpText>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Wi-Fi</label>
              <div className="relative">
                <Wifi className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="wifi_name"
                  defaultValue={hotel.wifi_name || ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                />
              </div>
              <AdminHelpText>
                Use o nome de rede mais estável para evitar divergência entre painel e operação.
              </AdminHelpText>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Senha do Wi-Fi</label>
              <input
                name="wifi_password"
                defaultValue={hotel.wifi_password || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
              <AdminHelpText>
                Atualize quando a senha mudar para evitar solicitações recorrentes à recepção.
              </AdminHelpText>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Café da manhã</label>
              <input
                name="breakfast_hours"
                defaultValue={hotel.breakfast_hours || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
              <AdminHelpText>
                Informe o horário real exibido ao hóspede, inclusive quando houver exceções sazonais.
              </AdminHelpText>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Logo URL</label>
              <input
                name="logo_url"
                defaultValue={hotel.logo_url || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                placeholder="https://..."
              />
              <AdminHelpText>
                Use este campo apenas quando a logo já estiver hospedada em uma URL confiável.
              </AdminHelpText>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Preset visual do diretório
              </label>
              <select
                name="theme_preset"
                defaultValue={hotel.theme_preset || DEFAULT_HOTEL_THEME_PRESET}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              >
                {HOTEL_THEME_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <AdminHelpText>
                Escolha uma base visual premium e controlada. O preset define os fundos, a
                atmosfera e os acabamentos principais do diretório.
              </AdminHelpText>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Cor primária opcional
              </label>
              <ThemeColorField
                name="theme_primary_color"
                defaultValue={hotel.theme_primary_color || ''}
                preset={hotel.theme_preset || DEFAULT_HOTEL_THEME_PRESET}
              />
              <AdminHelpText>
                Esta cor afeta apenas acentos seguros, como o CTA principal e pequenos destaques.
                Se estiver vazia ou inválida, o LibGuest usa a cor padrão do preset.
              </AdminHelpText>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Check-in</label>
              <input
                name="checkin_time"
                defaultValue={hotel.checkin_time || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
              <AdminHelpText>
                Este horário aparece como referência rápida na experiência pública.
              </AdminHelpText>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Check-out</label>
              <input
                name="checkout_time"
                defaultValue={hotel.checkout_time || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
              <AdminHelpText>
                Confirme este horário sempre que a operação sofrer ajuste em feriados ou eventos.
              </AdminHelpText>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <AdminPrimaryButton type="submit">Salvar alterações</AdminPrimaryButton>

            <AdminInfoBadge>
              <ShieldCheck className="h-3.5 w-3.5" />
              As alterações serão refletidas no diretório público
            </AdminInfoBadge>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Identidade visual</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  Upload de logo
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Envie a logo oficial para reforçar a identidade do hotel no diretório.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <ImageIcon className="h-5 w-5" />
              </div>
            </div>

            <AdminGuideCard
              title="Boas práticas para a logo"
              description="Use uma imagem limpa e atual para manter a apresentação do LibGuest consistente com a marca do hotel."
              className="mt-6"
            >
              <AdminHelpList
                items={[
                  'Prefira o arquivo oficial mais recente da marca.',
                  'Se possível, use uma imagem quadrada ou com boa área de respiro.',
                  'Depois do upload, confira a visualização pública no celular.',
                ]}
              />
            </AdminGuideCard>

            <div className="mt-6 rounded-[28px] border border-dashed border-slate-200 bg-slate-50/70 p-6">
              {hotel.logo_url ? (
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <img
                    src={hotel.logo_url}
                    alt="Logo do hotel"
                    className="h-24 w-24 rounded-[20px] border border-slate-200 bg-white object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Logo atual carregada</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      A imagem atual já está associada ao diretório do hotel.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-sm leading-6 text-slate-600">
                  Nenhuma logo enviada até o momento.
                </div>
              )}
            </div>

            {hotel.logo_url ? (
              <form action={removeHotelLogoAction} className="mt-4">
                <AdminSecondaryButton type="submit" className="border-red-200 text-red-600 hover:bg-red-50 focus-visible:ring-red-200">
                  Remover logo
                </AdminSecondaryButton>
              </form>
            ) : null}

            <form action={uploadHotelLogoAction} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Selecionar arquivo
                </label>
                <input
                  type="file"
                  name="logo"
                  accept="image/*"
                  required
                  className="block w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm outline-none transition focus:border-slate-300 focus:bg-white focus-visible:ring-2 focus-visible:ring-slate-200"
                />
                <AdminHelpText className="mt-2">
                  Após enviar, revise a visualização pública para confirmar tamanho e leitura da marca.
                </AdminHelpText>
              </div>

              <AdminPrimaryButton type="submit">
                <Upload className="mr-2 h-4 w-4" />
                Enviar logo
              </AdminPrimaryButton>
            </form>
          </div>

          <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
            <p className="text-sm text-slate-500">Resumo visual</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              Estado atual do hotel
            </h2>

            <AdminGuideCard
              title="Checklist rápido antes de validar"
              description="Use este resumo para uma última conferência depois de salvar as definições principais de um hotel novo."
              className="mt-6"
            >
              <AdminHelpList
                items={[
                  'Confirme se a identidade básica do hotel está clara no painel.',
                  'Revise o endereço público principal e saiba qual rota continua disponível por fallback.',
                  'Teste a rota pública para validar tema, horários, contatos e links principais.',
                ]}
              />
            </AdminGuideCard>

            <div className="mt-6 grid gap-4">
              <div className="rounded-[24px] bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Nome em exibição</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{hotel.name}</p>
              </div>

              <div className="rounded-[24px] bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Conectividade</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Wi-Fi: {hotel.wifi_name || 'Não informado'}
                </p>
              </div>

              <div className="rounded-[24px] bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Contato direto</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  WhatsApp: {hotel.whatsapp_number || 'Não informado'}
                </p>
              </div>

              <div className="rounded-[24px] bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Tema público</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{currentTheme.label}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                  Cor primária:{' '}
                  {currentTheme.usesPrimaryOverride ? currentTheme.accentColor : 'preset padrão'}
                </p>
              </div>

              <div className="rounded-[24px] bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">URL pública principal</p>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                  {publicSubdomainPreview}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {hotel.subdomain ? 'subdomínio configurado' : 'fallback atual por slug'}
                </p>
              </div>

              <div className="rounded-[24px] bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Slug de fallback</p>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                  {slugFallbackPreview}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                  compatibilidade pública preservada
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


