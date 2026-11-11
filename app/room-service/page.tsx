import {notFound} from 'next/navigation';
import {getPublicHotelPageDataBySubdomain} from '@/lib/public-hotel-data';
import {getRequestDomainContext, isHotelSubdomainContext} from '@/lib/domain-context';
import {normalizePublicLanguage} from '@/lib/public-language';
import {SmartMenuPage} from '@/components/public/smartmenu-page';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Room Service · LibGuest', robots: {index: false, follow: false}};

export default async function Page({searchParams}: {searchParams: Promise<{lang?: string}>}) {
  const domainContext = await getRequestDomainContext();
  if (!isHotelSubdomainContext(domainContext)) notFound();
  const language = normalizePublicLanguage((await searchParams).lang);
  const pageData = await getPublicHotelPageDataBySubdomain(domainContext.subdomain, language);
  if (!pageData) notFound();
  return <SmartMenuPage pageData={pageData} language={language} domainContext={domainContext} preferSubdomainRoot/>;
}
