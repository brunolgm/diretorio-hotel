import { notFound } from 'next/navigation';
import { HotelPublicPageContent } from '@/components/public/hotel-public-page-content';
import { getRequestDomainContext } from '@/lib/domain-context';
import { getPublicHotelPageDataBySlug } from '@/lib/public-hotel-data';
import { normalizePublicLanguage, type SupportedPublicLanguage } from '@/lib/public-language';
import { readRoomContext } from '@/lib/room-context';
import { resolveActiveRoomContextForHotel } from '@/lib/room-links';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    lang?: string;
  }>;
}

export default async function HotelPublicPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language: SupportedPublicLanguage = normalizePublicLanguage(resolvedSearchParams?.lang);
  const domainContext = await getRequestDomainContext();
  const pageData = await getPublicHotelPageDataBySlug(slug, language);

  if (!pageData) {
    notFound();
  }

  const roomContext = await readRoomContext();
  const activeRoomContext =
    roomContext?.roomToken && roomContext.hotelId === pageData.hotel.id
      ? await resolveActiveRoomContextForHotel({
          hotelId: pageData.hotel.id,
          roomToken: roomContext.roomToken,
        })
      : null;

  return (
    <HotelPublicPageContent
      hotel={pageData.hotel}
      banners={pageData.banners}
      announcements={pageData.announcements}
      sections={pageData.sections}
      departments={pageData.departments}
      policies={pageData.policies}
      language={language}
      domainContext={domainContext}
      hasFallbackContent={pageData.hasFallbackContent}
      activeRoomContext={activeRoomContext}
    />
  );
}
