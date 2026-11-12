'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { orderRpc, OrderBoundaryError } from '@/lib/fb/orders/rpc.server';
import type { CommercialActionState } from '@/lib/fb/room-commercial';
import { isUuid } from '@/lib/security/identifiers';
import { createClient } from '@/lib/supabase/server';

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
  try {
    await orderRpc<string>(await createClient(), 'save_current_bugan_room_commercial_draft', {
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
  revalidatePath(path);
  redirect(path + '?salvo=1');
}
