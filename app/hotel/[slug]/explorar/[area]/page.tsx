import { notFound } from 'next/navigation';
import { HotelPublicAreaContent } from '@/components/public/hotel-public-area-content';
import { getRequestDomainContext } from '@/lib/domain-context';
import { getPublicHotelPageDataBySlug } from '@/lib/public-hotel-data';
import { normalizePublicLanguage } from '@/lib/public-language';
import { isPublicHotelAreaKey } from '@/lib/public-routes';

export const dynamic = 'force-dynamic';

export default async function PublicHotelSlugAreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; area: string }>;
  searchParams?: Promise<{ lang?: string }>;
}) {
  const { slug, area } = await params;
  if (!isPublicHotelAreaKey(area)) notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language = normalizePublicLanguage(resolvedSearchParams?.lang);
  const domainContext = await getRequestDomainContext();
  const pageData = await getPublicHotelPageDataBySlug(slug, language);
  if (!pageData) notFound();

  return (
    <HotelPublicAreaContent
      pageData={pageData}
      area={area}
      language={language}
      domainContext={domainContext}
      preferSubdomainRoot={false}
    />
  );
}
