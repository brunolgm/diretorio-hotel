import { notFound } from 'next/navigation';
import { HotelServiceDetailContent } from '@/components/public/hotel-service-detail-content';
import { getRequestDomainContext } from '@/lib/domain-context';
import { getPublicHotelServiceDetailDataBySubdomain } from '@/lib/public-hotel-data';
import { normalizePublicLanguage, type SupportedPublicLanguage } from '@/lib/public-language';
import { canOpenInternalServiceDetail } from '@/lib/service-destinations';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    lang?: string;
  }>;
}

export default async function SubdomainHotelServiceDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language: SupportedPublicLanguage = normalizePublicLanguage(resolvedSearchParams?.lang);
  const domainContext = await getRequestDomainContext();

  if (!domainContext.isPotentialHotelSubdomain || !domainContext.subdomain) {
    notFound();
  }

  const pageData = await getPublicHotelServiceDetailDataBySubdomain(
    domainContext.subdomain,
    id,
    language
  );

  if (!pageData || !canOpenInternalServiceDetail(pageData.section)) {
    notFound();
  }

  return (
    <HotelServiceDetailContent
      hotel={pageData.hotel}
      section={pageData.section}
      language={language}
      domainContext={domainContext}
      hasFallbackContent={pageData.hasFallbackContent}
      preferSubdomainRoot
    />
  );
}
