import {notFound} from 'next/navigation';
import {getPublicHotelPageDataBySlug} from '@/lib/public-hotel-data';
import {getRequestDomainContext} from '@/lib/domain-context';
import {normalizePublicLanguage} from '@/lib/public-language';
import {SmartMenuPage} from '@/components/public/smartmenu-page';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Room Service · LibGuest', robots: {index: false, follow: false}};

export default async function Page({params, searchParams}: {params: Promise<{slug: string}>; searchParams: Promise<{lang?: string}>}) {
  const {slug} = await params;
  const language = normalizePublicLanguage((await searchParams).lang);
  const [pageData, domainContext] = await Promise.all([getPublicHotelPageDataBySlug(slug, language), getRequestDomainContext()]);
  if (!pageData) notFound();
  return <SmartMenuPage pageData={pageData} language={language} domainContext={domainContext}/>;
}
