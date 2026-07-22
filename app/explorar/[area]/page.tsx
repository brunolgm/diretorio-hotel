import { notFound } from 'next/navigation';
import { HotelPublicAreaContent } from '@/components/public/hotel-public-area-content';
import { getRequestDomainContext, isHotelSubdomainContext } from '@/lib/domain-context';
import { getPublicHotelPageDataBySubdomain } from '@/lib/public-hotel-data';
import { normalizePublicLanguage } from '@/lib/public-language';
import { isPublicHotelAreaKey } from '@/lib/public-routes';

export const dynamic = 'force-dynamic';

export default async function PublicHotelAreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ area: string }>;
  searchParams?: Promise<{ lang?: string }>;
}) {
  const { area } = await params;
  if (!isPublicHotelAreaKey(area)) notFound();

  const domainContext = await getRequestDomainContext();
  if (!isHotelSubdomainContext(domainContext)) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language = normalizePublicLanguage(resolvedSearchParams?.lang);
  const pageData = await getPublicHotelPageDataBySubdomain(domainContext.subdomain, language);
  if (!pageData) notFound();

  return (
    <HotelPublicAreaContent
      pageData={pageData}
      area={area}
      language={language}
      domainContext={domainContext}
      preferSubdomainRoot
    />
  );
}
