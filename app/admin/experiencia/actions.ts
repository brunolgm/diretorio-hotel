'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminAccess } from '@/lib/auth';
import { getCurrentHotelExperienceLayout } from '@/lib/experience-layout-queries';
import { isExperienceBlockKey } from '@/lib/experience-layout';
import { createClient } from '@/lib/supabase/server';

function revalidateExperience() {
  revalidatePath('/admin/experiencia');
  revalidatePath('/hotel/[slug]', 'page');
  revalidatePath('/');
}

export async function updateExperienceBlockAction(formData: FormData) {
  await requireAdminAccess('editor');
  const blockKey = formData.get('block_key');
  const enabled = formData.get('enabled');
  if (typeof blockKey !== 'string' || !isExperienceBlockKey(blockKey) || !['true','false'].includes(String(enabled))) {
    throw new Error('Configuração de bloco inválida.');
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_current_hotel_experience_block', {
    p_block_key: blockKey,
    p_enabled: enabled === 'true',
  });
  if (error) throw new Error('Não foi possível atualizar a visibilidade do bloco.');
  revalidateExperience();
}

export async function moveExperienceBlockAction(formData: FormData) {
  await requireAdminAccess('editor');
  const blockKey = formData.get('block_key');
  const direction = formData.get('direction');
  if (typeof blockKey !== 'string' || !isExperienceBlockKey(blockKey) || !['up','down'].includes(String(direction))) {
    throw new Error('Movimentação de bloco inválida.');
  }
  const layout = await getCurrentHotelExperienceLayout();
  const currentIndex = layout.findIndex((block) => block.blockKey === blockKey);
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= layout.length) return;
  if (blockKey === 'hero' || layout[targetIndex]?.blockKey === 'hero') return;
  const orderedKeys = layout.map((block) => block.blockKey);
  [orderedKeys[currentIndex],orderedKeys[targetIndex]] = [orderedKeys[targetIndex],orderedKeys[currentIndex]];
  const supabase = await createClient();
  const { error } = await supabase.rpc('reorder_current_hotel_experience_blocks', { p_block_keys: orderedKeys });
  if (error) throw new Error('Não foi possível reordenar os blocos.');
  revalidateExperience();
}
