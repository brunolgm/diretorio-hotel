import { notFound } from 'next/navigation';
import { HotelExperienceUnavailable } from '@/components/public/hotel-experience-unavailable';
import { HotelPublicFlightCenter } from '@/components/public/hotel-public-flight-center';
import { getRequestDomainContext, isHotelSubdomainContext } from '@/lib/domain-context';
import { normalizePublicFlightCenterTab } from '@/lib/public-flight-center-copy';
import { getPublicFlightCenterDataBySubdomain } from '@/lib/public-hotel-data';
import { normalizePublicLanguage } from '@/lib/public-language';

export const dynamic = 'force-dynamic';

export default async function PublicSubdomainFlightCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string; tab?: string }>;
}) {
  const domainContext = await getRequestDomainContext();
  if (!isHotelSubdomainContext(domainContext)) notFound();

  const query = searchParams ? await searchParams : undefined;
  const language = normalizePublicLanguage(query?.lang);
  const tab = normalizePublicFlightCenterTab(query?.tab);
  const data = await getPublicFlightCenterDataBySubdomain(domainContext.subdomain);
  if (!data) return <HotelExperienceUnavailable />;

  return <HotelPublicFlightCenter data={data} language={language} tab={tab} domainContext={domainContext} preferSubdomainRoot />;
}
