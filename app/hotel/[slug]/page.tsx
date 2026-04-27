import { notFound } from 'next/navigation';
import { HotelPublicPageContent } from '@/components/public/hotel-public-page-content';
import { getRequestDomainContext } from '@/lib/domain-context';
import { getPublicHotelPageDataBySlug } from '@/lib/public-hotel-data';
import { normalizePublicLanguage, type SupportedPublicLanguage } from '@/lib/public-language';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    lang?: string;
  }>;
}

export default async function HotelPublicPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language: SupportedPublicLanguage = normalizePublicLanguage(resolvedSearchParams?.lang);
  const domainContext = await getRequestDomainContext();
  const pageData = await getPublicHotelPageDataBySlug(slug, language);

  if (!pageData) {
    notFound();
  }

  return (
    <HotelPublicPageContent
      hotel={pageData.hotel}
      announcements={pageData.announcements}
      sections={pageData.sections}
      departments={pageData.departments}
      policies={pageData.policies}
      language={language}
      domainContext={domainContext}
      hasFallbackContent={pageData.hasFallbackContent}
    />
  );
}
