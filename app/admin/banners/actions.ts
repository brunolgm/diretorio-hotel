'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAccess } from '@/lib/auth';
import {
  readCheckboxBoolean,
  readNullableString,
  readNumber,
  readOptionalUrl,
  readTrimmedString,
} from '@/lib/form-utils';
import { getAdminHotel } from '@/lib/queries';
import {
  buildFeedbackRedirect,
  buildOperationalErrorMessage,
  formatTranslationWarning,
  logOperationalError,
  syncPromotionalBannerTranslations,
} from '@/lib/services/translation-admin';
import { createClient } from '@/lib/supabase/server';

function readOptionalDateTimeIso(formData: FormData, key: string) {
  const rawValue = readNullableString(formData, key);

  if (!rawValue) {
    return { rawValue: null, isoValue: null };
  }

  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return { rawValue, isoValue: null };
  }

  return { rawValue, isoValue: parsed.toISOString() };
}

function validateBannerWindow({
  startsAt,
  endsAt,
}: {
  startsAt: string | null;
  endsAt: string | null;
}) {
  if (!startsAt || !endsAt) {
    return true;
  }

  return new Date(endsAt).getTime() >= new Date(startsAt).getTime();
}

export async function createPromotionalBannerAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const startsAt = readOptionalDateTimeIso(formData, 'starts_at');
  const endsAt = readOptionalDateTimeIso(formData, 'ends_at');
  const ctaUrlInput = readNullableString(formData, 'cta_url');
  const ctaUrl = readOptionalUrl(formData, 'cta_url');

  if (!title) {
    redirect('/admin/banners?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio');
  }

  if (ctaUrlInput && !ctaUrl) {
    redirect('/admin/banners?error=Informe%20uma%20URL%20v%C3%A1lida%20para%20o%20CTA');
  }

  if (startsAt.rawValue && !startsAt.isoValue) {
    redirect('/admin/banners?error=Informe%20uma%20data%20inicial%20v%C3%A1lida');
  }

  if (endsAt.rawValue && !endsAt.isoValue) {
    redirect('/admin/banners?error=Informe%20uma%20data%20final%20v%C3%A1lida');
  }

  if (!validateBannerWindow({ startsAt: startsAt.isoValue, endsAt: endsAt.isoValue })) {
    redirect(
      '/admin/banners?error=A%20data%20final%20precisa%20ser%20igual%20ou%20posterior%20%C3%A0%20data%20inicial'
    );
  }

  const payload = {
    hotel_id: hotel.id,
    title,
    subtitle: readNullableString(formData, 'subtitle'),
    image_url: null,
    cta_label: readNullableString(formData, 'cta_label'),
    cta_url: ctaUrl,
    starts_at: startsAt.isoValue,
    ends_at: endsAt.isoValue,
    is_active: readCheckboxBoolean(formData, 'is_active'),
    display_order: Math.max(0, readNumber(formData, 'display_order', 0)),
  };

  const { data: banner, error } = await supabase
    .from('hotel_promotional_banners')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    logOperationalError({
      module: 'banners',
      action: 'createPromotionalBannerAction',
      operation: 'create promotional banner',
      hotelId: hotel.id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: buildOperationalErrorMessage(
          'o banner promocional',
          'criar',
          'Revise os campos e tente novamente.'
        ),
      })
    );
  }

  const translationResult = await syncPromotionalBannerTranslations({
    supabase,
    bannerId: banner.id,
    fields: {
      title: payload.title,
      subtitle: payload.subtitle,
      cta_label: payload.cta_label,
    },
  });

  revalidatePath('/admin/banners');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/banners', {
      success: 'Banner promocional criado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

export async function deletePromotionalBannerAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: 'Banner inválido para exclusão.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_promotional_banners')
    .delete()
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    logOperationalError({
      module: 'banners',
      action: 'deletePromotionalBannerAction',
      operation: 'delete promotional banner',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: buildOperationalErrorMessage(
          'o banner promocional',
          'excluir',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath('/admin/banners');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/banners', {
      success: 'Banner promocional excluído com sucesso',
    })
  );
}

export async function togglePromotionalBannerAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');
  const isActive = String(formData.get('is_active') || '') === 'true';

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: 'Banner inválido para atualização de status.',
      })
    );
  }

  const { error } = await supabase
    .from('hotel_promotional_banners')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('hotel_id', hotel.id);

  if (error) {
    logOperationalError({
      module: 'banners',
      action: 'togglePromotionalBannerAction',
      operation: 'update promotional banner status',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: buildOperationalErrorMessage(
          'o status do banner promocional',
          'atualizar',
          'Tente novamente em instantes.'
        ),
      })
    );
  }

  revalidatePath('/admin/banners');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/banners', {
      success: isActive
        ? 'Banner promocional ativado com sucesso'
        : 'Banner promocional desativado com sucesso',
    })
  );
}

export async function retranslatePromotionalBannerAction(formData: FormData) {
  await requireAdminAccess('operador');
  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const id = readTrimmedString(formData, 'id');

  if (!id) {
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: 'Banner inválido para retradução.',
      })
    );
  }

  const { data: banner, error } = await supabase
    .from('hotel_promotional_banners')
    .select('id, title, subtitle, cta_label')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (error || !banner) {
    logOperationalError({
      module: 'banners',
      action: 'retranslatePromotionalBannerAction',
      operation: 'load promotional banner for retranslation',
      hotelId: hotel.id,
      targetId: id,
      error: error || 'Promotional banner not found for retranslation',
    });
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: 'Não foi possível preparar o banner para retradução agora.',
      })
    );
  }

  const translationResult = await syncPromotionalBannerTranslations({
    supabase,
    bannerId: banner.id,
    fields: {
      title: banner.title,
      subtitle: banner.subtitle,
      cta_label: banner.cta_label,
    },
  });

  revalidatePath('/admin/banners');
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect('/admin/banners', {
      success: 'Retradução do banner concluída',
      warning: formatTranslationWarning(translationResult),
    })
  );
}
