import {hasTranslationFallback,translatedText} from './translation-fallback';
import { parsePublicPresentation, type PublicPresentation } from './public-presentation';
import { loadPublicTourism, publicTourismHomeAvailable } from '@/lib/tourism/public';
import { createPublicClient } from '@/lib/supabase/public';
import { getFlightAirportTimezones } from '@/lib/flights/airport-timezones.server';
import { normalizeExperienceLayout, type ExperienceLayoutBlock } from '@/lib/experience-layout';
import { normalizeHotelSubdomainInput } from '@/lib/hotel-subdomain';
import { type SupportedPublicLanguage } from '@/lib/public-language';
import {
  getPublicNavigationAvailability,
  type PublicNavigationAvailability,
} from '@/lib/public-navigation';
import type { Database } from '@/types/database';
import { localizeExperienceMedia, experienceMediaHasFallback, type ExperienceMedia } from './public-experience-media';
import type { PublicTourismItem } from './tourism/public';

type SupabaseClient = ReturnType<typeof createPublicClient>;

export type PublicHotel = Database['public']['Views']['public_hotels']['Row'];
export type PublicHotelSection = Database['public']['Tables']['hotel_sections']['Row'];
export type PublicHotelDepartment = Database['public']['Tables']['hotel_departments']['Row'];
export type PublicHotelPolicy = Database['public']['Tables']['hotel_policies']['Row'];
export type PublicHotelAnnouncement = Database['public']['Tables']['hotel_announcements']['Row'];
export type PublicHotelPromotionalBanner =
  Database['public']['Tables']['hotel_promotional_banners']['Row'];
type PublicHotelSectionTranslation =
  Database['public']['Tables']['hotel_section_translations']['Row'];
type PublicHotelDepartmentTranslation =
  Database['public']['Tables']['hotel_department_translations']['Row'];
type PublicHotelPolicyTranslation =
  Database['public']['Tables']['hotel_policy_translations']['Row'];
type PublicHotelAnnouncementTranslation =
  Database['public']['Tables']['hotel_announcement_translations']['Row'];
type PublicHotelPromotionalBannerTranslation =
  Database['public']['Tables']['hotel_promotional_banner_translations']['Row'];

export interface PublicHotelPageData {
  serviceFallbackIds?: string[];
  presentation?: PublicPresentation | null;
  experienceMedia?: ExperienceMedia[];
  tourismPreview?: PublicTourismItem[];
  tourismHomeAvailable?: boolean;
  hotel: PublicHotel;
  flightHomeCard: PublicFlightHomeCard | null;
  banners: PublicHotelPromotionalBanner[];
  announcements: PublicHotelAnnouncement[];
  sections: PublicHotelSection[];
  departments: PublicHotelDepartment[];
  policies: PublicHotelPolicy[];
  layout: ExperienceLayoutBlock[];
  hasFallbackContent: boolean;
}

export interface PublicHotelServiceDetailData {
  experienceVersion?: 'v3'|'v4';
  hotel: PublicHotel;
  section: PublicHotelSection;
  hasFallbackContent: boolean;
}

type PublicFlightHomeCardRow =
  Database['public']['Functions']['get_public_hotel_flight_home_card']['Returns'][number];

export interface PublicFlightHomeCard {
  title: string | null;
  description: string | null;
}

type PublicFlightCenterRow =
  Database['public']['Functions']['get_public_hotel_flight_center']['Returns'][number];

export interface PublicFlightCenterAirport {
  timezone: string | null;
  iataCode: string;
  name: string;
  city: string;
  officialDeparturesUrl: string | null;
  officialArrivalsUrl: string | null;
  estimatedTransferMinutes: number | null;
  domesticLeadMinutes: number | null;
  internationalLeadMinutes: number | null;
  safetyMarginMinutes: number | null;
}

export interface PublicFlightCenterData {
  experienceVersion?: 'v3'|'v4';
  hotel: PublicHotel;
  airports: PublicFlightCenterAirport[];
  navigationAvailability: PublicNavigationAvailability;
  settings: {
    departurePlanningEnabled: boolean;
    transferEnabled: boolean;
    wakeUpEnabled: boolean;
    breakfastBoxEnabled: boolean;
    receptionEnabled: boolean;
    officialLinksEnabled: boolean;
    departureNotice: string | null;
  };
}

function normalizePublicHttpsUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function getHotelBySlugWithClient(supabase: SupabaseClient, slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    return null;
  }

  const { data, error } = await supabase
    .from('public_hotels')
    .select('*')
    .eq('slug', normalizedSlug)
    .maybeSingle();

  if (error) {
    console.error('Failed to load hotel by slug:', error);
    return null;
  }

  if (data) return data as PublicHotel;
  const resolved = await supabase.rpc('resolve_public_hotel_slug', { p_slug: normalizedSlug });
  if (resolved.error || !resolved.data || resolved.data === normalizedSlug) return null;
  const canonical = await supabase.from('public_hotels').select('*').eq('slug', resolved.data).maybeSingle();
  return canonical.error ? null : canonical.data as PublicHotel | null;
}

async function getHotelBySubdomainWithClient(supabase: SupabaseClient, subdomain: string) {
  const normalizedSubdomain = normalizeHotelSubdomainInput(subdomain);

  if (!normalizedSubdomain) {
    return null;
  }

  const { data: hotelBySubdomain, error: hotelBySubdomainError } = await supabase
    .from('public_hotels')
    .select('*')
    .eq('subdomain', normalizedSubdomain)
    .maybeSingle();

  if (hotelBySubdomainError) {
    console.error('Failed to load hotel by subdomain:', hotelBySubdomainError);
    return null;
  }

  if (hotelBySubdomain) {
    return hotelBySubdomain as PublicHotel;
  }

  return getHotelBySlugWithClient(supabase, normalizedSubdomain);
}

