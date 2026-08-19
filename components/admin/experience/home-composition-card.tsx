import Link from 'next/link';
import { ChevronDown, ChevronUp, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { moveExperienceBlockAction, updateExperienceBlockAction } from '@/app/admin/experiencia/actions';
import { EXPERIENCE_BLOCK_CATALOG, type ExperienceLayoutBlock } from '@/lib/experience-layout';
import type { ModuleKey } from '@/lib/modules/catalog';

export function HomeCompositionCard({ layout, enabledModules, canEdit }: {
  layout: ExperienceLayoutBlock[];
  enabledModules: ReadonlySet<ModuleKey>;
  canEdit: boolean;
}) {
  const definitions = new Map(EXPERIENCE_BLOCK_CATALOG.map((block) => [block.key,block]));
  return (
    <section className="min-w-0 rounded-[12px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:p-5">
      <div><h2 className="text-base font-bold text-[var(--admin-text-strong)]">Composição da Home</h2><p className="mt-1 text-xs leading-5 text-[var(--admin-muted)]">Organize blocos estruturados. Conteúdo e tema continuam sendo editados em seus módulos.</p></div>
      <ol className="mt-4 space-y-3">
        {layout.map((item,index) => {
          const definition = definitions.get(item.blockKey)!;
          const entitled = enabledModules.has(definition.requiredModule);
          const visible = item.isEnabled && entitled;
          return <li key={item.blockKey} className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-accent-soft)] text-xs font-bold text-[var(--admin-accent)]">{index+1}</span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link href={definition.adminHref} className="font-semibold text-[var(--admin-text-strong)] hover:text-[var(--admin-accent)]">{definition.label}</Link>{definition.required ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Obrigatório</span> : null}</div><p className="mt-1 text-xs leading-5 text-[var(--admin-muted)]">{definition.description}</p><p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--admin-muted)]">{!entitled ? <><LockKeyhole className="h-3.5 w-3.5" />Módulo indisponível</> : visible ? <><Eye className="h-3.5 w-3.5 text-emerald-600" />Visível</> : <><EyeOff className="h-3.5 w-3.5" />Oculto</>}</p></div>
              {canEdit ? <div className="grid shrink-0 grid-cols-2 gap-1 sm:grid-cols-1">
                <form action={moveExperienceBlockAction}><input type="hidden" name="block_key" value={item.blockKey} /><input type="hidden" name="direction" value="up" /><button type="submit" disabled={definition.required || index<=1} aria-label={`Mover ${definition.label} para cima`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] disabled:cursor-not-allowed disabled:opacity-35"><ChevronUp className="h-4 w-4" /></button></form>
                <form action={moveExperienceBlockAction}><input type="hidden" name="block_key" value={item.blockKey} /><input type="hidden" name="direction" value="down" /><button type="submit" disabled={definition.required || index===layout.length-1} aria-label={`Mover ${definition.label} para baixo`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] disabled:cursor-not-allowed disabled:opacity-35"><ChevronDown className="h-4 w-4" /></button></form>
              </div> : null}
            </div>
            {canEdit && !definition.required ? <form action={updateExperienceBlockAction} className="mt-3 border-t border-[var(--admin-border)] pt-3"><input type="hidden" name="block_key" value={item.blockKey} /><input type="hidden" name="enabled" value={visible ? 'false' : 'true'} /><button type="submit" disabled={!entitled} className="text-xs font-semibold text-[var(--admin-accent)] disabled:cursor-not-allowed disabled:text-[var(--admin-muted)]">{visible ? 'Ocultar bloco' : 'Mostrar bloco'}</button></form> : null}
          </li>;
        })}
      </ol>
      {!canEdit ? <p className="mt-4 rounded-lg bg-[var(--admin-surface-muted)] p-3 text-xs text-[var(--admin-muted)]">Seu perfil possui acesso somente para visualização. Editores e administradores podem alterar a composição.</p> : null}
    </section>
  );
}
