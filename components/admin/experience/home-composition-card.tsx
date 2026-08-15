import Link from 'next/link';
import { Building2, ConciergeBell, Contact, Image, LayoutGrid, Plus } from 'lucide-react';

export interface HomeCompositionItem { title: string; description: string; href: string; status: 'Ativo' | 'Sem conteúdo' | 'Em preparação'; icon: 'brand' | 'shortcuts' | 'banner' | 'services' | 'contact' }

const icons = { brand: Building2, shortcuts: LayoutGrid, banner: Image, services: ConciergeBell, contact: Contact };

export function HomeCompositionCard({ items, additionalCount }: { items: HomeCompositionItem[]; additionalCount: number }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-[var(--admin-text-strong)]">Composição da Home</h2><p className="mt-1 text-[10px] leading-4 text-[var(--admin-muted)]">Blocos que aparecem na página inicial.</p></div></div>
      <p className="mt-3 rounded-lg bg-[var(--admin-surface-muted)] px-3 py-2 text-[10px] text-[var(--admin-muted)]">Reordenação disponível em próxima etapa.</p>
      <ol className="mt-3 space-y-2">
        {items.map((item, index) => {
          const Icon = icons[item.icon];
          return <li key={item.title} className="min-w-0"><Link href={item.href} className="flex min-h-[56px] min-w-0 items-center gap-2 rounded-[10px] border border-[var(--admin-border)] px-2.5 py-2 transition hover:border-[var(--admin-focus)]"><span className="text-[10px] font-semibold text-[var(--admin-accent)]">{index + 1}</span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[var(--admin-text-strong)]">{item.title}</span><span className="mt-0.5 block truncate text-[9px] text-[var(--admin-muted)]">{item.description}</span></span><span className={item.status === 'Ativo' ? 'shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-semibold text-emerald-700' : item.status === 'Sem conteúdo' ? 'shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[9px] font-semibold text-amber-700' : 'shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600'}>{item.status}</span></Link></li>;
        })}
      </ol>
      <p className="mt-2 text-center text-[10px] text-[var(--admin-muted)]">+ {additionalCount} blocos adicionais mapeados</p>
      <button type="button" disabled className="mt-3 flex h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--admin-border)] text-xs font-medium text-[var(--admin-muted)]"><Plus className="h-4 w-4" />Adicionar bloco — em breve</button>
    </section>
  );
}
