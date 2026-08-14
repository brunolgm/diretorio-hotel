import 'server-only';

import { requirePlatformAccess } from '@/lib/platform-auth';
import type { PlatformHotelDirectoryParams } from '@/lib/platform-directory';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

export { normalizePlatformDirectoryParams } from '@/lib/platform-directory';

export type PlatformHotelDirectoryItem = {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  city: string | null;
  brandCode: string | null;
  themePreset: string | null;
  logoUrl: string | null;
};

function normalizeBrandMetrics(value: Json): Record<string, number> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([brandCode, count]) =>
      typeof count === 'number' && Number.isFinite(count) && count >= 0
        ? [[brandCode, count]]
        : []
    )
  );
}

export async function getPlatformHotelMetrics() {
  await requirePlatformAccess();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_platform_hotel_metrics');
  const metrics = data?.[0];

  if (error || !metrics) {
    throw new Error('Não foi possível carregar as métricas globais de hotéis.');
  }

  return {
    totalHotels: Number(metrics.total_hotels),
    hotelsByBrand: normalizeBrandMetrics(metrics.hotels_by_brand),
  };
}

export async function listPlatformHotels(params: PlatformHotelDirectoryParams) {
  await requirePlatformAccess();
  const supabase = await createClient();
  const loadPage = (page: number) =>
    supabase.rpc('list_platform_hotels', {
      p_search: params.search,
      p_page: page,
      p_page_size: params.pageSize,
    });

  let resolvedPage = params.page;
  let { data, error } = await loadPage(resolvedPage);

  if (error) {
    throw new Error('Não foi possível carregar o diretório global de hotéis.');
  }

  if (!data?.length && resolvedPage > 1) {
    resolvedPage = 1;
    const fallback = await loadPage(resolvedPage);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error('Não foi possível carregar o diretório global de hotéis.');
  }

  const rows = data || [];

  return {
    total: Number(rows[0]?.total_count || 0),
    items: rows.map(
      (row): PlatformHotelDirectoryItem => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        subdomain: row.subdomain,
        city: row.city,
        brandCode: row.brand_code,
        themePreset: row.theme_preset,
        logoUrl: row.logo_url,
      })
    ),
    page: resolvedPage,
    pageSize: params.pageSize,
  };
}