export async function getPublicHotelPageDataForHotel(
  supabase: SupabaseClient,
  hotel: PublicHotel,
  language: SupportedPublicLanguage,
  authenticatedPreview = false
) {
  const now = new Date().toISOString();
  const [
    { data: banners, error: bannersError },
    { data: announcements, error: announcementsError },
    { data: sections, error: sectionsError },
    { data: departments, error: departmentsError },
    { data: policies, error: policiesError },
    { data: layoutRows, error: layoutError },
    { data: flightHomeCardRows, error: flightHomeCardError },
  ] = await Promise.all([
    supabase
      .from('hotel_promotional_banners')
      .select('*')
      .eq('hotel_id', hotel.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('starts_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('hotel_announcements')
      .select('*')
      .eq('hotel_id', hotel.id)
      .eq('is_active', true)
      .order('starts_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('hotel_sections')
      .select('*')
      .eq('hotel_id', hotel.id)
      .eq('enabled', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('hotel_departments')
      .select('*')
      .eq('hotel_id', hotel.id)
      .eq('enabled', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('hotel_policies')
      .select('*')
      .eq('hotel_id', hotel.id)
      .eq('enabled', true)
      .order('created_at', { ascending: true }),
    authenticatedPreview ? supabase.rpc('get_current_hotel_experience_layout') : supabase.rpc('get_public_hotel_experience_layout', { p_hotel_id: hotel.id }),
    authenticatedPreview ? supabase.from('hotel_flight_settings').select('home_card_title,home_card_description').eq('hotel_id', hotel.id).eq('home_card_enabled', true) : supabase.rpc('get_public_hotel_flight_home_card', { p_hotel_id: hotel.id }),
  ]);

  if (bannersError) {
    console.error('Failed to load hotel promotional banners:', bannersError);
  }
  if (announcementsError) {
    console.error('Failed to load hotel announcements:', announcementsError);
  }
  if (sectionsError) {
    console.error('Failed to load hotel sections:', sectionsError);
  }
  if (departmentsError) {
    console.error('Failed to load hotel departments:', departmentsError);
  }
  if (policiesError) {
    console.error('Failed to load hotel policies:', policiesError);
  }
  if (layoutError) {
    console.error('Failed to load hotel experience layout:', layoutError);
  }
  if (flightHomeCardError) {
    console.error('Failed to load public Flight Center home card:', flightHomeCardError);
  }

  const typedBanners = ((banners || []) as PublicHotelPromotionalBanner[])
    .filter((item) => {
      const startsAtValid = !item.starts_at || item.starts_at <= now;
      const endsAtValid = !item.ends_at || item.ends_at >= now;
      return startsAtValid && endsAtValid;
    })
    .slice(0, 3);
  const typedAnnouncements = ((announcements || []) as PublicHotelAnnouncement[]).filter((item) => {
    const startsAtValid = !item.starts_at || item.starts_at <= now;
    const endsAtValid = !item.ends_at || item.ends_at >= now;
    return startsAtValid && endsAtValid;
  });
  const typedSections = (sections || []) as PublicHotelSection[];
  const typedDepartments = (departments || []) as PublicHotelDepartment[];
  const typedPolicies = (policies || []) as PublicHotelPolicy[];
  const flightHomeCardRow = ((flightHomeCardRows || []) as PublicFlightHomeCardRow[])[0];

  const [
    bannerTranslationsResult,
    announcementTranslationsResult,
    sectionTranslationsResult,
    departmentTranslationsResult,
    policyTranslationsResult,
  ] =
    language === 'pt'
      ? [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]
      : await Promise.all([
          typedBanners.length
            ? supabase
                .from('hotel_promotional_banner_translations')
                .select('*')
                .in(
                  'banner_id',
                  typedBanners.map((item) => item.id)
                )
                .eq('language', language)
            : Promise.resolve({ data: [], error: null }),
          typedAnnouncements.length
            ? supabase
                .from('hotel_announcement_translations')
                .select('*')
                .in(
                  'announcement_id',
                  typedAnnouncements.map((item) => item.id)
                )
                .eq('language', language)
            : Promise.resolve({ data: [], error: null }),
          typedSections.length
            ? supabase
                .from('hotel_section_translations')
                .select('*')
                .in(
                  'section_id',
                  typedSections.map((item) => item.id)
                )
                .eq('language', language)
            : Promise.resolve({ data: [], error: null }),
          typedDepartments.length
            ? supabase
                .from('hotel_department_translations')
                .select('*')
                .in(
                  'department_id',
                  typedDepartments.map((item) => item.id)
                )
                .eq('language', language)
            : Promise.resolve({ data: [], error: null }),
          typedPolicies.length
            ? supabase
                .from('hotel_policy_translations')
                .select('*')
                .in(
                  'policy_id',
                  typedPolicies.map((item) => item.id)
                )
                .eq('language', language)
            : Promise.resolve({ data: [], error: null }),
        ]);

  if (language !== 'pt') {
    if (bannerTranslationsResult.error) {
      console.error('Failed to load banner translations:', bannerTranslationsResult.error);
    }
    if (announcementTranslationsResult.error) {
      console.error(
        'Failed to load announcement translations:',
        announcementTranslationsResult.error
      );
    }
    if (sectionTranslationsResult.error) {
      console.error('Failed to load section translations:', sectionTranslationsResult.error);
    }
    if (departmentTranslationsResult.error) {
      console.error(
        'Failed to load department translations:',
        departmentTranslationsResult.error
      );
    }
    if (policyTranslationsResult.error) {
      console.error('Failed to load policy translations:', policyTranslationsResult.error);
    }
  }

  const bannerTranslations =
    (bannerTranslationsResult.data || []) as PublicHotelPromotionalBannerTranslation[];
  const announcementTranslations =
    (announcementTranslationsResult.data || []) as PublicHotelAnnouncementTranslation[];
  const sectionTranslations = (sectionTranslationsResult.data || []) as PublicHotelSectionTranslation[];
  const departmentTranslations =
    (departmentTranslationsResult.data || []) as PublicHotelDepartmentTranslation[];
  const policyTranslations = (policyTranslationsResult.data || []) as PublicHotelPolicyTranslation[];

  const bannerTranslationsById = new Map(
    bannerTranslations.map((translation) => [translation.banner_id, translation])
  );
  const announcementTranslationsById = new Map(
    announcementTranslations.map((translation) => [translation.announcement_id, translation])
  );
  const sectionTranslationsById = new Map(
    sectionTranslations.map((translation) => [translation.section_id, translation])
  );
  const departmentTranslationsById = new Map(
    departmentTranslations.map((translation) => [translation.department_id, translation])
  );
  const policyTranslationsById = new Map(
    policyTranslations.map((translation) => [translation.policy_id, translation])
  );

  const displayBanners = typedBanners.map((item) => {
    const translation = bannerTranslationsById.get(item.id);

    return {
      ...item,
      title: translatedText(item.title,translation?.title),
      subtitle: translatedText(item.subtitle,translation?.subtitle),
      cta_label: translatedText(item.cta_label,translation?.cta_label),
    };
  });

  const displayAnnouncements = typedAnnouncements.map((item) => {
    const translation = announcementTranslationsById.get(item.id);

    return {
      ...item,
      title: translatedText(item.title,translation?.title),
      body: translatedText(item.body,translation?.body),
    };
  });

  const displaySections = typedSections.map((item) => {
    const translation = sectionTranslationsById.get(item.id);

    return {
      ...item,
      title: translatedText(item.title,translation?.title),
      content: translatedText(item.content,translation?.content),
      cta: translatedText(item.cta,translation?.cta),
      category: translatedText(item.category,translation?.category),
    };
  });

  const displayDepartments = typedDepartments.map((item) => {
    const translation = departmentTranslationsById.get(item.id);

    return {
      ...item,
      name: translatedText(item.name,translation?.name),
      description: translatedText(item.description,translation?.description),
      action: translatedText(item.action,translation?.action),
    };
  });

  const displayPolicies = typedPolicies.map((item) => {
    const translation = policyTranslationsById.get(item.id);

    return {
      ...item,
      title: translatedText(item.title,translation?.title),
      description: translatedText(item.description,translation?.description),
    };
  });

  const hasFallbackContent = language !== 'pt' && (
    typedBanners.some(i=>hasTranslationFallback(i,bannerTranslationsById.get(i.id),['title','subtitle','cta_label'])) ||
    typedAnnouncements.some(i=>hasTranslationFallback(i,announcementTranslationsById.get(i.id),['title','body'])) ||
    typedSections.some(i=>hasTranslationFallback(i,sectionTranslationsById.get(i.id),['title','content','cta','category'])) ||
    typedDepartments.some(i=>hasTranslationFallback(i,departmentTranslationsById.get(i.id),['name','description','action'])) ||
    typedPolicies.some(i=>hasTranslationFallback(i,policyTranslationsById.get(i.id),['title','description'])));
  const serviceFallbackIds=language==='pt'?[]:typedSections.filter(i=>hasTranslationFallback(i,sectionTranslationsById.get(i.id),['title','content','cta','category'])).map(i=>i.id);
  const tourismHomeAvailable = await publicTourismHomeAvailable(supabase, hotel.id);
  const [mediaResult, tourismResult, presentationResult] = await Promise.all([
    supabase.from('hotel_public_experience_media').select('*').eq('hotel_id', hotel.id).eq('is_published', true),
    tourismHomeAvailable ? loadPublicTourism(supabase, hotel, language).catch(() => null) : Promise.resolve(null),
    supabase.from('hotel_public_presentation').select('configuration').eq('hotel_id',hotel.id).maybeSingle(),
  ]);
  if (mediaResult.error) console.error('Public experience media unavailable; retaining theme fallback');
  const mediaTranslations = language === 'pt' || !mediaResult.data?.length ? {data: [],error:null} : await supabase.from('hotel_public_experience_media_translations').select('slot,title,description,alt_text,cta_label').eq('hotel_id',hotel.id).eq('language',language);
  const translatedMedia = new Map((mediaTranslations.error ? [] : mediaTranslations.data ?? []).map(row=>[row.slot,row]));

  return {
    hotel,
    serviceFallbackIds,
    presentation: presentationResult.error ? null : parsePublicPresentation(presentationResult.data?.configuration, hotel.id),
    experienceMedia: (mediaResult.error ? [] : mediaResult.data ?? []).filter(row => row.hotel_id === hotel.id && row.is_published).map(row=>localizeExperienceMedia(row,translatedMedia.get(row.slot))),
    tourismPreview: tourismResult?.items ?? [],
    tourismHomeAvailable,
    flightHomeCard: flightHomeCardRow ? {
      title: flightHomeCardRow.home_card_title,
      description: flightHomeCardRow.home_card_description,
    } : null,
    banners: displayBanners,
    announcements: displayAnnouncements,
    sections: displaySections,
    departments: displayDepartments,
    policies: displayPolicies,
    layout: normalizeExperienceLayout(layoutRows),
    hasFallbackContent: hasFallbackContent || (language !== 'pt' && (mediaResult.data ?? []).some(row=>experienceMediaHasFallback(row,translatedMedia.get(row.slot)))),
  } satisfies PublicHotelPageData;
}

async function getPublicHotelServiceDetailDataForHotel(
  supabase: SupabaseClient,
  hotel: PublicHotel,
  serviceId: string,
  language: SupportedPublicLanguage
) {
  const { data: section, error: sectionError } = await supabase
    .from('hotel_sections')
    .select('*')
    .eq('id', serviceId)
    .eq('hotel_id', hotel.id)
    .eq('enabled', true)
    .maybeSingle();

  if (sectionError) {
    console.error('Failed to load hotel service detail:', sectionError);
    return null;
  }

  if (!section) {
    return null;
  }

  const typedSection = section as PublicHotelSection;

  const translationResult =
    language === 'pt'
      ? { data: null, error: null }
      : await supabase
          .from('hotel_section_translations')
          .select('*')
          .eq('section_id', typedSection.id)
          .eq('language', language)
          .maybeSingle();

  if (translationResult.error) {
    console.error('Failed to load service translation:', translationResult.error);
  }

  const translation = (translationResult.data || null) as PublicHotelSectionTranslation | null;
  const config=await supabase.from('hotel_public_presentation').select('configuration').eq('hotel_id',hotel.id).maybeSingle();

  return {
    hotel,
    experienceVersion: parsePublicPresentation(config.data?.configuration,hotel.id)?.experienceVersion??'v3',
    section: {
      ...typedSection,
      title: translatedText(typedSection.title,translation?.title),
      content: translatedText(typedSection.content,translation?.content),
      cta: translatedText(typedSection.cta,translation?.cta),
      category: translatedText(typedSection.category,translation?.category),
    },
    hasFallbackContent: language !== 'pt' && hasTranslationFallback(typedSection,translation,['title','content','cta','category']),
  } satisfies PublicHotelServiceDetailData;
}

async function getPublicFlightCenterDataForHotel(
  supabase: SupabaseClient,
  hotel: PublicHotel
) {
  const { data, error } = await supabase.rpc('get_public_hotel_flight_center', {
    p_hotel_id: hotel.id,
  });

  if (error) {
    console.error('Failed to load public Flight Center:', error);
    return null;
  }

  const rows = (data || []) as PublicFlightCenterRow[];
  const firstRow = rows[0];
  if (!firstRow) return null;
  const timezones = await getFlightAirportTimezones(rows.map(row => row.airport_iata_code));
  const config=await supabase.from('hotel_public_presentation').select('configuration').eq('hotel_id',hotel.id).maybeSingle();

  const [
    servicesModule,
    menuModule,
    sectionsResult,
    menuSectionsResult,
    layoutResult,
  ] = await Promise.all([
    supabase.rpc('is_hotel_module_enabled', {
      p_hotel_id: hotel.id,
      p_module_key: 'content.services',
    }),
    supabase.rpc('is_hotel_module_enabled', {
      p_hotel_id: hotel.id,
      p_module_key: 'fb.menu',
    }),
    supabase
      .from('hotel_sections')
      .select('id', { count: 'exact', head: true })
      .eq('hotel_id', hotel.id)
      .eq('enabled', true),
    supabase
      .from('hotel_sections')
      .select('id', { count: 'exact', head: true })
      .eq('hotel_id', hotel.id)
      .eq('enabled', true)
      .eq('service_action_type', 'room_restaurant_menu'),
    supabase.rpc('get_public_hotel_experience_layout', {
      p_hotel_id: hotel.id,
    }),
  ]);

  const navigationErrors = [
    servicesModule.error,
    menuModule.error,
    sectionsResult.error,
    menuSectionsResult.error,
    layoutResult.error,
  ].filter(Boolean);
  if (navigationErrors.length) {
    console.error('Failed to load public navigation availability:', navigationErrors);
  }

  return {
    hotel,
    experienceVersion: parsePublicPresentation(config.data?.configuration,hotel.id)?.experienceVersion??'v3',
    navigationAvailability: getPublicNavigationAvailability({
      layout: normalizeExperienceLayout(layoutResult.data),
      servicesModuleEnabled: servicesModule.data === true,
      servicesContentCount: sectionsResult.count || 0,
      menuModuleEnabled: menuModule.data === true,
      menuContentCount: menuSectionsResult.count || 0,
    }),
    airports: rows.map((row) => ({
      timezone: timezones[row.airport_iata_code] ?? null,
      iataCode: row.airport_iata_code,
      name: row.airport_name,
      city: row.airport_city,
      officialDeparturesUrl: normalizePublicHttpsUrl(row.official_departures_url),
      officialArrivalsUrl: normalizePublicHttpsUrl(row.official_arrivals_url),
      estimatedTransferMinutes: row.estimated_transfer_minutes,
      domesticLeadMinutes: row.domestic_lead_minutes,
      internationalLeadMinutes: row.international_lead_minutes,
      safetyMarginMinutes: row.safety_margin_minutes,
    })),
    settings: {
      departurePlanningEnabled: firstRow.departure_planning_enabled,
      transferEnabled: firstRow.transfer_enabled,
      wakeUpEnabled: firstRow.wake_up_enabled,
      breakfastBoxEnabled: firstRow.breakfast_box_enabled,
      receptionEnabled: firstRow.reception_enabled,
      officialLinksEnabled: firstRow.official_links_enabled,
      departureNotice: firstRow.departure_notice,
    },
  } satisfies PublicFlightCenterData;
}

export async function getPublicHotelPageDataBySlug(
  slug: string,
  language: SupportedPublicLanguage
) {
  const supabase = createPublicClient();
  const hotel = await getHotelBySlugWithClient(supabase, slug);

  if (!hotel) {
    return null;
  }

  return getPublicHotelPageDataForHotel(supabase, hotel, language);
}

export async function getPublicHotelPageDataBySubdomain(
  subdomain: string,
  language: SupportedPublicLanguage
) {
  const supabase = createPublicClient();
  const hotel = await getHotelBySubdomainWithClient(supabase, subdomain);

  if (!hotel) {
    return null;
  }

  return getPublicHotelPageDataForHotel(supabase, hotel, language);
}

export async function getPublicHotelServiceDetailDataBySlug(
  slug: string,
  serviceId: string,
  language: SupportedPublicLanguage
) {
  const supabase = createPublicClient();
  const hotel = await getHotelBySlugWithClient(supabase, slug);

  if (!hotel) {
    return null;
  }

  return getPublicHotelServiceDetailDataForHotel(supabase, hotel, serviceId, language);
}

export async function getPublicHotelServiceDetailDataBySubdomain(
  subdomain: string,
  serviceId: string,
  language: SupportedPublicLanguage
) {
  const supabase = createPublicClient();
  const hotel = await getHotelBySubdomainWithClient(supabase, subdomain);

  if (!hotel) {
    return null;
  }

  return getPublicHotelServiceDetailDataForHotel(supabase, hotel, serviceId, language);
}

export async function getPublicFlightCenterDataBySlug(slug: string) {
  const supabase = createPublicClient();
  const hotel = await getHotelBySlugWithClient(supabase, slug);
  if (!hotel) return null;
  return getPublicFlightCenterDataForHotel(supabase, hotel);
}

export async function getPublicFlightCenterDataBySubdomain(subdomain: string) {
  const supabase = createPublicClient();
  const hotel = await getHotelBySubdomainWithClient(supabase, subdomain);
  if (!hotel) return null;
  return getPublicFlightCenterDataForHotel(supabase, hotel);
}


export async function getPublicTourismDataBySlug(slug: string, language: SupportedPublicLanguage, itemSlug?: string) {
  const client = createPublicClient();
  const hotel = await getHotelBySlugWithClient(client, slug);
  return hotel ? loadPublicTourism(client, hotel, language, itemSlug, true) : null;
}
export async function getPublicTourismDataBySubdomain(subdomain: string, language: SupportedPublicLanguage, itemSlug?: string) {
  const client = createPublicClient();
  const hotel = await getHotelBySubdomainWithClient(client, subdomain);
  return hotel ? loadPublicTourism(client, hotel, language, itemSlug, true) : null;
}
