import { Image, RefreshCw, Text, BookOpen } from 'lucide-react';

const tips = [
  { title: 'Use imagens de alta qualidade', description: 'Prefira imagens nítidas e atuais.', icon: Image },
  { title: 'Mantenha os textos curtos', description: 'Facilite a leitura no mobile.', icon: Text },
  { title: 'Atualize regularmente', description: 'Mantenha os conteúdos relevantes.', icon: RefreshCw },
] as const;

export function QuickTips() {
  return (
    <section className="rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <h2 className="text-sm font-bold text-[var(--admin-text-strong)]">Dicas rápidas</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tips.map(({ title, description, icon: Icon }) => <div key={title} className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"><Icon className="h-4 w-4" /></span><div><p className="text-[11px] font-semibold text-[var(--admin-text-strong)]">{title}</p><p className="mt-0.5 text-[9px] text-[var(--admin-muted)]">{description}</p></div></div>)}
        <button type="button" disabled className="flex min-h-10 cursor-not-allowed items-center justify-center gap-2 rounded-[9px] border border-[var(--admin-border)] px-3 text-[10px] font-medium text-[var(--admin-muted)]"><BookOpen className="h-4 w-4" />Guia completo — em breve</button>
      </div>
    </section>
  );
}
