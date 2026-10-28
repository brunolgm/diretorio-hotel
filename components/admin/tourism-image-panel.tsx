import { AdminSurface, AdminField, AdminHelpText } from '@/components/admin/ui';
import { AdminSubmitButton } from '@/components/admin/form-submit-button';
import { AdminConfirmAction } from '@/components/admin/confirm-action';
import { TourismImage } from '@/components/tourism-image';
import { tourismImageUrl } from '@/lib/tourism/media';
import { uploadTourismImageAction, removeTourismImageAction } from '@/app/admin/turismo/image-actions';

export function TourismImagePanel({ item, canManage }: {
  item: { id: string; hotel_id: string; name: string; main_image_path: string | null; updated_at: string }; canManage: boolean;
}) {
  const src = tourismImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, item.main_image_path, item.hotel_id, item.id);
  const fields = [{ name: 'id', value: item.id }, { name: 'expected_updated_at', value: item.updated_at }];
  return <AdminSurface>
    <h2 className="text-lg font-semibold">Imagem principal</h2>
    <div className="mt-4 max-w-2xl">{src ? <TourismImage src={src} alt={item.name} /> : <p className="text-sm text-[var(--admin-muted)]">Nenhuma imagem válida associada.</p>}</div>
    {canManage ? <>
      <form action={uploadTourismImageAction} className="mt-5 space-y-4">
        {fields.map((field) => <input key={field.name} type="hidden" {...field} />)}
        <AdminField label="Selecionar imagem" htmlFor={`tourism-image-${item.id}`}>
          <input type="file" id={`tourism-image-${item.id}`} name="image" accept="image/jpeg,image/png,image/webp" required className="block max-w-full text-sm" />
          <AdminHelpText>JPEG, PNG ou WebP, até 2 MiB, 6000 × 4000 e 24 milhões de pixels. Prefira imagem horizontal de boa qualidade. Sem recorte automático.</AdminHelpText>
        </AdminField>
        <AdminSubmitButton label={item.main_image_path ? 'Substituir imagem' : 'Enviar imagem'} pendingLabel="Enviando..." />
      </form>
      {item.main_image_path ? <div className="mt-4"><AdminConfirmAction action={removeTourismImageAction} title="Remover imagem principal?" description="O item será preservado. O arquivo será removido após a desassociação confirmada." triggerLabel="Remover imagem" confirmLabel="Remover imagem" pendingLabel="Removendo..." hiddenFields={fields} /></div> : null}
    </> : <p className="mt-3 text-sm text-[var(--admin-muted)]">Seu perfil possui acesso somente para visualização.</p>}
  </AdminSurface>;
}
