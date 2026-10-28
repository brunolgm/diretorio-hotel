import Link from 'next/link';
import { hasHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { AdminSurface, AdminLanguageBadge } from '@/components/admin/ui';
import { summarizeTourismTranslations, TOURISM_TRANSLATION_STATUS_LABELS } from '@/lib/tourism/translations';

export async function TourismLanguageSummary({ hotelId }: { hotelId: string }) {
  if (!(await hasHotelModule('content.tourism'))) return null;
  const client = await createClient();
  const { data: items, error } = await client.from('hotel_tourism_items').select('id,name,short_description,full_description,opening_hours,price_info,duration_info').eq('hotel_id', hotelId).order('sort_order').order('id');
  const translations = items?.length && !error
    ? await client.from('hotel_tourism_item_translations').select('item_id,language,name,short_description,full_description,opening_hours,price_info,duration_info').in('item_id', items.map((item) => item.id))
    : { data: [], error: null };
  if (error || translations.error) return <AdminSurface><h2 className="text-lg font-semibold">Turismo — idiomas</h2><p role="alert" className="mt-3 text-sm">Não foi possível consultar as traduções de Turismo. Recarregue a página.</p></AdminSurface>;
  const rows = summarizeTourismTranslations(items || [], translations.data || []);
  return <AdminSurface>
    <h2 className="text-lg font-semibold">Turismo — idiomas</h2>
    <p className="mt-2 text-sm text-[var(--admin-muted)]">Completude por campo preenchido em PT. Campos opcionais vazios não são exigidos. Abra o detalhe para consultar o conteúdo; a retradução exige perfil de operador.</p>
    <div className="mt-4 flex flex-wrap gap-4 text-sm">{(['en','es'] as const).map((language) => <p key={language}>{language.toUpperCase()}: {rows.filter((row) => row[language] === 'complete').length} completos · {rows.filter((row) => row[language] === 'partial').length} parciais · {rows.filter((row) => row[language] === 'missing').length} ausentes</p>)}</div>
    {!rows.length ? <p className="mt-4 text-sm">Nenhum item de Turismo cadastrado.</p> : <ul className="mt-4 space-y-3">{rows.map((row) => <li key={row.id} className="rounded-xl border border-[var(--admin-border)] p-4"><Link href={`/admin/turismo/${row.id}`} className="inline-flex min-h-11 items-center font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2">{row.name}</Link><div className="mt-2 flex flex-wrap gap-2"><AdminLanguageBadge label="Português —" available source />{(['en','es'] as const).map((language) => <AdminLanguageBadge key={language} label={`${language.toUpperCase()} — ${TOURISM_TRANSLATION_STATUS_LABELS[row[language]]}`} available={row[language] === 'complete'} />)}</div></li>)}</ul>}
  </AdminSurface>;
}
