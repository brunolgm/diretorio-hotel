import { Check, Clock3, FileText, Globe2, Star } from 'lucide-react';

interface ExperienceMetricsProps {
  status: { label: string; description: string; active: boolean };
  lastUpdated: string;
  languages: string[];
  publishedAreas: number;
  totalAreas: number;
  featuredItems: number;
}

const cards = [
  { key: 'status', label: 'Status da Experiência', icon: Check },
  { key: 'updated', label: 'Última Atualização', icon: Clock3 },
  { key: 'languages', label: 'Idiomas Ativos', icon: Globe2 },
  { key: 'published', label: 'Páginas / Publicações', icon: FileText },
  { key: 'featured', label: 'Itens em Destaque', icon: Star },
] as const;

export function ExperienceMetrics({ status, lastUpdated, languages, publishedAreas, totalAreas, featuredItems }: ExperienceMetricsProps) {
  const values = {
    status: { value: status.label, description: status.description },
    updated: { value: lastUpdated, description: 'Timestamp mais recente' },
    languages: { value: String(languages.length), description: languages.join(', ') || 'Nenhum idioma identificado' },
    published: { value: `${publishedAreas} de ${totalAreas}`, description: 'Áreas reais com conteúdo' },
    featured: { value: String(featuredItems), description: featuredItems === 1 ? 'Banner elegível' : 'Banners elegíveis' },
  };

  return (
    <section aria-label="Métricas da experiência" className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
      {cards.map(({ key, label, icon: Icon }, index) => (
        <article key={key} className={index === 4 ? 'col-span-2 min-w-0 overflow-hidden rounded-[11px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3.5 sm:col-span-1' : 'min-w-0 overflow-hidden rounded-[11px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3.5'}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-[10px] font-medium text-[var(--admin-muted)]">{label}</p><p className={key === 'status' && status.active ? 'mt-2 truncate text-lg font-bold text-emerald-700' : 'mt-2 truncate text-lg font-bold text-[var(--admin-text-strong)]'}>{values[key].value}</p></div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"><Icon className="h-5 w-5" /></span>
          </div>
          <p className="mt-1 truncate text-[10px] text-[var(--admin-muted)]">{values[key].description}</p>
        </article>
      ))}
    </section>
  );
}
