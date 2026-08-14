export const PLATFORM_DIRECTORY_DEFAULT_PAGE_SIZE = 12;
export const PLATFORM_DIRECTORY_MAX_PAGE_SIZE = 50;
export const PLATFORM_DIRECTORY_MAX_SEARCH_LENGTH = 100;
export const PLATFORM_DIRECTORY_MAX_PAGE = 100000;

export type PlatformHotelDirectoryParams = {
  search: string | null;
  page: number;
  pageSize: number;
};

function readSingleQueryValue(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function parseBoundedInteger({
  value,
  fallback,
  min,
  max,
}: {
  value: unknown;
  fallback: number;
  min: number;
  max: number;
}) {
  const raw = readSingleQueryValue(value);

  if (!raw || !/^\d+$/.test(raw)) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function normalizePlatformDirectoryParams(input: {
  busca?: unknown;
  pagina?: unknown;
  limite?: unknown;
}): PlatformHotelDirectoryParams {
  const rawSearch = readSingleQueryValue(input.busca)?.trim() || null;

  return {
    search: rawSearch?.slice(0, PLATFORM_DIRECTORY_MAX_SEARCH_LENGTH) || null,
    page: parseBoundedInteger({
      value: input.pagina,
      fallback: 1,
      min: 1,
      max: PLATFORM_DIRECTORY_MAX_PAGE,
    }),
    pageSize: parseBoundedInteger({
      value: input.limite,
      fallback: PLATFORM_DIRECTORY_DEFAULT_PAGE_SIZE,
      min: 1,
      max: PLATFORM_DIRECTORY_MAX_PAGE_SIZE,
    }),
  };
}
