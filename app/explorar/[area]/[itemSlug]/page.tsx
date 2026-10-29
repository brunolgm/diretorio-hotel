import { notFound } from 'next/navigation';
import { PublicTourismContent } from '@/components/public/public-tourism-content';
import { getPublicTourismDataBySubdomain } from '@/lib/public-hotel-data';
import { getRequestDomainContext, isHotelSubdomainContext } from '@/lib/domain-context';
import { normalizePublicLanguage } from '@/lib/public-language';
export const dynamic = 'force-dynamic';
export default async function TourismDetail({ params, searchParams }: {
  params: Promise<{ area: string; itemSlug: string }>; searchParams?: Promise<{ lang?: string; collection?:string }>;
}) {
  const p = await params;
  if (p.area !== 'turismo') notFound();
  const query=await searchParams; const language = normalizePublicLanguage(query?.lang);
  const domainContext = await getRequestDomainContext();
  if (!isHotelSubdomainContext(domainContext)) notFound();
  const data = await getPublicTourismDataBySubdomain(domainContext.subdomain, language, p.itemSlug);
  if (!data?.items.length) notFound();
  return <PublicTourismContent data={data} language={language} domainContext={domainContext} preferSubdomainRoot={true} detail collection={query?.collection} />;
}
