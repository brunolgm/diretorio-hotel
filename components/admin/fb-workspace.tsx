import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, FileText, Layers, Plus, Store, UtensilsCrossed } from 'lucide-react';
import { AdminBreadcrumbs, AdminEmptyState, AdminLinkButton, AdminSearchInput, AdminSelect, AdminStatCard, AdminStatusPill } from './ui';
import { FbEditor, FbImagePanel, FbRecordActions, FbReorderForm, FbOutletOrderDialog } from './fb-editor';
import { FbWorkspaceHeader } from './fb-workspace-header';
import { PublicExperiencePreview } from './experience/public-experience-preview';
import { fbImageUrl } from '@/lib/fb/media';
import { fbPrice } from '@/lib/fb/public';
import { fbOutletCounts, fbPublicationSummary, fbWorkspacePage, fbWorkspaceStats, type FbWorkspaceFilters, type FbWorkspaceLink } from '@/lib/fb/admin-workspace';
import type { FbGraph, FbItem, FbKind, FbOutlet, FbRecord } from '@/lib/fb/types';
import type { PublicHotelSection } from '@/lib/public-hotel-data';
import './fb-workspace.css';

const plural = { outlet: 'Estabelecimentos', menu: 'Cardápios', category: 'Categorias', item: 'Itens' };
const singular = { outlet: 'estabelecimento', menu: 'cardápio', category: 'categoria', item: 'item' };
const outletTypes = { restaurant: 'Restaurante', bar: 'Bar', room_service: 'Room Service', breakfast: 'Café da manhã', cafe: 'Café', other: 'Outro' };
export type FbLanguageState = Record<string, { en: string; es: string }>;
const rowHref = (kind: FbKind, id: string) => '/admin/cardapio?' + new URLSearchParams({ kind, id });


