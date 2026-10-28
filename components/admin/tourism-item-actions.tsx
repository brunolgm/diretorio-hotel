import type { Database } from '@/types/database';
import { publishTourismItemAction, moveTourismItemAction, deleteTourismItemAction } from '@/app/admin/turismo/actions';
import { AdminConfirmAction } from '@/components/admin/confirm-action';
import { AdminSubmitButton } from '@/components/admin/form-submit-button';
import { AdminLinkButton } from '@/components/admin/ui';

export function TourismItemActions({ item, position, total }: { item: Database['public']['Tables']['hotel_tourism_items']['Row']; position?: number; total?: number }) {
  return <>
    <AdminLinkButton href={`/admin/turismo/${item.id}`}>Editar</AdminLinkButton>
    <form action={publishTourismItemAction}>
      <input type="hidden" name="id" value={item.id} /><input type="hidden" name="expected_updated_at" value={item.updated_at} />
      <input type="hidden" name="is_published" value={String(!item.is_published)} />
      <AdminSubmitButton label={item.is_published ? 'Despublicar' : 'Publicar'} pendingLabel="Salvando..." variant="secondary" />
    </form>
    {position !== undefined && total !== undefined ? (['up', 'down'] as const).map((direction) => <form key={direction} action={moveTourismItemAction}>
      <input type="hidden" name="id" value={item.id} /><input type="hidden" name="direction" value={direction} />
      <button type="submit" disabled={direction === 'up' ? position === 0 : position === total - 1} aria-label={`Mover ${item.name} para ${direction === 'up' ? 'cima' : 'baixo'}`} className="h-11 rounded-xl border border-[var(--admin-border)] px-4 disabled:opacity-40">{direction === 'up' ? 'Subir' : 'Descer'}</button>
    </form>) : null}
    <AdminConfirmAction
      action={deleteTourismItemAction} title={`Excluir ${item.name}?`} description="A exclusão é definitiva e remove também as traduções. Para retirar temporariamente, use Despublicar."
      triggerLabel="Excluir" confirmLabel="Excluir definitivamente" pendingLabel="Excluindo..."
      hiddenFields={[{ name: 'id', value: item.id }, { name: 'expected_updated_at', value: item.updated_at }]} />
  </>;
}
