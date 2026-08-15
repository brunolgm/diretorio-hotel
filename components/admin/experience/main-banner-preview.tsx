import Image from 'next/image';
import Link from 'next/link';
import { ImageIcon, Settings } from 'lucide-react';

export interface MainBannerData { title: string; subtitle: string | null; imageUrl: string | null; ctaLabel: string | null }

export function MainBannerPreview({ banner, position, total }: { banner: MainBannerData | null; position: number; total: number }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <h2 className="text-sm font-bold text-[var(--admin-text-strong)]">Banner Principal</h2><p className="mt-1 text-[10px] text-[var(--admin-muted)]">Banner elegível exibido em destaque.</p>
      <div className="relative mt-4 aspect-[16/8.6] min-h-[230px] overflow-hidden rounded-[10px] bg-[var(--admin-surface-muted)]">
        {banner ? <><div className="absolute inset-0 z-10 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />{banner.imageUrl ? <Image src={banner.imageUrl} alt="" fill sizes="(max-width: 768px) 100vw, 45vw" unoptimized className="object-cover" /> : null}<div className="absolute inset-y-0 left-0 z-20 flex w-[58%] flex-col justify-center p-5 text-white"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/75">Em destaque</p><h3 className="mt-2 text-xl font-bold leading-tight">{banner.title}</h3>{banner.subtitle ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/80">{banner.subtitle}</p> : null}{banner.ctaLabel ? <span className="mt-3 w-fit rounded-lg bg-[var(--admin-accent)] px-3 py-2 text-[10px] font-semibold text-[var(--admin-accent-text)]">{banner.ctaLabel}</span> : null}</div></> : <div className="flex h-full flex-col items-center justify-center p-6 text-center"><ImageIcon className="h-8 w-8 text-[var(--admin-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--admin-text-strong)]">Nenhum banner elegível</p><p className="mt-1 text-xs text-[var(--admin-muted)]">A área mantém a proporção da experiência real.</p></div>}
      </div>
      {total > 1 ? <div className="mt-3 flex justify-center gap-1.5" aria-label={`Banner ${position} de ${total}`}>{Array.from({ length: Math.min(total, 6) }, (_, index) => <span key={index} className={index === position - 1 ? 'h-2 w-2 rounded-full bg-[var(--admin-accent)]' : 'h-2 w-2 rounded-full bg-[var(--admin-border)]'} />)}</div> : null}
      <Link href="/admin/banners" className="mt-4 inline-flex h-9 items-center gap-2 rounded-[9px] border border-[var(--admin-border)] px-3 text-xs font-medium text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]"><Settings className="h-3.5 w-3.5" />Gerenciar banners</Link>
    </section>
  );
}
