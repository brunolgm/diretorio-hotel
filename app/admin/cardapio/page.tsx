import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminAccess, hasMinimumRole } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { FB_KINDS, FB_TABLES, FB_TRANSLATION_TABLES, FB_LIMITS, isFbKind, type FbGraph, type FbRecord, type FbTranslation } from '@/lib/fb/types';
import { readFbRows } from '@/lib/fb/pagination';
import { fbWorkspacePage, type FbWorkspaceFilters } from '@/lib/fb/admin-workspace';
import { readFbWorkspaceLinks, readFbWorkspaceMode } from '@/lib/fb/admin-workspace.server';
import { fbTranslationStatus } from '@/lib/fb/translations';
import { FbCatalogueWorkspace, type FbLanguageState } from '@/components/admin/fb-workspace';
import { AdminInlineError } from '@/components/admin/ui';
import { FeedbackToast } from '@/components/feedback-toast';

export default async function AdminMenuPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { profile } = await requireAdminAccess('visualizador'); await requireHotelModule('fb.menu');
  const raw = await searchParams || {};
  const params = Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const kind = isFbKind(params.kind) ? params.kind : 'outlet';
  const overview = !isFbKind(params.kind) && !params.id && params.new !== '1';
  const canManage = hasMinimumRole(profile.normalizedRole, 'operador');
  const client = await createClient();
  // Existing tenant-scoped graph and pagination contract; rich UI is bounded to 24 rows.
  const [results, links, serviceLinks, services, hotel, workspaceLinks, mode] = await Promise.all([
    Promise.all(FB_KINDS.map(k => readFbRows((from, to) => client.from(FB_TABLES[k]).select('*', { count: 'exact' }).eq('hotel_id', profile.hotel_id).order('sort_order').order('id').range(from, to), FB_LIMITS[k], row => row.id))),
    readFbRows((from, to) => client.from('hotel_fb_outlet_menus').select('*', { count: 'exact' }).eq('hotel_id', profile.hotel_id).order('outlet_id').order('menu_id').range(from, to), 5000, row => row.outlet_id + ':' + row.menu_id),
    client.from('hotel_fb_service_links').select('*').eq('hotel_id', profile.hotel_id),
    readFbRows((from, to) => client.from('hotel_sections').select('id,title,enabled', { count: 'exact' }).eq('hotel_id', profile.hotel_id).order('sort_order').order('id').range(from, to), 10000, row => row.id),
    client.from('hotels').select('name,slug').eq('id', profile.hotel_id).single(),
    readFbWorkspaceLinks({ editorial: true, operationalRole: canManage }),
    readFbWorkspaceMode(),
  ]);
  if ([...results, links, serviceLinks, services, hotel].some(result => result.error) || !hotel.data) throw new Error('Não foi possível carregar Gastronomia deste hotel.');
  const graph = { outlets: results[0].data || [], menus: results[1].data || [], categories: results[2].data || [], items: results[3].data || [], outlet_menus: links.data || [], service_links: serviceLinks.data || [] } as FbGraph;
  const all = (results[FB_KINDS.indexOf(kind)].data || []) as FbRecord[];
  const row = params.id ? all.find(candidate => candidate.id === params.id) : undefined;
  if (params.id && !row) notFound();
  const filters: FbWorkspaceFilters = Object.fromEntries(['q', 'status', 'outlet', 'menu', 'category', 'availability', 'parent', 'page'].filter(key => params[key]).map(key => [key, params[key]]));
  const visible = fbWorkspacePage(graph, kind, filters).rows;
  const languageSources = row ? [row] : visible;
  const languages: FbLanguageState = {};
  if (languageSources.length) {
    const translated = await client.from(FB_TRANSLATION_TABLES[kind]).select('*').eq('hotel_id', profile.hotel_id).in('entity_id', languageSources.map(candidate => candidate.id));
    if (translated.error) throw new Error('Não foi possível consultar os idiomas deste conteúdo.');
    const translations = (translated.data || []) as unknown as FbTranslation[];
    for (const source of languageSources) languages[source.id] = { en: fbTranslationStatus(kind, source, translations.find(value => value.entity_id === source.id && value.language === 'en')), es: fbTranslationStatus(kind, source, translations.find(value => value.entity_id === source.id && value.language === 'es')) };
  }
  return <main className="space-y-4"><FeedbackToast success={params.success} warning={params.warning} error={params.error}/><AdminInlineError message={params.error}/>{hotel.data.slug === 'bugan-recife' && hasMinimumRole(profile.normalizedRole, 'editor') ? <Link className="inline-flex min-h-11 items-center rounded-lg border border-[var(--admin-border)] px-3 py-2" href="/admin/cardapio/comercial">Combos e adicionais do Room Service</Link> : null}<FbCatalogueWorkspace graph={graph} services={services.data || []} kind={kind} overview={overview} row={row} creating={params.new === '1' && canManage} filters={filters} canManage={canManage} languages={languages} links={workspaceLinks} mode={mode} hotel={hotel.data}/></main>;
}
