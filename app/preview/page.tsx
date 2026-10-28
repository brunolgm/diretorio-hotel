import { HotelPublicPageContent } from '@/components/public/hotel-public-page-content';
import { getAuthenticatedHotelPreviewData } from '@/lib/authenticated-hotel-preview';
import { normalizePublicLanguage } from '@/lib/public-language';
import { getRequestDomainContext } from '@/lib/domain-context';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function PreviewPage({searchParams}:{searchParams:Promise<{lang?:string}>}) {
 const language = normalizePublicLanguage((await searchParams).lang);
 const data = await getAuthenticatedHotelPreviewData(language);
 const domainContext = await getRequestDomainContext();
 return <HotelPublicPageContent {...data} language={language} domainContext={domainContext} activeRoomContext={null}/>;
}
