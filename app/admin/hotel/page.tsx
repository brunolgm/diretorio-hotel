import {
  Hotel,
  MapPin,
  Wifi,
  Clock3,
  Coffee,
  ImageIcon,
  Globe,
  MessageCircle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { getAdminHotel } from '@/lib/queries';
import { updateHotelAction, removeHotelLogoAction } from './actions';
import { uploadHotelLogoAction } from './upload-logo-action';
import { FeedbackToast } from '@/components/feedback-toast';

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

export default async function AdminHotelPage({
  searchParams,
}: AdminHotelPageProps) {
  const hotel = await getAdminHotel();
  const params = searchParams ? await searchParams : {};
  const success = params?.success;
  const error = params?.error;

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
                Edite os dados institucionais, horários, conectividade e links públicos.
              </p>
            </div>

            <div className="hidden rounded-2xl bg-slate-100 p-3 text-slate-700 md:block">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Nome do hotel</label>
              <input
                name="name"
                defaultValue={hotel.name || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Cidade</label>
              <input
                name="city"
                defaultValue={hotel.city || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
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
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Senha do Wi-Fi</label>
              <input
                name="wifi_password"
                defaultValue={hotel.wifi_password || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Café da manhã</label>
              <input
                name="breakfast_hours"
                defaultValue={hotel.breakfast_hours || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Logo URL</label>
              <input
                name="logo_url"
                defaultValue={hotel.logo_url || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Check-in</label>
              <input
                name="checkin_time"
                defaultValue={hotel.checkin_time || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Check-out</label>
              <input
                name="checkout_time"
                defaultValue={hotel.checkout_time || ''}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none transition focus:border-slate-300 focus:bg-white"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2">
              Salvar alterações
            </button>

            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              As alterações serão refletidas no diretório público
            </div>
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
                <button className="inline-flex h-11 items-center justify-center rounded-2xl border border-red-200 bg-white px-4 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-2">
                  Remover logo
                </button>
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
              </div>

              <button className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2">
                <Upload className="mr-2 h-4 w-4" />
                Enviar logo
              </button>
            </form>
          </div>

          <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
            <p className="text-sm text-slate-500">Resumo visual</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              Estado atual do hotel
            </h2>

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
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
