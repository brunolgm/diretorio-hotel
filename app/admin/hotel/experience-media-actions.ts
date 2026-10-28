'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildHotelAssetStoragePath, IMAGE_UPLOAD_POLICIES, validateImageUpload } from '@/lib/security/image-upload';
import { cleanupExperienceMedia, experienceHttpsUrl, isExperienceMediaSlot, EXPERIENCE_MEDIA_UPLOAD_MAX_BYTES } from '@/lib/public-experience-media';

export async function updateExperienceMediaAction(form: FormData) {
  const { profile } = await requireAdminAccess('editor');
  await requireHotelModule('experience.appearance');
  const finish: (message: string, warning?: boolean) => never = (message, warning = false) => {
    revalidatePath('/admin/hotel'); revalidatePath('/', 'layout');
    redirect(`/admin/hotel?${warning ? 'error' : 'success'}=${encodeURIComponent(message)}`);
  };
  const slot = form.get('slot');
  const revision = Number(form.get('revision'));
  if (!isExperienceMediaSlot(slot) || !Number.isSafeInteger(revision) || revision < 0) finish('Dados de mídia inválidos.', true);
  const client = await createClient();
  const { data: previous, error: readError } = await client.from('hotel_public_experience_media').select('*').eq('hotel_id', profile.hotel_id).eq('slot', slot).maybeSingle();
  if (readError || (previous?.revision ?? 0) !== revision) finish('A configuração mudou. Recarregue antes de salvar.', true);
  const values = {
    image_path: previous?.image_path ?? null,
    mobile_image_path: previous?.mobile_image_path ?? null,
    focal_x: Number(form.get('focal_x')), focal_y: Number(form.get('focal_y')),
    mobile_focal_x: Number(form.get('mobile_focal_x')), mobile_focal_y: Number(form.get('mobile_focal_y')),
    alt_text: String(form.get('alt_text') ?? '').trim(), title: String(form.get('title') ?? '').trim(),
    description: String(form.get('description') ?? '').trim(), cta_label: String(form.get('cta_label') ?? '').trim(),
    cta_url: experienceHttpsUrl(String(form.get('cta_url') ?? '').trim()), is_published: form.get('is_published') === 'on',
  };
  if ([values.focal_x, values.focal_y, values.mobile_focal_x, values.mobile_focal_y].some(n => !Number.isFinite(n) || n < 0 || n > 100)
    || values.title.length > 160 || values.description.length > 4000 || values.alt_text.length > 300 || values.cta_label.length > 80
    || (form.get('cta_url') && !values.cta_url)) finish('Revise os textos, o destino HTTPS e os pontos focais.', true);
  const uploads: { key: 'image_path' | 'mobile_image_path'; bytes: Uint8Array; contentType: string; path: string }[] = [];
  // Validate every file before the first Storage write.
  for (const key of ['image_path', 'mobile_image_path'] as const) {
    if (form.get(`remove_${key}`) === 'on') values[key] = null;
    const file = form.get(key === 'image_path' ? 'desktop_image' : 'mobile_image');
    if (file instanceof File && file.size) {
      const validated = await validateImageUpload(file, { ...IMAGE_UPLOAD_POLICIES.hero, maxBytes: EXPERIENCE_MEDIA_UPLOAD_MAX_BYTES });
      if (!validated.ok) finish('Envie JPEG, PNG ou WebP válido, até 2 MiB, 8192 × 8192 e 40 milhões de pixels.', true);
      const path = buildHotelAssetStoragePath({ hotelId: profile.hotel_id, category: 'hero', resourceId: slot, extension: validated.value.extension });
      values[key] = path;
      uploads.push({ key, path, bytes: validated.value.bytes, contentType: validated.value.mimeType });
    }
  }
  if (uploads.reduce((total, upload) => total + upload.bytes.byteLength, 0) > EXPERIENCE_MEDIA_UPLOAD_MAX_BYTES) finish('As imagens deste envio devem somar no máximo 2 MiB. Envie as variantes separadamente se necessário.', true);
  if ((values.image_path || values.mobile_image_path) && !values.alt_text) finish('Informe o texto alternativo da fotografia.', true);
  if (values.is_published && !values.title) finish('Informe o título antes de publicar.', true);
  const storage = createAdminClient().storage.from('hotel-assets');
  const uploaded: string[] = [];
  const cleanup = (paths: (string | null)[], currentPaths: (string | null)[]) => cleanupExperienceMedia({
    hotelId: profile.hotel_id, slot, paths, currentPaths, remove: path => storage.remove([path]),
    log: path => console.error('Experience media cleanup requires attention', { hotelId: profile.hotel_id, slot, revision, path }),
  });
  for (const upload of uploads) {
    const { error } = await storage.upload(upload.path, upload.bytes, { upsert: false, contentType: upload.contentType });
    if (error) {
      await cleanup(uploaded, [previous?.image_path ?? null, previous?.mobile_image_path ?? null]);
      finish('O envio falhou. A associação anterior foi preservada.', true);
    }
    uploaded.push(upload.path);
  }
  let result: Awaited<ReturnType<typeof client.rpc<'update_current_hotel_experience_media'>>>;
  try { result = await client.rpc('update_current_hotel_experience_media', { p_slot: slot, p_expected_revision: revision, p_values: values }); }
  catch { finish('Resposta incerta. Nenhum arquivo foi removido. Recarregue para conferir o resultado.', true); }
  if (result.error || !result.data?.[0]) {
    // Only a definitive PostgreSQL rejection is safe for upload compensation.
    const code = result.error?.code;
    if (code && /^[A-Z0-9]{5}$/.test(code) && !code.startsWith('08') && !['57014', '57P01', '57P02', '57P03'].includes(code)) {
      await cleanup(uploaded, [previous?.image_path ?? null, previous?.mobile_image_path ?? null]);
      finish(code === 'PT409' ? 'A configuração mudou. Recarregue antes de salvar.' : 'A configuração foi rejeitada. Revise os dados.', true);
    }
    finish('Não foi possível confirmar a gravação. Nenhum arquivo foi removido. Recarregue para conferir.', true);
  }
  const saved = result.data[0];
  if (saved.revision !== revision + 1 || ![saved.previous_image_path, saved.previous_mobile_image_path].every(path => path === null || typeof path === 'string')) {
    finish('Resposta de gravação incompleta. Nenhum arquivo foi removido. Recarregue para conferir.', true);
  }
  const cleaned = await cleanup([saved.previous_image_path, saved.previous_mobile_image_path], [values.image_path, values.mobile_image_path]);
  finish(cleaned ? 'Mídia e conteúdo atualizados.' : 'Alteração salva; o arquivo anterior precisa de limpeza posterior.', !cleaned);
}
