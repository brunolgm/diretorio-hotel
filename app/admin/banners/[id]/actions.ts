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
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

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

function getPromotionalBannerStoragePath({
  imageUrl,
  hotelId,
}: {
  imageUrl: string | null;
  hotelId: string;
}) {
  if (!imageUrl) {
    return null;
  }

  try {
    const url = new URL(imageUrl);
    const publicBucketPath = '/storage/v1/object/public/hotel-assets/';
    const pathIndex = url.pathname.indexOf(publicBucketPath);

    if (pathIndex === -1) {
      return null;
    }

    const storagePath = decodeURIComponent(url.pathname.slice(pathIndex + publicBucketPath.length));

    if (!storagePath.startsWith(`${hotelId}/promotional-banners/`)) {
      return null;
    }

    return storagePath;
  } catch {
    return null;
  }
}

export async function updatePromotionalBannerAction(id: string, formData: FormData) {
  await requireAdminAccess('operador');

  if (!id.trim()) {
    redirect('/admin/banners?error=Banner%20inv%C3%A1lido');
  }

  const supabase = await createClient();
  const hotel = await getAdminHotel();
  const title = readTrimmedString(formData, 'title');
  const startsAt = readOptionalDateTimeIso(formData, 'starts_at');
  const endsAt = readOptionalDateTimeIso(formData, 'ends_at');
  const ctaUrlInput = readNullableString(formData, 'cta_url');
  const ctaUrl = readOptionalUrl(formData, 'cta_url');

  if (!title) {
    redirect(`/admin/banners/${id}?error=T%C3%ADtulo%20%C3%A9%20obrigat%C3%B3rio`);
  }

  if (ctaUrlInput && !ctaUrl) {
    redirect(`/admin/banners/${id}?error=Informe%20uma%20URL%20v%C3%A1lida%20para%20o%20CTA`);
  }

  if (startsAt.rawValue && !startsAt.isoValue) {
    redirect(`/admin/banners/${id}?error=Informe%20uma%20data%20inicial%20v%C3%A1lida`);
  }

  if (endsAt.rawValue && !endsAt.isoValue) {
    redirect(`/admin/banners/${id}?error=Informe%20uma%20data%20final%20v%C3%A1lida`);
  }

  if (!validateBannerWindow({ startsAt: startsAt.isoValue, endsAt: endsAt.isoValue })) {
    redirect(
      `/admin/banners/${id}?error=A%20data%20final%20precisa%20ser%20igual%20ou%20posterior%20%C3%A0%20data%20inicial`
    );
  }

  const payload: Database['public']['Tables']['hotel_promotional_banners']['Update'] = {
    title,
    subtitle: readNullableString(formData, 'subtitle'),
    cta_label: readNullableString(formData, 'cta_label'),
    cta_url: ctaUrl,
    starts_at: startsAt.isoValue,
    ends_at: endsAt.isoValue,
    is_active: readCheckboxBoolean(formData, 'is_active'),
    display_order: Math.max(0, readNumber(formData, 'display_order', 0)),
    updated_at: new Date().toISOString(),
  };

  const { data: updatedBanner, error } = await supabase
    .from('hotel_promotional_banners')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .select('id')
    .maybeSingle();

  if (error || !updatedBanner) {
    logOperationalError({
      module: 'banners',
      action: 'updatePromotionalBannerAction',
      operation: 'update promotional banner',
      hotelId: hotel.id,
      targetId: id,
      error,
    });
    redirect(
      buildFeedbackRedirect('/admin/banners', {
        error: 'Banner n\u00e3o encontrado ou indispon\u00edvel para este hotel.',
      })
    );
  }

  const translationResult = await syncPromotionalBannerTranslations({
    supabase,
    bannerId: updatedBanner.id,
    fields: {
      title: payload.title || '',
      subtitle: payload.subtitle ?? null,
      cta_label: payload.cta_label ?? null,
    },
  });

  revalidatePath('/admin/banners');
  revalidatePath(`/admin/banners/${id}`);
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect(`/admin/banners/${id}`, {
      success: 'Banner promocional atualizado com sucesso',
      warning: formatTranslationWarning(translationResult),
    })
  );
}

export async function removePromotionalBannerImageAction(id: string) {
  await requireAdminAccess('operador');

  if (!id.trim()) {
    redirect('/admin/banners?error=Banner%20inv%C3%A1lido');
  }

  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const hotel = await getAdminHotel();

  const { data: banner, error: bannerError } = await supabase
    .from('hotel_promotional_banners')
    .select('id, image_url')
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .single();

  if (bannerError || !banner) {
    logOperationalError({
      module: 'banners',
      action: 'removePromotionalBannerImageAction',
      operation: 'load promotional banner image for removal',
      hotelId: hotel.id,
      targetId: id,
      error: 'Banner image lookup failed or returned no row',
    });
    redirect(
      buildFeedbackRedirect(`/admin/banners/${id}`, {
        error: 'Não foi possível localizar o banner para remover a imagem.',
      })
    );
  }

  const storagePath = getPromotionalBannerStoragePath({
    imageUrl: banner.image_url,
    hotelId: hotel.id,
  });

  let warning: string | undefined;

  if (banner.image_url && storagePath) {
    const { error: removeError } = await adminSupabase.storage
      .from('hotel-assets')
      .remove([storagePath]);

    if (removeError) {
      logOperationalError({
        module: 'banners',
        action: 'removePromotionalBannerImageAction',
        operation: 'remove promotional banner image from storage',
        hotelId: hotel.id,
        targetId: id,
        error: 'Storage removal failed',
      });
      redirect(
        buildFeedbackRedirect(`/admin/banners/${id}`, {
          error: buildOperationalErrorMessage(
            'a imagem do banner',
            'remover',
            'Tente novamente em instantes.'
          ),
        })
      );
    }
  } else if (banner.image_url) {
    warning =
      'A imagem foi desvinculada do banner, mas não foi possível confirmar a remoção do arquivo antigo no Storage.';
    logOperationalError({
      module: 'banners',
      action: 'removePromotionalBannerImageAction',
      operation: 'derive promotional banner image storage path',
      hotelId: hotel.id,
      targetId: id,
      error: 'Promotional banner image URL did not match the expected storage path',
    });
  }

  const { data: updatedBanner, error: updateError } = await supabase
    .from('hotel_promotional_banners')
    .update({
      image_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('hotel_id', hotel.id)
    .select('id')
    .maybeSingle();

  if (updateError || !updatedBanner) {
    logOperationalError({
      module: 'banners',
      action: 'removePromotionalBannerImageAction',
      operation: 'clear promotional banner image URL',
      hotelId: hotel.id,
      targetId: id,
      error: 'Banner image URL update failed',
    });
    redirect(
      buildFeedbackRedirect(`/admin/banners/${id}`, {
        error: buildOperationalErrorMessage(
          'a imagem do banner',
          'remover',
          'Revise a tela e tente novamente.'
        ),
      })
    );
  }

  revalidatePath('/admin/banners');
  revalidatePath(`/admin/banners/${id}`);
  revalidatePath('/');
  revalidatePath(`/hotel/${hotel.slug}`);

  redirect(
    buildFeedbackRedirect(`/admin/banners/${id}`, {
      success: 'Imagem do banner removida com sucesso',
      warning,
    })
  );
}
