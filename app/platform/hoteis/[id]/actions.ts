'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readNullableString, readTrimmedString } from '@/lib/form-utils';
import { requirePlatformAccess } from '@/lib/platform-auth';
import {
  isAllowedPlatformHotelStatusTransition,
  normalizePlatformHotelBrand,
  normalizePlatformHotelStatus,
} from '@/lib/platform-governance';
import { isUuid } from '@/lib/security/identifiers';
import { createClient } from '@/lib/supabase/server';
import { isModuleKey } from '@/lib/modules/catalog';

function feedbackUrl(hotelId: string, kind: 'success' | 'error', message: string) {
  const query = new URLSearchParams({ [kind]: message });
  return `/platform/hoteis/${hotelId}?${query.toString()}`;
}

function revalidatePlatformHotel(hotelId: string) {
  revalidatePath('/platform');
  revalidatePath('/platform/hoteis');
  revalidatePath(`/platform/hoteis/${hotelId}`);
}

export async function updatePlatformHotelBrandAction(formData: FormData) {
  await requirePlatformAccess();

  const hotelId = readTrimmedString(formData, 'hotel_id');
  const rawBrand = readNullableString(formData, 'brand_code');
  const brandCode = normalizePlatformHotelBrand(rawBrand);

  if (!isUuid(hotelId)) {
    redirect('/platform/hoteis?error=Hotel%20inv%C3%A1lido.');
  }

  if (brandCode === undefined) {
    redirect(feedbackUrl(hotelId, 'error', 'Selecione uma bandeira canônica.'));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_platform_hotel_brand', {
    p_hotel_id: hotelId,
    p_brand_code: brandCode,
  });

  if (error) {
    redirect(
      feedbackUrl(
        hotelId,
        'error',
        error.message.includes('unchanged')
          ? 'A bandeira selecionada já é a bandeira atual.'
          : 'Não foi possível atualizar a bandeira com segurança.'
      )
    );
  }

  revalidatePlatformHotel(hotelId);
  redirect(feedbackUrl(hotelId, 'success', 'Bandeira atualizada e auditada.'));
}

export async function updatePlatformHotelStatusAction(formData: FormData) {
  await requirePlatformAccess();

  const hotelId = readTrimmedString(formData, 'hotel_id');
  const currentStatus = normalizePlatformHotelStatus(readTrimmedString(formData, 'current_status'));
  const nextStatus = normalizePlatformHotelStatus(readTrimmedString(formData, 'platform_status'));

  if (!isUuid(hotelId)) {
    redirect('/platform/hoteis?error=Hotel%20inv%C3%A1lido.');
  }

  if (!currentStatus || !nextStatus || !isAllowedPlatformHotelStatusTransition(currentStatus, nextStatus)) {
    redirect(feedbackUrl(hotelId, 'error', 'Transição de lifecycle inválida. Atualize a página.'));
  }

  const supabase = await createClient();
  if (currentStatus === 'draft' && nextStatus === 'active') {
    const { data: readinessRows, error: readinessError } = await supabase.rpc(
      'get_platform_hotel_readiness',
      { p_hotel_id: hotelId }
    );
    if (readinessError || !readinessRows?.[0]?.ready_to_activate) {
      redirect(feedbackUrl(hotelId, 'error', 'Este hotel ainda possui pendências bloqueantes.'));
    }
  }
  const { error } = await supabase.rpc('update_platform_hotel_status', {
    p_hotel_id: hotelId,
    p_status: nextStatus,
  });

  if (error) {
    if (error.message.includes('platform_hotel_not_ready')) {
      redirect(feedbackUrl(hotelId, 'error', 'Este hotel ainda possui pendências bloqueantes.'));
    }
    redirect(
      feedbackUrl(
        hotelId,
        'error',
        'Não foi possível alterar o lifecycle. O estado pode ter mudado; atualize a página.'
      )
    );
  }

  revalidatePlatformHotel(hotelId);
  redirect(feedbackUrl(hotelId, 'success', 'Lifecycle atualizado e auditado.'));
}

export async function updatePlatformHotelModuleAction(formData: FormData) {
  await requirePlatformAccess();
  const hotelId = readTrimmedString(formData, 'hotel_id');
  const moduleKey = readTrimmedString(formData, 'module_key');
  const rawEnabled = readTrimmedString(formData, 'enabled');
  if (!isUuid(hotelId) || !isModuleKey(moduleKey) || !['true', 'false'].includes(rawEnabled)) redirect('/platform/hoteis?error=Módulo%20inválido.');
  const enabled = rawEnabled === 'true';

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_platform_hotel_module', { p_hotel_id: hotelId, p_module_key: moduleKey, p_enabled: enabled });
  if (error) {
    redirect(feedbackUrl(hotelId, 'error', error.message.includes('dependency_required') ? 'O diretório principal é obrigatório.' : 'Não foi possível atualizar o módulo com segurança.'));
  }
  revalidatePlatformHotel(hotelId);
  redirect(feedbackUrl(hotelId, 'success', enabled ? 'Módulo habilitado e auditado.' : 'Módulo desabilitado e auditado.'));
}
