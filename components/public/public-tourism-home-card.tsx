import { ArrowRight, MapPinned } from 'lucide-react';
import type { DomainContext } from '@/lib/domain-context';
import { buildPublicHotelAreaHref } from '@/lib/public-routes';
import { tourismPublicCopy } from '@/lib/tourism/public-copy';

export function PublicTourismHomeCard({ available, slug, language, domainContext, preferSubdomainRoot, style }: {
  available?: boolean; slug: string; language: 'pt' | 'en' | 'es'; domainContext: DomainContext; preferSubdomainRoot: boolean; style?: { order: number };
}) {
  if (!available) return null;
  const copy = tourismPublicCopy(language);
  return <section className="mx-4 mt-5 md:mx-8" style={style} data-public-tourism-home-card>
    <a href={buildPublicHotelAreaHref({ slug, area: 'turismo', language, domainContext, preferSubdomainRoot })} className="hotel-theme-card flex min-h-24 min-w-0 items-center gap-4 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hotel-accent)]">
      <MapPinned className="h-7 w-7 shrink-0 text-[color:var(--hotel-accent)]" aria-hidden="true" />
      <div className="min-w-0 flex-1"><h2 className="break-words text-lg font-semibold">{copy.title}</h2><p className="mt-1 break-words text-sm text-[color:var(--hotel-text-muted)]">{copy.intro}</p></div><ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
    </a>
  </section>;
}
