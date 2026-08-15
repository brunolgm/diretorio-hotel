'use client';

import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PublicExperiencePreview({ publicUrl, hotelName }: { publicUrl: string; hotelName: string }) {
  const [mode, setMode] = useState<'mobile' | 'desktop'>('mobile');

  return (
    <section className="min-w-0 rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <h2 className="text-sm font-bold text-[var(--admin-text-strong)]">Pré-visualização</h2><p className="mt-1 text-[10px] text-[var(--admin-muted)]">Experiência pública real do hotel.</p>
      <div className="mt-3 grid grid-cols-2 border-b border-[var(--admin-border)]">
        <button type="button" onClick={() => setMode('mobile')} className={cn('flex h-9 items-center justify-center gap-2 border-b-2 text-[10px] font-medium', mode === 'mobile' ? 'border-[var(--admin-accent)] text-[var(--admin-accent)]' : 'border-transparent text-[var(--admin-muted)]')}><Smartphone className="h-3.5 w-3.5" />Mobile</button>
        <button type="button" onClick={() => setMode('desktop')} className={cn('flex h-9 items-center justify-center gap-2 border-b-2 text-[10px] font-medium', mode === 'desktop' ? 'border-[var(--admin-accent)] text-[var(--admin-accent)]' : 'border-transparent text-[var(--admin-muted)]')}><Monitor className="h-3.5 w-3.5" />Desktop</button>
      </div>
      <div className="admin-scrollbar-hidden mt-4 flex min-h-[380px] justify-center overflow-auto rounded-[12px] bg-[var(--admin-surface-muted)] p-3">
        <div className={cn('relative overflow-hidden bg-white transition-all', mode === 'mobile' ? 'h-[360px] w-[200px] rounded-[26px] border-[6px] border-slate-800 shadow-md' : 'h-[360px] w-[680px] max-w-none rounded-lg border border-[var(--admin-border)]')}>
          {mode === 'mobile' ? <span className="absolute left-1/2 top-1 z-10 h-2 w-12 -translate-x-1/2 rounded-full bg-slate-800" /> : null}
          <iframe key={mode} src={publicUrl} title={`Pré-visualização pública de ${hotelName}`} sandbox="allow-forms allow-popups allow-same-origin allow-scripts" className={cn('origin-top-left border-0 bg-white', mode === 'mobile' ? 'h-[700px] w-[390px] scale-[0.482]' : 'h-[720px] w-[1360px] scale-50')} />
        </div>
      </div>
    </section>
  );
}
