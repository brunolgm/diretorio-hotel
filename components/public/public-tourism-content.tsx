import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { TourismImage } from '@/components/tourism-image';
import { LanguageSwitcher } from '@/components/public/language-switcher';
import { PublicAnalytics } from '@/components/public/public-analytics';
import { resolveHotelTheme } from '@/lib/hotel-theme';
import { TOURISM_TYPES, TOURISM_CATEGORIES } from '@/lib/tourism/catalog';
import { tourismPublicCopy } from '@/lib/tourism/public-copy';
import { tourismFilter, tourismHttpsUrl, tourismPhone, type PublicTourismData } from '@/lib/tourism/public';
import { tourismImageUrl } from '@/lib/tourism/media';
import type { DomainContext } from '@/lib/domain-context';
import { buildPublicHotelAreaHref, buildPublicHotelHref, buildPublicHotelTourismItemHref } from '@/lib/public-routes';

export function PublicTourismContent({ data, language, domainContext, preferSubdomainRoot, detail = false, filter }: {
  data: PublicTourismData; language: 'pt' | 'en' | 'es'; domainContext: DomainContext; preferSubdomainRoot: boolean; detail?: boolean; filter?: string;
}) {
  const { hotel, items } = data;
  const theme = resolveHotelTheme(hotel.theme_preset, hotel.theme_primary_color);
  const copy = tourismPublicCopy(language);
  const route = { slug: hotel.slug, language, domainContext, preferSubdomainRoot };
  const catalogHref = buildPublicHotelAreaHref({ ...route, area: 'turismo' });
  const homeHref = buildPublicHotelHref(route);
  const item = detail ? items[0] : null;
  const selected = tourismFilter(filter);
  const shown = selected ? items.filter((row) => row.type === selected) : items;
  const image = (row: typeof items[number]) => tourismImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, row.main_image_path, hotel.id, row.id);
  const category = (row: typeof items[number]) => TOURISM_CATEGORIES.find((c) => c.type === row.type && c.key === row.category_key)?.labels[language];
  const languageBase = detail && item ? buildPublicHotelTourismItemHref({ ...route, language: 'pt', itemSlug: item.slug }) : buildPublicHotelAreaHref({ ...route, language: 'pt', area: 'turismo' });
  const externalLinks = item ? [
    { href: tourismHttpsUrl(item.official_website_url), label: copy.website },
    { href: tourismHttpsUrl(item.map_url), label: copy.map },
    { href: tourismPhone(item.whatsapp_number) ? `https://wa.me/${item.whatsapp_number!.slice(1)}` : null, label: copy.whatsapp },
  ] : [];
  return <main className="hotel-theme-page min-h-dvh" style={theme.cssVars} data-hotel-theme={theme.preset}>
    <PublicAnalytics hotelSlug={hotel.slug} language={language} />
    <div className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-10">
      <header className="hotel-theme-hero p-5 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><a href={detail ? catalogHref : homeHref} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hotel-accent)]"><ArrowLeft className="h-4 w-4" />{detail ? copy.back : copy.home}</a><LanguageSwitcher slug={hotel.slug} currentLanguage={language} basePath={languageBase} /></div>
        <p className="mt-5 text-sm text-[color:var(--hotel-hero-muted)]">{hotel.name}</p>
        <h1 className="mt-2 break-words text-3xl font-semibold">{item?.name || copy.title}</h1>
        <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words leading-7 text-[color:var(--hotel-hero-muted)]">{item?.short_description || copy.intro}</p>
      </header>
      {!detail ? <>
        <nav aria-label={copy.title} className="my-5 flex flex-wrap gap-2">{[{ key: null, label: copy.all }, ...TOURISM_TYPES.map((t) => ({ key: t.key, label: t.key === 'PLACE' ? copy.places : t.key === 'EXPERIENCE' ? copy.experiences : t.labels[language] }))].map((type) => <a key={type.key || 'all'} href={`${catalogHref}${catalogHref.includes('?') ? '&' : '?'}${type.key ? `type=${type.key}` : ''}`} aria-current={selected === type.key ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded-full border border-[color:var(--hotel-border)] px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${selected === type.key ? 'bg-[var(--hotel-accent)] text-[color:var(--hotel-accent-foreground)]' : 'bg-[var(--hotel-surface)] text-[color:var(--hotel-text)]'}`}>{type.label}</a>)}</nav>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{shown.map((row) => <a key={row.id} data-tourism-item href={buildPublicHotelTourismItemHref({ ...route, itemSlug: row.slug })} className="hotel-theme-card min-w-0 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hotel-accent)]">
          <TourismImage src={image(row)} alt={row.name} />
          <p className="mt-3 text-xs text-[color:var(--hotel-text-muted)]">{TOURISM_TYPES.find((t) => t.key === row.type)?.labels[language]} · {category(row)}</p>
          <h2 className="mt-2 break-words text-xl font-semibold">{row.name}</h2><p className="mt-2 break-words text-sm leading-6 text-[color:var(--hotel-text-muted)]">{row.short_description}</p>
          <p className="mt-3 flex flex-wrap gap-2 text-xs">{row.featured ? <span>{copy.featured}</span> : null}{row.recommended_by_hotel ? <span>{copy.recommended}</span> : null}</p><span className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--hotel-accent)]">{copy.open} →</span>
        </a>)}</div>
        {!shown.length ? <p className="hotel-theme-card mt-5 p-6">{copy.empty}</p> : null}
      </> : item ? <article className="hotel-theme-card mt-5 space-y-6 p-5 md:p-8">
        <div className="max-w-3xl"><TourismImage src={image(item)} alt={item.name} /></div>
        <p className="text-sm text-[color:var(--hotel-text-muted)]">{TOURISM_TYPES.find((t) => t.key === item.type)?.labels[language]} · {category(item)}</p>
        {item.full_description ? <p className="whitespace-pre-wrap break-words leading-7">{item.full_description}</p> : null}
        <dl className="grid gap-4 sm:grid-cols-2">{[{ label: copy.address, value: item.address },{ label: copy.hours, value: item.opening_hours },{ label: copy.price, value: item.price_info },{ label: copy.duration, value: item.duration_info }].filter((field) => field.value).map((field) => <div key={field.label}><dt className="text-sm font-semibold">{field.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--hotel-text-muted)]">{field.value}</dd></div>)}</dl>
        <div className="flex flex-wrap gap-3">{externalLinks.filter((link) => link.href).map((link) => <a key={link.label} href={link.href!} target="_blank" rel="noopener noreferrer" aria-label={`${link.label} — ${copy.external}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color:var(--hotel-border)] px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2">{link.label}<ArrowUpRight className="h-4 w-4" /></a>)}{tourismPhone(item.phone) ? <a href={`tel:${item.phone}`} className="inline-flex min-h-11 items-center rounded-xl border border-[color:var(--hotel-border)] px-4 text-sm">{copy.phone}: {item.phone}</a> : null}</div>
      </article> : null}
      <footer className="py-8 text-center text-xs text-[color:var(--hotel-text-muted)]">Powered by LibGuest</footer>
    </div>
  </main>;
}
