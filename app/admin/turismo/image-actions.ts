'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/security/identifiers';
import { buildHotelAssetStoragePath, IMAGE_UPLOAD_POLICIES, validateImageUpload } from '@/lib/security/image-upload';
import { associateTourismImage, type ImageFeedback, type TourismImageIO } from '@/lib/tourism/image';
import { tourismAdminError } from '@/lib/tourism/admin';
import { buildFeedbackRedirect } from '@/lib/services/translation-admin';

function finish(id: string, feedback: ImageFeedback): never {
  revalidatePath('/admin/turismo'); revalidatePath(`/admin/turismo/${id}`);
  redirect(buildFeedbackRedirect(`/admin/turismo/${id}`, feedback));
}

async function change(form: FormData, remove: boolean) {
  const { profile } = await requireAdminAccess('operador');
  await requireHotelModule('content.tourism');
  const id = String(form.get('id') || '');
  if (!isUuid(id)) redirect('/admin/turismo?error=Item%20inv%C3%A1lido');
  const revision = form.get('expected_updated_at');
  if (typeof revision !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(revision)) finish(id, { error: tourismAdminError({ code: 'PT409' }) });
  const supabase = await createClient();
  const read = async () => {
    const { data, error } = await supabase.from('hotel_tourism_items').select('main_image_path').eq('id', id).eq('hotel_id', profile.hotel_id).maybeSingle();
    if (error || !data) throw new Error('tourism_image_lookup_failed');
    return data.main_image_path;
  };
  let oldPath: string | null;
  try { oldPath = await read(); } catch { finish(id, { error: 'Item não encontrado ou indisponível para este hotel.' }); }
  if (remove && !oldPath) finish(id, { error: 'Este item não possui imagem associada.' });
  let path: string | null = null;
  let validated: Awaited<ReturnType<typeof validateImageUpload>> | undefined;
  if (!remove) {
    const file = form.get('image');
    if (!(file instanceof File) || !file.size) finish(id, { error: 'Selecione uma imagem antes de enviar.' });
    validated = await validateImageUpload(file, IMAGE_UPLOAD_POLICIES.tourism);
    if (!validated.ok) finish(id, { error: validated.reason === 'too_large' ? 'Envie uma imagem de até 2 MiB.' : validated.reason === 'dimensions' ? 'Limites: 6000 × 4000 e 24 milhões de pixels.' : 'Envie uma imagem JPEG, PNG ou WebP válida.' });
    path = buildHotelAssetStoragePath({ hotelId: profile.hotel_id, resourceId: id, category: 'tourism', extension: validated.value.extension });
  }
  const storage = createAdminClient().storage.from('hotel-assets');
  if (path && validated?.ok) {
    const { error } = await storage.upload(path, validated.value.bytes, { contentType: validated.value.mimeType, upsert: false });
    if (error) finish(id, { error: 'Não foi possível enviar a imagem. A associação atual foi preservada.' });
  }
  const io: TourismImageIO = {
    associate: async (newPath, expected) => {
      const { data, error } = await supabase.rpc('update_current_hotel_tourism_image', { p_item_id: id, p_main_image_path: newPath, p_expected_updated_at: expected });
      return { data: data?.[0] || null, error };
    }, read, remove: (ownedPath) => storage.remove([ownedPath]),
    log: (operation, ownedPath) => console.error('Tourism image operation requires attention', {
      operation, hotelId: profile.hotel_id, itemId: id, path: ownedPath,
      oldPath, newPath: path, revision,
    }),
  };
  finish(id, await associateTourismImage({ io, hotelId: profile.hotel_id, itemId: id, oldPath, newPath: path, revision, errorMessage: tourismAdminError }));
}
export async function uploadTourismImageAction(form: FormData) { await change(form, false); }
export async function removeTourismImageAction(form: FormData) { await change(form, true); }
