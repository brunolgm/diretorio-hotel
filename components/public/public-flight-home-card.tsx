import { ArrowRight, PlaneTakeoff } from 'lucide-react';
import type { DomainContext } from '@/lib/domain-context';
import { getPublicFlightCenterCopy } from '@/lib/public-flight-center-copy';
import type { PublicFlightHomeCard } from '@/lib/public-hotel-data';
import type { SupportedPublicLanguage } from '@/lib/public-language';
import { buildPublicHotelFlightCenterHref } from '@/lib/public-routes';

type FlightHomeCardVariant = 'grand-mercure' | 'mercure' | 'novotel' | 'default';

const variantStyles: Record<FlightHomeCardVariant, {
  section: string;
  link: string;
  icon: string;
  title: string;
  description: string;
  cta: string;
}> = {
  'grand-mercure': {
    section: 'mx-3 mt-5 md:mx-8 md:mt-7 lg:mx-14',
    link: 'border-[#dfd2c0] bg-[linear-gradient(135deg,#fffdf9_0%,#f8efdf_100%)] shadow-[0_16px_38px_-27px_rgba(56,45,29,.46)] focus-visible:ring-[#b38337]',
    icon: 'border-[#d9c49f] bg-[#b78942] text-white',
    title: 'font-serif text-[#342f29]',
    description: 'text-[#756b60]',
    cta: 'text-[#9b6d27]',
  },
  mercure: {
    section: 'mx-3 mt-4 md:mx-10 md:mt-6 lg:mx-14',
    link: 'border-[#52204f]/10 bg-[linear-gradient(135deg,#fffdfd_0%,#f8edef_100%)] shadow-[0_16px_38px_-27px_rgba(61,23,60,.36)] focus-visible:ring-[#71386e]',
    icon: 'border-[#71386e]/15 bg-[#71386e] text-white',
    title: 'text-[#52204f]',
    description: 'text-[#685d64]',
    cta: 'text-[#71386e]',
  },
  novotel: {
    section: 'mx-4 mt-5 md:mx-10 md:mt-7',
    link: 'border-[#d9e3ed] bg-[linear-gradient(135deg,#ffffff_0%,#eef4f9_100%)] shadow-[0_16px_38px_-27px_rgba(0,43,92,.38)] focus-visible:ring-[#0072ce]',
    icon: 'border-[#0072ce]/15 bg-[#003b71] text-white',
    title: 'text-[#003b71]',
    description: 'text-[#526779]',
    cta: 'text-[#0068b8]',
  },
  default: {
    section: 'mt-8',
    link: 'border-[color:var(--hotel-border)] bg-[var(--hotel-surface)] shadow-[var(--hotel-card-shadow)] focus-visible:ring-[var(--hotel-accent)]',
    icon: 'border-[color:var(--hotel-accent-border)] bg-[var(--hotel-accent)] text-[color:var(--hotel-accent-foreground)]',
    title: 'text-[color:var(--hotel-primary)]',
    description: 'text-[color:var(--hotel-text-muted)]',
    cta: 'text-[color:var(--hotel-accent)]',
  },
};

export function PublicFlightHomeCard({
  card,
  hotelSlug,
  language,
  domainContext,
  preferSubdomainRoot,
  variant,
  style,
}: {
  card: PublicFlightHomeCard;
  hotelSlug: string;
  language: SupportedPublicLanguage;
  domainContext: DomainContext;
  preferSubdomainRoot: boolean;
  variant: FlightHomeCardVariant;
  style?: { order: number };
}) {
  const copy = getPublicFlightCenterCopy(language);
  const title = card.title?.trim() || copy.homeCardTitle;
  const description = card.description?.trim() || copy.homeCardDescription;
  const href = buildPublicHotelFlightCenterHref({
    slug: hotelSlug,
    language,
    domainContext,
    preferSubdomainRoot,
  });
  const styles = variantStyles[variant];

  return (
    <section className={styles.section} style={style} data-public-flight-home-card>
      <a
        href={href}
        aria-label={`${copy.homeCardCta}: ${title}`}
        className={`group flex min-w-0 items-center gap-3 overflow-hidden rounded-[22px] border p-4 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:gap-5 sm:p-5 ${styles.link}`}
      >
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] border sm:h-14 sm:w-14 ${styles.icon}`}>
          <PlaneTakeoff className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block break-words text-base font-semibold leading-5 sm:text-lg ${styles.title}`}>{title}</span>
          <span className={`mt-1 block break-words text-xs leading-5 sm:text-sm ${styles.description}`}>{description}</span>
          <span className={`mt-2 inline-flex items-center text-xs font-semibold sm:hidden ${styles.cta}`}>
            {copy.homeCardCta}<ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </span>
        </span>
        <span className={`hidden shrink-0 items-center text-sm font-semibold sm:inline-flex ${styles.cta}`}>
          {copy.homeCardCta}<ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </a>
    </section>
  );
}
