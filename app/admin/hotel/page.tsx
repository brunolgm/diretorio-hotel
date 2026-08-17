import {
  Clock3,
  Coffee,
  Globe,
  ImageIcon,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { HotelSubdomainField } from '@/components/admin/hotel-subdomain-field';
import { ThemeColorField } from '@/components/admin/theme-color-field';
import { FeedbackToast } from '@/components/feedback-toast';
import { HotelReadinessChecklist } from '@/components/readiness/hotel-readiness-checklist';
import { AdminConfirmAction } from '@/components/admin/confirm-action';
import { AdminSubmitButton } from '@/components/admin/form-submit-button';
import {
  AdminHelpText,
  AdminInfoBadge,
  AdminInlineError,
  AdminPageHero,
} from '@/components/admin/ui';
import { requireAdminAccess } from '@/lib/auth';
import {
  DEFAULT_HOTEL_THEME_PRESET,
  getAllowedAdminThemePresets,
  isHotelBrandCode,
  resolveHotelTheme,
} from '@/lib/hotel-theme';
import {
  buildHotelLegacySubdomainPreviewUrl,
  buildHotelSubdomainPreviewUrl,
  getHotelSubdomainRootDomainSummary,
} from '@/lib/hotel-subdomain';
import { getAdminHotel } from '@/lib/queries';
import { getCurrentHotelReadiness } from '@/lib/readiness-queries';
import { removeHotelHeroImageAction, removeHotelLogoAction, updateHotelAction } from './actions';
import { uploadHotelHeroImageAction } from './upload-hero-image-action';
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_-26px_rgba(15,23,42,0.25)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="rounded-xl bg-[var(--admin-accent-soft)] p-2.5 text-[var(--admin-accent)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export default async function AdminHotelPage({ searchParams }: AdminHotelPageProps) {
  await requireAdminAccess('editor');
  const [hotel, readiness] = await Promise.all([getAdminHotel(), getCurrentHotelReadiness()]);
  const allowedThemePresets = getAllowedAdminThemePresets(hotel);
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const error = params?.error;
  const currentTheme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const rootDomains = getHotelSubdomainRootDomainSummary();
  const publicSubdomainPreview =
    buildHotelSubdomainPreviewUrl(hotel.subdomain) || buildHotelSubdomainPreviewUrl(hotel.slug);
  const slugFallbackPreview = buildHotelSubdomainPreviewUrl(hotel.slug);
  const legacySubdomainPreview =
    buildHotelLegacySubdomainPreviewUrl(hotel.subdomain) ||
    buildHotelLegacySubdomainPreviewUrl(hotel.slug);

  return (
    <main className="space-y-6">
      <FeedbackToast success={success} error={error} />
      <AdminInlineError message={error} />

      <AdminPageHero
        eyebrow="Configurações do hotel"
        title="Informações do hotel"
        description="Dados operacionais e apresentação pública do hotel."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          icon={MapPin}
          title="Cidade"
          value={hotel.city || 'Não informada'}
          description="Localização cadastrada"
        />
        <InfoCard
          icon={Clock3}
          title="Check-in"
          value={hotel.checkin_time || '—'}
          description="Entrada dos hóspedes"
        />
        <InfoCard
          icon={Clock3}
          title="Check-out"
          value={hotel.checkout_time || '—'}
          description="Saída dos hóspedes"
        />
        <InfoCard
          icon={Coffee}
          title="Café da manhã"
          value={hotel.breakfast_hours || 'Não informado'}
          description="Horário publicado"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Prontidão</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Checklist de publicação
              </h2>
            </div>

            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4">
            <HotelReadinessChecklist readiness={readiness} variant="admin" />
          </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <form
          action={updateHotelAction}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 [&_input:not([type=file])]:h-11 [&_input:not([type=file])]:rounded-xl [&_input:not([type=file])]:border-slate-300 [&_input:not([type=file])]:bg-white [&_select]:h-11 [&_select]:rounded-xl [&_select]:border-slate-300 [&_select]:bg-white"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Cadastro principal</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Dados do hotel
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Revise os campos por categoria e salve ao final.
              </p>
            </div>

            <div className="hidden rounded-2xl bg-slate-100 p-3 text-slate-700 md:block">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="order-[1] border-b border-slate-200 pb-2 md:col-span-2">
              <h3 className="text-sm font-semibold text-[var(--admin-text-strong)]">Identidade</h3>
            </div>
            <div className="order-[10] border-b border-slate-200 pb-2 md:col-span-2">
              <h3 className="text-sm font-semibold text-[var(--admin-text-strong)]">Operação</h3>
            </div>
            <div className="order-[20] border-b border-slate-200 pb-2 md:col-span-2">
              <h3 className="text-sm font-semibold text-[var(--admin-text-strong)]">Contato</h3>
            </div>
            <div className="order-[30] border-b border-slate-200 pb-2 md:col-span-2">
              <h3 className="text-sm font-semibold text-[var(--admin-text-strong)]">Wi-Fi</h3>
            </div>
            <div className="order-[40] border-b border-slate-200 pb-2 md:col-span-2">
              <h3 className="text-sm font-semibold text-[var(--admin-text-strong)]">Links</h3>
            </div>
            <div id="marca" className="order-[50] scroll-mt-28 border-b border-slate-200 pb-2 md:col-span-2">
              <h3 className="text-sm font-semibold text-[var(--admin-text-strong)]">Marca e mídia</h3>
            </div>

            <div className="order-[2] space-y-2 md:col-span-2">
              <label htmlFor="hotel-name" className="block text-sm font-medium text-slate-700">Nome do hotel</label>
              <input
                id="hotel-name"
                name="name"
                defaultValue={hotel.name || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
              <AdminHelpText>
                Este nome aparece no painel e na experiência pública. Use a forma oficial da marca.
              </AdminHelpText>
            </div>

            <div className="order-[41] space-y-2 md:col-span-2">
              <p className="block text-sm font-medium text-slate-700">Slug público</p>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm font-semibold text-slate-900">{hotel.slug}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Fallback: <span className="font-medium">/hotel/{hotel.slug}</span>
                </p>
              </div>
            </div>

            <div className="order-[42] space-y-2 md:col-span-2">
              <label htmlFor="hotel-subdomain" className="block text-sm font-medium text-slate-700">
                Subdomínio público
              </label>
              <HotelSubdomainField
                id="hotel-subdomain"
                name="subdomain"
                defaultValue={hotel.subdomain || ''}
                slugFallback={hotel.slug}
              />
              <AdminHelpText>Principal em {rootDomains.primary}; sem valor, o slug continua disponível.</AdminHelpText>
            </div>

            <div className="order-[3] space-y-2">
              <label htmlFor="hotel-city" className="block text-sm font-medium text-slate-700">Cidade</label>
              <input
                id="hotel-city"
                name="city"
                defaultValue={hotel.city || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>

            <div className="order-[51] space-y-2 md:col-span-2">
              <label htmlFor="hotel-hero-url" className="block text-sm font-medium text-slate-700">Imagem de capa URL</label>
              <input
                id="hotel-hero-url"
                name="hero_image_url"
                defaultValue={hotel.hero_image_url || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                placeholder="https://..."
              />
              <AdminHelpText>
                URL opcional; sem imagem, o preset fornece o fallback.
              </AdminHelpText>
            </div>

            <div className="order-[21] space-y-2">
              <label htmlFor="hotel-whatsapp" className="block text-sm font-medium text-slate-700">WhatsApp</label>
              <div className="relative">
                <MessageCircle className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="hotel-whatsapp"
                  name="whatsapp_number"
                  defaultValue={hotel.whatsapp_number || ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                  placeholder="5571..."
                />
              </div>
              <AdminHelpText>
                Número completo com código do país.
              </AdminHelpText>
            </div>

            <div className="order-[43] space-y-2 md:col-span-2">
              <label htmlFor="hotel-booking-url" className="block text-sm font-medium text-slate-700">Link de reservas</label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="hotel-booking-url"
                  name="booking_url"
                  defaultValue={hotel.booking_url || ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                  placeholder="https://..."
                />
              </div>
              <AdminHelpText>
                Use a página final de reservas.
              </AdminHelpText>
            </div>

            <div className="order-[44] space-y-2 md:col-span-2">
              <label htmlFor="hotel-website-url" className="block text-sm font-medium text-slate-700">Link do site</label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="hotel-website-url"
                  name="website_url"
                  defaultValue={hotel.website_url || ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="order-[45] space-y-2 md:col-span-2">
              <label htmlFor="hotel-instagram-url" className="block text-sm font-medium text-slate-700">Instagram</label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="hotel-instagram-url"
                  name="instagram_url"
                  defaultValue={hotel.instagram_url || ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                  placeholder="https://instagram.com/..."
                />
              </div>
            </div>

            <div className="order-[31] space-y-2">
              <label htmlFor="hotel-wifi-name" className="block text-sm font-medium text-slate-700">Wi-Fi</label>
              <div className="relative">
                <Wifi className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="hotel-wifi-name"
                  name="wifi_name"
                  defaultValue={hotel.wifi_name || ''}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                />
              </div>
            </div>

            <div className="order-[32] space-y-2">
              <label htmlFor="hotel-wifi-password" className="block text-sm font-medium text-slate-700">Senha do Wi-Fi</label>
              <input
                id="hotel-wifi-password"
                name="wifi_password"
                defaultValue={hotel.wifi_password || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>

            <div className="order-[11] space-y-2">
              <label htmlFor="hotel-breakfast" className="block text-sm font-medium text-slate-700">Café da manhã</label>
              <input
                id="hotel-breakfast"
                name="breakfast_hours"
                defaultValue={hotel.breakfast_hours || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>

            <div className="order-[52] space-y-2">
              <label htmlFor="hotel-logo-url" className="block text-sm font-medium text-slate-700">Logo URL</label>
              <input
                id="hotel-logo-url"
                name="logo_url"
                defaultValue={hotel.logo_url || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                placeholder="https://..."
              />
              <AdminHelpText>
                Use uma URL confiável ou o upload ao lado.
              </AdminHelpText>
            </div>

            <div className="order-[53] space-y-2 md:col-span-2">
              <label htmlFor="hotel-theme-preset" className="block text-sm font-medium text-slate-700">
                Preset visual do diretório
              </label>
              <select
                id="hotel-theme-preset"
                name="theme_preset"
                defaultValue={hotel.theme_preset || DEFAULT_HOTEL_THEME_PRESET}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              >
                {allowedThemePresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <AdminHelpText>
                Define a base visual da experiência pública.
              </AdminHelpText>
              {!isHotelBrandCode(hotel.brand_code) ? (
                <AdminHelpText>
                  A bandeira deste hotel ainda não foi definida pela administração da plataforma.
                </AdminHelpText>
              ) : null}
            </div>

            <div className="order-[54] space-y-2 md:col-span-2">
              <label htmlFor="hotel-theme-color" className="block text-sm font-medium text-slate-700">
                Cor primária opcional
              </label>
              <ThemeColorField
                id="hotel-theme-color"
                name="theme_primary_color"
                defaultValue={hotel.theme_primary_color || ''}
                preset={hotel.theme_preset || DEFAULT_HOTEL_THEME_PRESET}
              />
              <AdminHelpText>
                Opcional; sem valor, usa a cor segura do preset.
              </AdminHelpText>
            </div>

            <div className="order-[12] space-y-2">
              <label htmlFor="hotel-checkin" className="block text-sm font-medium text-slate-700">Check-in</label>
              <input
                id="hotel-checkin"
                name="checkin_time"
                defaultValue={hotel.checkin_time || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>

            <div className="order-[13] space-y-2">
              <label htmlFor="hotel-checkout" className="block text-sm font-medium text-slate-700">Check-out</label>
              <input
                id="hotel-checkout"
                name="checkout_time"
                defaultValue={hotel.checkout_time || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <AdminSubmitButton label="Salvar alterações" pendingLabel="Salvando..." className="w-full sm:w-auto" />

            <AdminInfoBadge>
              <ShieldCheck className="h-3.5 w-3.5" />
              As alterações serão refletidas no diretório público
            </AdminInfoBadge>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Use o arquivo oficial em PNG, JPEG ou WEBP, com boa resolução e área de respiro.
            </p>

            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
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
                      Associada à experiência pública.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Nenhuma logo enviada até o momento
                  </p>
                  <p className="text-sm leading-6 text-slate-600">
                    O fallback visual do preset permanece ativo.
                  </p>
                </div>
              )}
            </div>

            {hotel.logo_url ? (
              <div className="mt-4">
                <AdminConfirmAction action={removeHotelLogoAction} title="Remover logo?" description="A logo deixará de aparecer na experiência pública até que outra seja configurada." triggerLabel="Remover logo" confirmLabel="Remover logo" pendingLabel="Removendo..." />
              </div>
            ) : null}

            <form action={uploadHotelLogoAction} className="mt-4 space-y-4">
              <div>
                <label htmlFor="logo-upload" className="mb-2 block text-sm font-medium text-slate-700">
                  Selecionar arquivo
                </label>
                <input
                  type="file"
                  id="logo-upload"
                  name="logo"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  className="block w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-soft)]"
                />
                <AdminHelpText className="mt-2">
                  Revise tamanho e contraste após o envio.
                </AdminHelpText>
              </div>

              <AdminSubmitButton label="Enviar logo" pendingLabel="Enviando..." className="w-full sm:w-auto" />
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Imagem pública</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  Capa do hotel
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Envie uma imagem horizontal, nítida e aprovada para o hero público.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <ImageIcon className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/70">
              {hotel.hero_image_url ? (
                <div>
                  <div
                    role="img"
                    aria-label={`Imagem de capa de ${hotel.name}`}
                    className="aspect-[16/7] bg-cover bg-center"
                    style={{ backgroundImage: `url(${JSON.stringify(hotel.hero_image_url)})` }}
                  />
                  <p className="p-4 text-sm text-slate-600">Imagem de capa configurada.</p>
                </div>
              ) : (
                <p className="p-6 text-sm leading-6 text-slate-600">
                  Nenhuma imagem de capa configurada. A experiência pública usará o fallback visual do preset.
                </p>
              )}
            </div>

            {hotel.hero_image_url ? (
              <div className="mt-4">
                <AdminConfirmAction action={removeHotelHeroImageAction} title="Remover imagem de capa?" description="A experiência pública voltará a usar o fallback visual seguro do preset." triggerLabel="Remover imagem de capa" confirmLabel="Remover imagem" pendingLabel="Removendo..." />
              </div>
            ) : null}

            <form action={uploadHotelHeroImageAction} className="mt-4 space-y-4">
              <div>
                <label htmlFor="hero-image-upload" className="mb-2 block text-sm font-medium text-slate-700">
                  Selecionar imagem horizontal
                </label>
                <input
                  type="file"
                  id="hero-image-upload"
                  name="hero_image"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  className="block w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--admin-focus)] focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-soft)]"
                />
                <AdminHelpText className="mt-2">
                  JPEG, PNG ou WEBP, até 10 MB. Revise o recorte após o envio.
                </AdminHelpText>
              </div>
              <AdminSubmitButton label="Enviar imagem de capa" pendingLabel="Enviando..." className="w-full sm:w-auto" />
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Resumo técnico</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              Publicação e rotas
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-sm font-semibold text-slate-900">Tema público</p>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className="h-4 w-4 rounded-full ring-1 ring-slate-200"
                    style={{ backgroundColor: currentTheme.accentColor }}
                  />
                  <p className="text-sm leading-6 text-slate-600">{currentTheme.label}</p>
                </div>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {currentTheme.usesPrimaryOverride
                    ? `acento personalizado ${currentTheme.accentColor}`
                    : 'preset padrão sem override de acento'}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-sm font-semibold text-slate-900">URL pública principal</p>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                  {publicSubdomainPreview}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                  {hotel.subdomain ? 'subdomínio preferencial configurado' : 'fallback atual por slug'}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-sm font-semibold text-slate-900">Domínio legado aceito</p>
                <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                  {legacySubdomainPreview}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                  compatibilidade temporária com guestdesk.digital
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
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


