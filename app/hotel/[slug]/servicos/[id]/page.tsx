import { notFound, redirect } from 'next/navigation';
import { HotelServiceDetailContent } from '@/components/public/hotel-service-detail-content';
import { getRequestDomainContext } from '@/lib/domain-context';
import { readRoomContext } from '@/lib/room-context';
import { resolveRoomRestaurantMenuUrl } from '@/lib/room-links';
import { getPublicHotelServiceDetailDataBySlug } from '@/lib/public-hotel-data';
import { normalizePublicLanguage, type SupportedPublicLanguage } from '@/lib/public-language';
import { canRenderServiceDetailPage } from '@/lib/service-destinations';
import { isRoomRestaurantMenuAction } from '@/lib/service-action-types';

interface PageProps {
  params: Promise<{
    slug: string;
    id: string;
  }>;
  searchParams?: Promise<{
    lang?: string;
  }>;
}

export default async function HotelServiceDetailPage({ params, searchParams }: PageProps) {
  const { slug, id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language: SupportedPublicLanguage = normalizePublicLanguage(resolvedSearchParams?.lang);
  const domainContext = await getRequestDomainContext();
  const pageData = await getPublicHotelServiceDetailDataBySlug(slug, id, language);

  if (!pageData || !canRenderServiceDetailPage(pageData.section)) {
    notFound();
  }

  if (isRoomRestaurantMenuAction(pageData.section.service_action_type)) {
    const roomContext = await readRoomContext();

    if (!roomContext?.roomToken || roomContext.hotelId !== pageData.hotel.id) {
      return (
        <HotelServiceDetailContent
          hotel={pageData.hotel}
          section={pageData.section}
          language={language}
          domainContext={domainContext}
          hasFallbackContent={pageData.hasFallbackContent}
          roomRestaurantState="missing-context"
        />
      );
    }

    const resolution = await resolveRoomRestaurantMenuUrl({
      hotelId: pageData.hotel.id,
      roomToken: roomContext.roomToken,
    });

    if (resolution.kind === 'ready') {
      redirect(resolution.url);
    }

    return (
      <HotelServiceDetailContent
        hotel={pageData.hotel}
        section={pageData.section}
        language={language}
        domainContext={domainContext}
        hasFallbackContent={pageData.hasFallbackContent}
        roomRestaurantState={resolution.kind === 'missing-menu' ? 'missing-menu' : 'invalid-context'}
        roomNumber={resolution.kind === 'missing-menu' ? resolution.roomNumber : roomContext.roomNumber}
      />
    );
  }

  return (
    <HotelServiceDetailContent
      hotel={pageData.hotel}
      section={pageData.section}
      language={language}
      domainContext={domainContext}
      hasFallbackContent={pageData.hasFallbackContent}
    />
  );
}