function ListFilters({ kind, graph, filters, overview = false }: { kind: FbKind; graph: FbGraph; filters: FbWorkspaceFilters; overview?: boolean }) {
  return <form action="/admin/cardapio" method="get" className="fb-workspace-filters" aria-label="Filtrar conteúdo gastronômico">{!overview ? <input type="hidden" name="kind" value={kind}/> : null}{filters.parent ? <input type="hidden" name="parent" value={filters.parent}/> : null}
    <label><span>Buscar {singular[kind]}</span><AdminSearchInput name="q" placeholder={'Buscar ' + singular[kind] + '…'} defaultValue={filters.q} maxLength={120}/></label>
    {kind !== 'outlet' ? <label>Estabelecimento<AdminSelect name="outlet" defaultValue={filters.outlet || ''}><option value="">Todos</option>{graph.outlets.map(outlet => <option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</AdminSelect></label> : null}
    {kind === 'item' ? <><label>Cardápio<AdminSelect name="menu" defaultValue={filters.menu || ''}><option value="">Todos</option>{graph.menus.map(menu => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</AdminSelect></label><label>Categoria<AdminSelect name="category" defaultValue={filters.category || ''}><option value="">Todas</option>{graph.categories.filter(category => !filters.menu || category.menu_id === filters.menu).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</AdminSelect></label><label>Disponibilidade<AdminSelect name="availability" defaultValue={filters.availability || ''}><option value="">Todas</option><option value="available">Disponível</option><option value="unavailable">Indisponível</option></AdminSelect></label></> : null}
    <label><span>Status</span><AdminSelect name="status" defaultValue={filters.status || ''}><option value="">Todos os status</option><option value="published">Publicado</option><option value="draft">Rascunho</option></AdminSelect></label>
    <button className="min-h-11 rounded-lg bg-[var(--admin-accent)] px-4 text-sm font-semibold text-[var(--admin-accent-text)]" type="submit">Filtrar</button><Link href={overview ? '/admin/cardapio' : '/admin/cardapio?kind=' + kind + (filters.parent ? '&parent=' + encodeURIComponent(filters.parent) : '')} className="min-h-11 content-center rounded-md px-2 text-sm text-[var(--admin-muted)]">Limpar</Link>
  </form>;
}

function LanguageBadges({ value }: { value?: { en: string; es: string } }) {
  return <div className="fb-workspace-language-badges"><span>PT · fonte</span>{(['en', 'es'] as const).map(language => <span key={language}>{language.toUpperCase()} · {value?.[language] === 'Completo' ? 'disponível' : value?.[language] === 'Parcial' ? 'parcial' : 'pendente'}</span>)}</div>;
}

function CatalogueCard({ kind, row, graph, canManage, languages }: { kind: FbKind; row: FbRecord; graph: FbGraph; canManage: boolean; languages: FbLanguageState }) {
  const outlet = kind === 'outlet' ? row as FbOutlet : null;
  const item = kind === 'item' ? row as FbItem : null;
  const photo = (outlet || item) ? fbImageUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, (outlet || item)!.main_image_path, row.hotel_id, kind, row.id) : null;
  const counts = outlet ? fbOutletCounts(graph, row.id) : null;
  const categories = kind === 'menu' ? graph.categories.filter(category => category.menu_id === row.id) : [];
  const categoryIds = new Set(categories.map(category => category.id));
  const associatedOutlets = kind === 'menu' ? graph.outlets.filter(candidate => graph.outlet_menus.some(link => link.menu_id === row.id && link.outlet_id === candidate.id)) : [];
  const category = item ? graph.categories.find(candidate => candidate.id === item.category_id) : null;
  const description = 'short_description' in row ? row.short_description : 'description' in row ? row.description : null;
  return <article className="fb-workspace-card" data-fb-admin-record>
    {outlet || item ? photo ? <Image unoptimized src={photo} alt={row.name} width={outlet ? 400 : 176} height={outlet ? 200 : 156} sizes={outlet ? '(max-width: 540px) 100vw, 200px' : '88px'} className={outlet ? 'fb-workspace-photo' : 'fb-workspace-item-photo'}/> : <div aria-hidden="true" className={(outlet ? 'fb-workspace-photo' : 'fb-workspace-item-photo') + ' fb-workspace-photo-placeholder'}><UtensilsCrossed size={30}/></div> : <div className="fb-workspace-symbol" aria-hidden="true">{kind === 'menu' ? <FileText size={25}/> : <Layers size={25}/>}</div>}
    <div className="fb-workspace-card-copy"><h3>{row.name}</h3>{outlet ? <p>{outletTypes[outlet.type]}{outlet.location_info ? ' · ' + outlet.location_info : ''}{outlet.opening_hours ? ' · ' + outlet.opening_hours : ''}</p> : null}{associatedOutlets.length ? <p>{associatedOutlets.map(candidate => candidate.name).join(' · ')}</p> : null}{category ? <p>{category.name}</p> : null}{description ? <p className="line-clamp-2">{description}</p> : null}{item ? <p className="font-semibold text-[var(--admin-text-strong)]">{fbPrice(item, 'pt') || 'Sob consulta'} · {item.is_available ? 'Disponível editorialmente' : 'Indisponível editorialmente'}</p> : null}<LanguageBadges value={languages[row.id]}/></div>
    <div className="fb-workspace-card-meta">{counts ? <><span><FileText size={16} aria-hidden="true"/>{counts.menus} {counts.menus === 1 ? 'cardápio' : 'cardápios'}</span><span><UtensilsCrossed size={16} aria-hidden="true"/>{counts.items} {counts.items === 1 ? 'item' : 'itens'}</span></> : kind === 'menu' ? <><span><Layers size={16} aria-hidden="true"/>{categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}</span><span><UtensilsCrossed size={16} aria-hidden="true"/>{graph.items.filter(candidate => categoryIds.has(candidate.category_id)).length} {graph.items.filter(candidate => categoryIds.has(candidate.category_id)).length === 1 ? 'item' : 'itens'}</span></> : null}<AdminStatusPill publication active={row.is_published} activeText="Publicado" inactiveText="Rascunho"/></div>
    <div className="fb-workspace-card-actions">{kind === 'category' ? <AdminLinkButton href={'/admin/cardapio?kind=item&parent=' + row.id}>Ver itens</AdminLinkButton> : null}<FbRecordActions kind={kind} row={row} canManage={canManage}/><AdminLinkButton href={rowHref(kind, row.id)}>{outlet ? 'Gerenciar' : canManage ? 'Editar' : 'Visualizar'}<ChevronRight className="ml-2 h-4 w-4" aria-hidden="true"/></AdminLinkButton></div>
  </article>;
}

export function FbCatalogueWorkspace({ graph, services, kind, overview, row, creating, filters, canManage, languages, links, mode, hotel }: { graph: FbGraph; services: Pick<PublicHotelSection, 'id' | 'title' | 'enabled'>[]; kind: FbKind; overview: boolean; row?: FbRecord; creating: boolean; filters: FbWorkspaceFilters; canManage: boolean; languages: FbLanguageState; links: FbWorkspaceLink[]; mode: { mode: 'catalog_only' | 'ordering' | null; unavailable: 'permission' | 'error' | null }; hotel: { name: string; slug: string } }) {
  const active = overview ? 'overview' : kind === 'category' ? 'menu' : kind;
  const editing = !!row || creating;
  const page = fbWorkspacePage(graph, kind, filters);
  const newHref = '/admin/cardapio?' + new URLSearchParams({ kind: overview ? 'outlet' : kind, new: '1', ...(filters.parent ? { parent: filters.parent } : {}) });
  const paginationHref = (number: number) => '/admin/cardapio?' + new URLSearchParams({ ...(!overview ? { kind } : {}), ...Object.fromEntries(Object.entries(filters).filter(([, value]) => !!value)), page: String(number) });
  const siblings = kind === 'category' ? graph.categories.filter(candidate => candidate.menu_id === filters.parent) : kind === 'item' ? graph.items.filter(candidate => candidate.category_id === filters.parent) : kind === 'outlet' ? graph.outlets : graph.menus;
  const canReorder = !filters.q && !filters.status && !filters.outlet && !filters.availability && !filters.category && !filters.menu && (kind === 'menu' || kind === 'outlet' || !!filters.parent);
  const categoryMenu = kind === 'category' ? graph.menus.find(menu => menu.id === (filters.parent || ('menu_id' in (row || {}) ? (row as { menu_id: string }).menu_id : ''))) : kind === 'menu' ? row : null;
  return <div className="fb-workspace" data-fb-admin-workspace>
    {editing ? <AdminBreadcrumbs items={[{ label: 'Gastronomia', href: '/admin/cardapio' }, { label: plural[kind], href: '/admin/cardapio?kind=' + kind }, { label: (row ? 'Editar ' : 'Criar ') + singular[kind] }]}/> : null}
    <FbWorkspaceHeader links={links} active={active} action={!editing && canManage ? <AdminLinkButton variant="primary" className={overview ? "fb-overview-create-outlet" : undefined} href={newHref}><Plus size={18} className="mr-2" aria-hidden="true"/>{kind === 'category' ? 'Nova' : 'Novo'} {singular[overview ? 'outlet' : kind]}</AdminLinkButton> : null} mode={mode}/>
    {overview ? <div className="fb-workspace-metrics">{fbWorkspaceStats(graph).map(stat => { const Icon = { outlet: Store, menu: FileText, category: Layers, item: UtensilsCrossed }[stat.kind]; return <AdminStatCard key={stat.kind} compact title={plural[stat.kind]} value={String(stat.total)} icon={<Icon size={26} aria-hidden="true"/>} description={fbPublicationSummary(stat.published, stat.drafts, stat.kind === 'category')}/>; })}</div> : null}
    {editing ? <div className="fb-workspace-editor-grid"><section className="fb-workspace-editor"><FbEditor key={kind + (row?.id || 'new') + ':' + (row?.revision || 0)} kind={kind} row={row} graph={{ ...graph, outlets: [], items: [] }} services={services} canManage={canManage} initialParentId={filters.parent} translationStatus={row ? languages[row.id] : undefined} imagePanel={row ? <FbImagePanel kind={kind} row={row} canManage={canManage}/> : null}/>{categoryMenu ? <div className="mt-5 border-t border-[var(--admin-border)] pt-5"><h3 className="mb-3 font-semibold">Categorias deste cardápio</h3><AdminLinkButton href={'/admin/cardapio?kind=category&parent=' + categoryMenu.id}>Gerenciar categorias</AdminLinkButton>{canManage ? <AdminLinkButton className="ml-2" href={'/admin/cardapio?kind=category&parent=' + categoryMenu.id + '&new=1'}>Criar categoria</AdminLinkButton> : null}</div> : null}</section><aside className="space-y-3"><h2 className="font-semibold text-[var(--admin-text-strong)]">Visualização para o hóspede</h2><p className="text-xs leading-5 text-[var(--admin-muted)]">Estado salvo da experiência pública. Rascunhos e alterações ainda não salvas não aparecem nesta prévia.</p><PublicExperiencePreview publicUrl={'/hotel/' + encodeURIComponent(hotel.slug) + '/explorar/cardapio'} hotelName={hotel.name} previewVersion={String(row?.revision || 0)}/></aside></div> : <>
      <div className="fb-workspace-section-head"><div className="flex flex-wrap items-center gap-2"><h2>{overview || kind === 'outlet' ? 'Estabelecimentos gastronômicos' : categoryMenu ? 'Categorias · ' + categoryMenu.name : plural[kind]}</h2>{overview && canReorder && canManage && siblings.length > 1 ? <FbOutletOrderDialog rows={siblings.map(({id,name,revision})=>({id,name,revision}))}/> : null}</div>{kind === 'outlet' ? <ListFilters kind={kind} graph={graph} filters={filters} overview={overview}/> : null}</div>
      {kind !== 'outlet' ? <ListFilters kind={kind} graph={graph} filters={filters}/> : null}
      {page.total ? <><p className="text-xs text-[var(--admin-muted)]" role="status">{page.total} {page.total === 1 ? singular[kind] : plural[kind].toLocaleLowerCase('pt-BR')}</p><div className="fb-workspace-list">{page.rows.map(candidate => <CatalogueCard key={candidate.id} kind={kind} row={candidate} graph={graph} canManage={canManage} languages={languages}/>)}</div>{canReorder && !overview ? <FbReorderForm key={kind + (filters.parent || '') + page.page} kind={kind} rows={siblings} visibleRows={page.rows} parentId={filters.parent} canManage={canManage}/> : null}<nav aria-label="Paginação gastronômica" className="fb-workspace-pagination"><span>Página {page.page} de {page.pages} · até 24 registros por página</span><div className="flex gap-3">{page.page > 1 ? <AdminLinkButton href={paginationHref(page.page - 1)}>Anterior</AdminLinkButton> : null}{page.page < page.pages ? <AdminLinkButton href={paginationHref(page.page + 1)}>Próxima</AdminLinkButton> : null}</div></nav></> : <AdminEmptyState title={filters.q || filters.status || filters.outlet || filters.menu || filters.category || filters.availability ? 'Nenhum resultado para estes filtros' : 'Tudo pronto para começar'} description={filters.q || filters.status ? 'Experimente outros termos ou limpe os filtros.' : 'Cadastre ' + (kind === 'outlet' ? 'os estabelecimentos do hotel' : plural[kind].toLocaleLowerCase('pt-BR')) + ' para organizar a experiência gastronômica.'}/>}
    </>}
  </div>;
}
