'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/security/identifiers';
import { buildFeedbackRedirect, formatTourismTranslationFeedback, syncTourismTranslations } from '@/lib/services/translation-admin';
import { moveTourismOrder, tourismAdminError, tourismFormPatch, type TourismFormState } from '@/lib/tourism/admin';

async function requireTourismOperator() {
  const context = await requireAdminAccess('operador');
  await requireHotelModule('content.tourism');
  return { ...context, supabase: await createClient() };
}

function revisionFrom(form: FormData): string {
  const value = form.get('expected_updated_at');
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('tourism_revision_conflict');
  return value;
}

function fail(error: { code?: string; message?: string }): never {
  redirect(buildFeedbackRedirect('/admin/turismo', { error: tourismAdminError(error) }));
}

function finish(message: string, id?: string, feedback: { success?: string; warning?: string } = {}): never {
  revalidatePath('/admin/turismo');
  if (id) revalidatePath(`/admin/turismo/${id}`);
  redirect(buildFeedbackRedirect(id ? `/admin/turismo/${id}` : '/admin/turismo', {
    ...feedback, success: feedback.success ? `${message} ${feedback.success}` : message,
  }));
}

export async function createTourismItemAction(_state: TourismFormState, form: FormData): Promise<TourismFormState> {
  const { supabase } = await requireTourismOperator();
  let patch;
  try { patch = tourismFormPatch(form); }
  catch (error) { return { error: tourismAdminError(error as Error) }; }
  const { data, error } = await supabase.rpc('save_current_hotel_tourism_item', { p_item_id: null, p_changes: patch });
  if (error || !data?.[0]) return { error: tourismAdminError(error || {}) };
  const translation = await syncTourismTranslations({ supabase, item: data[0] });
  finish('Item de Turismo criado.', data[0].id, formatTourismTranslationFeedback(translation));
}

export async function updateTourismItemAction(id: string, _state: TourismFormState, form: FormData): Promise<TourismFormState> {
  const { supabase } = await requireTourismOperator();
  if (!isUuid(id)) return { error: 'Item inválido.' };
  let patch; let revision;
  try { patch = tourismFormPatch(form); revision = revisionFrom(form); }
  catch (error) { return { error: tourismAdminError(error as Error) }; }
  const { data, error } = await supabase.rpc('save_current_hotel_tourism_item', { p_item_id: id, p_changes: patch, p_expected_updated_at: revision });
  if (error) return { error: tourismAdminError(error) };
  if (!data?.[0]) finish('Item de Turismo atualizado.', id, { warning: 'Conteúdo salvo em português, mas não foi possível preparar as traduções.' });
  const translation = await syncTourismTranslations({ supabase, item: data[0] });
  finish('Item de Turismo atualizado.', id, formatTourismTranslationFeedback(translation));
}

export async function retranslateTourismItemAction(form: FormData) {
  const { profile, supabase } = await requireTourismOperator();
  const id = String(form.get('id') || '');
  if (!isUuid(id)) fail({});
  let revision;
  try { revision = revisionFrom(form); } catch (error) { fail(error as Error); }
  const { data: item, error } = await supabase.from('hotel_tourism_items').select('*')
    .eq('id', id).eq('hotel_id', profile.hotel_id).maybeSingle();
  if (error || !item) fail(error || { code: 'P0002' });
  // Explicit manual request: load the source, but never substitute a newer revision.
  if (item.updated_at !== revision) fail({ message: 'tourism_revision_conflict' });
  const translation = await syncTourismTranslations({ supabase, item });
  finish('Conteúdo em português preservado.', id, formatTourismTranslationFeedback(translation));
}

export async function publishTourismItemAction(form: FormData) {
  const { supabase } = await requireTourismOperator();
  const id = String(form.get('id') || '');
  const published = form.get('is_published');
  if (!isUuid(id) || !['true', 'false'].includes(String(published))) fail({});
  let revision;
  try { revision = revisionFrom(form); } catch (error) { fail(error as Error); }
  const { error } = await supabase.rpc('save_current_hotel_tourism_item', {
    p_item_id: id, p_changes: { is_published: published === 'true' }, p_expected_updated_at: revision,
  });
  if (error) fail(error);
  revalidatePath(`/admin/turismo/${id}`);
  finish(published === 'true' ? 'Item publicado.' : 'Item despublicado.');
}

export async function moveTourismItemAction(form: FormData) {
  const { profile, supabase } = await requireTourismOperator();
  const id = String(form.get('id') || '');
  if (!isUuid(id)) fail({});
  const { data, error: readError } = await supabase.from('hotel_tourism_items').select('id')
    .eq('hotel_id', profile.hotel_id).order('sort_order').order('id');
  if (readError) fail(readError);
  let ordered;
  try { ordered = moveTourismOrder((data || []).map((item) => item.id), id, String(form.get('direction'))); }
  catch (error) { fail(error as Error); }
  if (!ordered) redirect('/admin/turismo');
  const { error } = await supabase.rpc('reorder_current_hotel_tourism_items', { p_item_ids: ordered });
  if (error) fail(error);
  revalidatePath('/admin/turismo/[id]', 'page');
  finish('Ordem dos itens atualizada.');
}

export async function deleteTourismItemAction(form: FormData) {
  const { profile, supabase } = await requireTourismOperator();
  const id = String(form.get('id') || '');
  if (!isUuid(id)) fail({});
  let revision;
  try { revision = revisionFrom(form); } catch (error) { fail(error as Error); }
  // B1 cannot clean Storage. Block existing images; the original revision also
  // prevents deletion if an image is associated between this read and the RPC.
  const { data, error: readError } = await supabase.from('hotel_tourism_items').select('main_image_path')
    .eq('id', id).eq('hotel_id', profile.hotel_id).maybeSingle();
  if (readError || !data) fail(readError || { code: 'P0002' });
  if (data.main_image_path) redirect(buildFeedbackRedirect('/admin/turismo', {
    error: 'Este item possui imagem. A exclusão com limpeza da imagem estará disponível na etapa de imagens. Você pode despublicá-lo.',
  }));
  const { error } = await supabase.rpc('delete_current_hotel_tourism_item', { p_item_id: id, p_expected_updated_at: revision });
  if (error) fail(error);
  revalidatePath(`/admin/turismo/${id}`);
  finish('Item excluído definitivamente.');
}
