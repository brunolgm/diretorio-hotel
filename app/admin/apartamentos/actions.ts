'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import {
  readCheckboxBoolean,
  readNullableString,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import { generateRoomToken } from '@/lib/room-links';
import {
  buildFeedbackRedirect,
  buildOperationalErrorMessage,
  logOperationalError,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';

const ADMIN_ROOMS_PATH = '/admin/apartamentos';

async function createUniqueRoomToken(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const roomToken = generateRoomToken();
    const { data, error } = await supabase
      .from('hotel_room_links')
      .select('id')
      .eq('room_token', roomToken)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return roomToken;
    }
  }

  throw new Error('Unable to generate unique room token');
}

export async function createRoomLinkAction(formData: FormData) {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const roomNumber = readTrimmedString(formData, 'room_number');
  const restaurantMenuUrlInput = readNullableString(formData, 'restaurant_menu_url');
  const restaurantMenuUrl = readOptionalUrl(formData, 'restaurant_menu_url');

  if (!roomNumber) {
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: 'Informe o número do apartamento.',
      })
    );
  }

  if (restaurantMenuUrlInput && !restaurantMenuUrl) {
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: 'Informe uma URL válida para o cardápio do apartamento.',
      })
    );
  }

  try {
    const roomToken = await createUniqueRoomToken(supabase);
    const { error } = await supabase.from('hotel_room_links').insert({
      hotel_id: hotel.id,
      room_number: roomNumber,
      label: readNullableString(formData, 'label'),
      room_token: roomToken,
      restaurant_menu_url: restaurantMenuUrl,
      is_active: readCheckboxBoolean(formData, 'is_active'),
      notes: readNullableString(formData, 'notes'),
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    logOperationalError({
      module: 'room-links',
      action: 'createRoomLinkAction',
      operation: 'create room link',
      hotelId: hotel.id,
      error,
    });
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: buildOperationalErrorMessage(
          'o apartamento',
          'criar',
          'Revise os campos e tente novamente.'
        ),
      })
    );
  }

  revalidatePath(ADMIN_ROOMS_PATH);
  redirect(
    buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
      success: 'Apartamento criado com sucesso.',
    })
  );
}

export async function updateRoomLinkAction(formData: FormData) {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const roomNumber = readTrimmedString(formData, 'room_number');
  const restaurantMenuUrlInput = readNullableString(formData, 'restaurant_menu_url');
  const restaurantMenuUrl = readOptionalUrl(formData, 'restaurant_menu_url');

  if (!id) {
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: 'Apartamento inválido para edição.',
      })
    );
  }

  if (!roomNumber) {
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: 'Informe o número do apartamento.',
      })
    );
  }

  if (restaurantMenuUrlInput && !restaurantMenuUrl) {
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: 'Informe uma URL válida para o cardápio do apartamento.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_room_links')
    .update({
      room_number: roomNumber,
      label: readNullableString(formData, 'label'),
      restaurant_menu_url: restaurantMenuUrl,
      is_active: readCheckboxBoolean(formData, 'is_active'),
      notes: readNullableString(formData, 'notes'),
    })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    logOperationalError({
      module: 'room-links',
      action: 'updateRoomLinkAction',
      operation: 'update room link',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: buildOperationalErrorMessage(
          'o apartamento',
          'atualizar',
          'Revise os dados e tente novamente.'
        ),
      })
    );
  }

  revalidatePath(ADMIN_ROOMS_PATH);
  redirect(
    buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
      success: 'Apartamento atualizado com sucesso.',
    })
  );
}

export async function toggleRoomLinkStatusAction(formData: FormData) {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const isActive = String(formData.get('is_active') || '') === 'true';

  if (!id) {
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: 'Apartamento inválido para atualização de status.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_room_links')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    logOperationalError({
      module: 'room-links',
      action: 'toggleRoomLinkStatusAction',
      operation: 'update room link status',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: buildOperationalErrorMessage(
          'o status do apartamento',
          'atualizar',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath(ADMIN_ROOMS_PATH);
  redirect(
    buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
      success: isActive ? 'Apartamento reativado com sucesso.' : 'Apartamento inativado com sucesso.',
    })
  );
}

export async function regenerateRoomTokenAction(formData: FormData) {
  await requireAdminAccess('editor');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: 'Apartamento inválido para regenerar o QR.',
      })
    );
  }

  try {
    const roomToken = await createUniqueRoomToken(supabase);
    const { error } = await supabase
      .from('hotel_room_links')
      .update({
        room_token: roomToken,
        last_token_rotated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('hotel_id', hotel.id);

    if (error) {
      throw error;
    }
  } catch (error) {
    logOperationalError({
      module: 'room-links',
      action: 'regenerateRoomTokenAction',
      operation: 'regenerate room token',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
        error: buildOperationalErrorMessage(
          'o QR do apartamento',
          'regenerar',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath(ADMIN_ROOMS_PATH);
  redirect(
    buildFeedbackRedirect(ADMIN_ROOMS_PATH, {
      success: 'QR do apartamento regenerado com sucesso.',
    })
  );
}
