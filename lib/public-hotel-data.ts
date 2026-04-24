import { createClient } from '@/lib/supabase/server';
import { normalizeHotelSubdomainInput } from '@/lib/hotel-subdomain';
import { type SupportedPublicLanguage } from '@/lib/public-language';
import type { Database } from '@/types/database';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type PublicHotel = Database['public']['Tables']['hotels']['Row'];
export type PublicHotelSection = Database['public']['Tables']['hotel_sections']['Row'];
export type PublicHotelDepartment = Database['public']['Tables']['hotel_departments']['Row'];
export type PublicHotelPolicy = Database['public']['Tables']['hotel_policies']['Row'];
type PublicHotelSectionTranslation =
  Database['public']['Tables']['hotel_section_translations']['Row'];
type PublicHotelDepartmentTranslation =
  Database['public']['Tables']['hotel_department_translations']['Row'];
type PublicHotelPolicyTranslation =
  Database['public']['Tables']['hotel_policy_translations']['Row'];

export interface PublicHotelPageData {
  hotel: PublicHotel;
  sections: PublicHotelSection[];
  departments: PublicHotelDepartment[];
  policies: PublicHotelPolicy[];
  hasFallbackContent: boolean;
}

export interface PublicHotelServiceDetailData {
  hotel: PublicHotel;
  section: PublicHotelSection;
  hasFallbackContent: boolean;
}

async function getHotelBySlugWithClient(supabase: SupabaseClient, slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    return null;
  }

  const { data, error } = await supabase
    .from('hotels')
    .select('*')
    .eq('slug', normalizedSlug)
    .maybeSingle();

  if (error) {
    console.error('Failed to load hotel by slug:', error);
    return null;
  }

  return (data || null) as PublicHotel | null;
}

async function getHotelBySubdomainWithClient(supabase: SupabaseClient, subdomain: string) {
  const normalizedSubdomain = normalizeHotelSubdomainInput(subdomain);

  if (!normalizedSubdomain) {
    return null;
  }

  const { data: hotelBySubdomain, error: hotelBySubdomainError } = await supabase
    .from('hotels')
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

async function getPublicHotelPageDataForHotel(
  supabase: SupabaseClient,
  hotel: PublicHotel,
  language: SupportedPublicLanguage
) {
  const [
    { data: sections, error: sectionsError },
    { data: departments, error: departmentsError },
    { data: policies, error: policiesError },
  ] = await Promise.all([
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
  ]);

  if (sectionsError) {
    console.error('Failed to load hotel sections:', sectionsError);
  }
  if (departmentsError) {
    console.error('Failed to load hotel departments:', departmentsError);
  }
  if (policiesError) {
    console.error('Failed to load hotel policies:', policiesError);
  }

  const typedSections = (sections || []) as PublicHotelSection[];
  const typedDepartments = (departments || []) as PublicHotelDepartment[];
  const typedPolicies = (policies || []) as PublicHotelPolicy[];

  const [sectionTranslationsResult, departmentTranslationsResult, policyTranslationsResult] =
    language === 'pt'
      ? [{ data: [] }, { data: [] }, { data: [] }]
      : await Promise.all([
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

  const sectionTranslations = (sectionTranslationsResult.data || []) as PublicHotelSectionTranslation[];
  const departmentTranslations =
    (departmentTranslationsResult.data || []) as PublicHotelDepartmentTranslation[];
  const policyTranslations = (policyTranslationsResult.data || []) as PublicHotelPolicyTranslation[];

  const sectionTranslationsById = new Map(
    sectionTranslations.map((translation) => [translation.section_id, translation])
  );
  const departmentTranslationsById = new Map(
    departmentTranslations.map((translation) => [translation.department_id, translation])
  );
  const policyTranslationsById = new Map(
    policyTranslations.map((translation) => [translation.policy_id, translation])
  );

  const displaySections = typedSections.map((item) => {
    const translation = sectionTranslationsById.get(item.id);

    return {
      ...item,
      title: translation?.title ?? item.title,
      content: translation?.content ?? item.content,
      cta: translation?.cta ?? item.cta,
      category: translation?.category ?? item.category,
    };
  });

  const displayDepartments = typedDepartments.map((item) => {
    const translation = departmentTranslationsById.get(item.id);

    return {
      ...item,
      name: translation?.name ?? item.name,
      description: translation?.description ?? item.description,
      action: translation?.action ?? item.action,
    };
  });

  const displayPolicies = typedPolicies.map((item) => {
    const translation = policyTranslationsById.get(item.id);

    return {
      ...item,
      title: translation?.title ?? item.title,
      description: translation?.description ?? item.description,
    };
  });

  const hasFallbackContent =
    language !== 'pt' &&
    (typedSections.some((item) => {
      const translation = sectionTranslationsById.get(item.id);
      return !translation || !translation.title || !translation.content || !translation.cta;
    }) ||
      typedDepartments.some((item) => {
        const translation = departmentTranslationsById.get(item.id);
        return !translation || !translation.name || !translation.description || !translation.action;
      }) ||
      typedPolicies.some((item) => {
        const translation = policyTranslationsById.get(item.id);
        return !translation || !translation.title || !translation.description;
      }));

  return {
    hotel,
    sections: displaySections,
    departments: displayDepartments,
    policies: displayPolicies,
    hasFallbackContent,
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

  return {
    hotel,
    section: {
      ...typedSection,
      title: translation?.title ?? typedSection.title,
      content: translation?.content ?? typedSection.content,
      cta: translation?.cta ?? typedSection.cta,
      category: translation?.category ?? typedSection.category,
    },
    hasFallbackContent:
      language !== 'pt' &&
      (!translation ||
        !translation.title ||
        !translation.content ||
        !translation.cta ||
        !translation.category),
  } satisfies PublicHotelServiceDetailData;
}

export async function getPublicHotelPageDataBySlug(
  slug: string,
  language: SupportedPublicLanguage
) {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const hotel = await getHotelBySubdomainWithClient(supabase, subdomain);

  if (!hotel) {
    return null;
  }

  return getPublicHotelServiceDetailDataForHotel(supabase, hotel, serviceId, language);
}
