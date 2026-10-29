import { notFound } from 'next/navigation';
import { PublicTourismContent } from '@/components/public/public-tourism-content';
import { getPublicTourismDataBySlug } from '@/lib/public-hotel-data';
import { getRequestDomainContext } from '@/lib/domain-context';
import { normalizePublicLanguage } from '@/lib/public-language';
export const dynamic = 'force-dynamic';
export default async function TourismDetail({ params, searchParams }: {
  params: Promise<{ slug: string; area: string; itemSlug: string }>; searchParams?: Promise<{ lang?: string; collection?:string }>;
}) {
  const p = await params;
  if (p.area !== 'turismo') notFound();
  const query=await searchParams; const language = normalizePublicLanguage(query?.lang);
  const domainContext = await getRequestDomainContext();

  const data = await getPublicTourismDataBySlug(p.slug, language, p.itemSlug);
  if (!data?.items.length) notFound();
  return <PublicTourismContent data={data} language={language} domainContext={domainContext} preferSubdomainRoot={false} detail collection={query?.collection} />;
}
