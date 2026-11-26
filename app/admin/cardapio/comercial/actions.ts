'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { hasHotelModule, requireHotelModule } from '@/lib/admin-entitlements';
import { orderRpc, OrderBoundaryError } from '@/lib/fb/orders/rpc.server';
import type { CommercialActionState } from '@/lib/fb/room-commercial';
import { isUuid } from '@/lib/security/identifiers';
import { createClient } from '@/lib/supabase/server';
import { translateFbFields } from '@/lib/services/translation-service';
import { syncRoomCommercialTranslations } from '@/lib/fb/room-commercial-translations';
import type { RoomNameRow } from '@/lib/fb/room-name-translations';

const path = '/admin/cardapio/comercial';

export async function saveRoomCommercialDraft(_: CommercialActionState, form: FormData): Promise<CommercialActionState> {
  await requireAdminAccess('editor');
  await requireHotelModule('fb.menu');
  const kind = form.get('kind');
  const rawId = form.get('id');
  const id = typeof rawId === 'string' && rawId ? rawId : null;
  const revision = Number(form.get('revision'));
  const value = form.get('draft');
  if ((kind !== 'combo' && kind !== 'group') || (id && !isUuid(id)) ||
      !Number.isSafeInteger(revision) || revision < 0 || typeof value !== 'string' || value.length > 12000) {
    return { error: 'Revise os campos do rascunho.' };
  }
  let draft: unknown;
  try {
    draft = JSON.parse(value);
  } catch {
    return { error: 'Revise os campos do rascunho.' };
  }
  const client = await createClient();
  let savedId: string;
  try {
    savedId = await orderRpc<string>(client, 'save_current_bugan_room_commercial_draft', {
      p_kind: kind, p_id: id, p_revision: revision, p_draft: draft,
    });
  } catch (error) {
    if (error instanceof OrderBoundaryError) {
      if (error.status === 409) return { error: 'O rascunho mudou. Reabra a versão atual antes de salvar.' };
      if (error.status === 403) return { error: 'Este acesso não pode editar o rascunho do Room Service.' };
      if (error.status === 400) return { error: 'Confira produtos, escolhas obrigatórias e valores em reais.' };
    }
    return { error: 'Não foi possível salvar o rascunho. Confira a lista antes de tentar novamente.' };
  }
  // The Portuguese draft has already committed. Never invite a duplicate retry if translation fails.
  let translationStatus = 'pending';
  try {
    const result = await syncRoomCommercialTranslations({
      languagesEnabled: () => hasHotelModule('content.languages'),
      load: () => orderRpc<RoomNameRow[]>(client, 'get_current_bugan_room_commercial_translation_targets', {p_kind:kind,p_id:savedId}),
      translate: translateFbFields,
      save: args => orderRpc<boolean>(client, 'save_current_bugan_room_automatic_translation', args),
    });
    translationStatus = result.disabled ? 'disabled' : result.pending ? 'pending' : 'complete';
  } catch { /* Keep the saved draft and expose the pending state. */ }
  revalidatePath(path);
  revalidatePath(path + '/traducoes');
  redirect(path + '?salvo=1&traducoes=' + translationStatus);
}
