import { HotelPublicPageContent } from '@/components/public/hotel-public-page-content';
import { HotelExperienceUnavailable } from '@/components/public/hotel-experience-unavailable';
import { getRequestDomainContext } from '@/lib/domain-context';
import { getPublicHotelPageDataBySlug } from '@/lib/public-hotel-data';
import { normalizePublicLanguage, type SupportedPublicLanguage } from '@/lib/public-language';
import { readRoomContext } from '@/lib/room-context';
import { resolveActiveRoomContextForHotel } from '@/lib/room-links';
import { resolveDevelopmentThemePreview } from '@/lib/public-theme-preview';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    lang?: string;
    previewPreset?: string | string[];
  }>;
}

export default async function HotelPublicPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language: SupportedPublicLanguage = normalizePublicLanguage(resolvedSearchParams?.lang);
  const previewPreset = resolveDevelopmentThemePreview(resolvedSearchParams?.previewPreset);
  const domainContext = await getRequestDomainContext();
  const pageData = await getPublicHotelPageDataBySlug(slug, language);

  if (!pageData) {
    return <HotelExperienceUnavailable />;
  }

  const roomContext = await readRoomContext();
  const activeRoomContext =
    roomContext?.roomToken && roomContext.hotelId === pageData.hotel.id
      ? await resolveActiveRoomContextForHotel({
          hotelId: pageData.hotel.id,
          roomToken: roomContext.roomToken,
        })
      : null;
  const renderHotel = previewPreset
    ? { ...pageData.hotel, theme_preset: previewPreset }
    : pageData.hotel;

  return (
    <HotelPublicPageContent
      hotel={renderHotel}
      banners={pageData.banners}
      announcements={pageData.announcements}
      sections={pageData.sections}
      departments={pageData.departments}
      policies={pageData.policies}
      layout={pageData.layout}
      language={language}
      domainContext={domainContext}
      hasFallbackContent={pageData.hasFallbackContent}
      activeRoomContext={activeRoomContext}
    />
  );
}
