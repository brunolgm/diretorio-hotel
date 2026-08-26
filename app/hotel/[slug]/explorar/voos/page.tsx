import { notFound } from 'next/navigation';
import { HotelPublicFlightCenter } from '@/components/public/hotel-public-flight-center';
import { getRequestDomainContext } from '@/lib/domain-context';
import { normalizePublicFlightCenterTab } from '@/lib/public-flight-center-copy';
import { getPublicFlightCenterDataBySlug } from '@/lib/public-hotel-data';
import { normalizePublicLanguage } from '@/lib/public-language';

export const dynamic = 'force-dynamic';

export default async function PublicHotelFlightCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ lang?: string; tab?: string }>;
}) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : undefined;
  const language = normalizePublicLanguage(query?.lang);
  const tab = normalizePublicFlightCenterTab(query?.tab);
  const domainContext = await getRequestDomainContext();
  const data = await getPublicFlightCenterDataBySlug(slug);
  if (!data) notFound();

  return <HotelPublicFlightCenter data={data} language={language} tab={tab} domainContext={domainContext} preferSubdomainRoot={false} />;
}
