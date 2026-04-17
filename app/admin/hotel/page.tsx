import { getAdminHotel } from '@/lib/queries';
import { updateHotelAction } from './actions';
import { uploadHotelLogoAction } from './upload-logo-action';
import { FeedbackToast } from '@/components/feedback-toast';

interface AdminHotelPageProps {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
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

      <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70">
        <p className="text-sm text-slate-500">Configurações</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Informações do hotel
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Atualize os dados principais do diretório digital.
        </p>
      </div>

      <form
        action={updateHotelAction}
        className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Nome do hotel</label>
            <input
              name="name"
              defaultValue={hotel.name || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Cidade</label>
            <input
              name="city"
              defaultValue={hotel.city || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">WhatsApp</label>
            <input
              name="whatsapp_number"
              defaultValue={hotel.whatsapp_number || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Link de reservas</label>
            <input
              name="booking_url"
              defaultValue={hotel.booking_url || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Link do site</label>
            <input
              name="website_url"
              defaultValue={hotel.website_url || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium">Instagram</label>
            <input
              name="instagram_url"
              defaultValue={hotel.instagram_url || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Wi-Fi</label>
            <input
              name="wifi_name"
              defaultValue={hotel.wifi_name || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Senha do Wi-Fi</label>
            <input
              name="wifi_password"
              defaultValue={hotel.wifi_password || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Café da manhã</label>
            <input
              name="breakfast_hours"
              defaultValue={hotel.breakfast_hours || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Logo URL</label>
            <input
              name="logo_url"
              defaultValue={hotel.logo_url || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Check-in</label>
            <input
              name="checkin_time"
              defaultValue={hotel.checkin_time || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Check-out</label>
            <input
              name="checkout_time"
              defaultValue={hotel.checkout_time || ''}
              className="w-full rounded-2xl border px-4 py-3"
            />
          </div>
        </div>

        <div className="mt-6">
          <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">
            Salvar alterações
          </button>
        </div>
      </form>

      <form
        action={uploadHotelLogoAction}
        className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200/70"
      >
        <h2 className="text-lg font-semibold">Upload de logo</h2>
        <p className="mt-2 text-sm text-slate-600">
          Envie a logo oficial do hotel para exibição no diretório.
        </p>

        {hotel.logo_url ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Logo atual</p>
            <img
              src={hotel.logo_url}
              alt="Logo do hotel"
              className="h-24 w-24 rounded-2xl border object-cover"
            />
          </div>
        ) : null}

        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium">Selecionar arquivo</label>
          <input
            type="file"
            name="logo"
            accept="image/*"
            required
            className="block w-full rounded-2xl border px-4 py-3"
          />
        </div>

        <div className="mt-6">
          <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">
            Enviar logo
          </button>
        </div>
      </form>
    </main>
  );
}