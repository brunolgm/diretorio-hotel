import Link from 'next/link';
import { Building2, CalendarDays, ChevronDown, ExternalLink } from 'lucide-react';

export function ExperienceHeader({ hotelName, publicUrl, dateLabel, timeLabel }: { hotelName: string; publicUrl: string; dateLabel: string; timeLabel: string }) {
  return (
    <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-sans text-2xl font-bold tracking-[-0.025em] text-[var(--admin-text-strong)] sm:text-[28px]">Experiência Pública</h1>
          <span className="rounded-full bg-[var(--admin-accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--admin-accent)] ring-1 ring-inset ring-[var(--admin-border)]">Novidade</span>
        </div>
        <p className="mt-1 max-w-full text-sm text-[var(--admin-muted)]">Gerencie como seu hotel aparece para os hóspedes no diretório digital.</p>
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
        <details className="group relative min-w-0 sm:w-[250px]">
          <summary className="flex h-12 cursor-pointer list-none items-center gap-3 rounded-[11px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 text-sm font-semibold text-[var(--admin-text-strong)] transition hover:bg-[var(--admin-surface-muted)] [&::-webkit-details-marker]:hidden">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{hotelName}</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-full min-w-56 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1.5 shadow-lg">
            <Link href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]">Visitar experiência pública <ExternalLink className="h-3.5 w-3.5" /></Link>
            <Link href="/admin/hotel" className="block rounded-lg px-3 py-2 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]">Informações do hotel</Link>
            <Link href="/admin/configuracoes" className="block rounded-lg px-3 py-2 text-sm text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]">Configurações</Link>
            <p className="border-t border-[var(--admin-border)] px-3 pt-2 text-[11px] text-[var(--admin-muted)]">Sair permanece disponível no menu lateral.</p>
          </div>
        </details>
        <div className="flex h-12 min-w-0 items-center gap-3 rounded-[11px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 sm:min-w-[190px]">
          <CalendarDays className="h-5 w-5 shrink-0 text-[var(--admin-text-strong)]" />
          <div className="min-w-0"><p className="truncate text-xs font-semibold text-[var(--admin-text-strong)]">{dateLabel}</p><p className="mt-0.5 truncate text-[10px] text-[var(--admin-muted)]">{timeLabel}</p></div>
        </div>
      </div>
    </header>
  );
}
