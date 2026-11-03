import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdminAccess,hasMinimumRole } from '@/lib/auth';
import { requireHotelModule } from '@/lib/admin-entitlements';
import { createClient } from '@/lib/supabase/server';
import { FB_KINDS,FB_TABLES,FB_LIMITS,isFbKind,type FbGraph,type FbRecord } from '@/lib/fb/types';
import {readFbRows} from '@/lib/fb/pagination';
import { FbEditor,FbRecordActions,FbReorderForm,FbImagePanel } from '@/components/admin/fb-editor';
import { FbLanguageSummary } from '@/components/admin/fb-language-summary';
import { AdminPageHero,AdminSurface,AdminInlineError } from '@/components/admin/ui';
import { FeedbackToast } from '@/components/feedback-toast';
const labels={outlet:'Pontos gastronômicos',menu:'Cardápios',category:'Categorias',item:'Itens'};
export default async function AdminMenuPage({searchParams}:{searchParams?:Promise<{kind?:string;id?:string;parent?:string;success?:string;warning?:string;error?:string}>}) {
 const {profile}=await requireAdminAccess('visualizador');await requireHotelModule('fb.menu');
 const client=await createClient();const params=await searchParams||{};const kind=isFbKind(params.kind)?params.kind:'outlet';
 const results=await Promise.all(FB_KINDS.map(k=>readFbRows((from,to)=>client.from(FB_TABLES[k]).select('*',{count:'exact'}).eq('hotel_id',profile.hotel_id).order('sort_order').order('id').range(from,to),FB_LIMITS[k],r=>r.id)));
 const [links,serviceLinks,services]=await Promise.all([readFbRows((from,to)=>client.from('hotel_fb_outlet_menus').select('*',{count:'exact'}).eq('hotel_id',profile.hotel_id).order('outlet_id').order('menu_id').range(from,to),5000,r=>r.outlet_id+':'+r.menu_id),client.from('hotel_fb_service_links').select('*').eq('hotel_id',profile.hotel_id),readFbRows((from,to)=>client.from('hotel_sections').select('id,title,enabled',{count:'exact'}).eq('hotel_id',profile.hotel_id).order('sort_order').order('id').range(from,to),10000,r=>r.id)]);
 if([...results,links,serviceLinks,services].some(r=>r.error))throw new Error('Não foi possível carregar Gastronomia deste hotel.');
 const graph={outlets:results[0].data||[],menus:results[1].data||[],categories:results[2].data||[],items:results[3].data||[],outlet_menus:links.data||[],service_links:serviceLinks.data||[]} as FbGraph;
 const all=(results[FB_KINDS.indexOf(kind)].data||[]) as FbRecord[];const row=params.id?all.find(r=>r.id===params.id):undefined;
 if(params.id&&!row)notFound();
 const parentField=kind==='category'?'menu_id':kind==='item'?'category_id':null;const parents=kind==='category'?graph.menus:kind==='item'?graph.categories:[];
 const parent=parentField?(params.parent||(row as unknown as Record<string,string>|undefined)?.[parentField]||parents[0]?.id):undefined;const rows=parentField?all.filter(r=>(r as unknown as Record<string,unknown>)[parentField]===parent):all;
 const canManage=hasMinimumRole(profile.normalizedRole,'operador');
 return <main className="space-y-6"><FeedbackToast {...params}/><AdminInlineError message={params.error}/><AdminPageHero eyebrow="Conteúdo do hotel" title="Gastronomia" description="Restaurantes, bares, Room Service e cardápios consultivos. Não envia pedidos."/>
  <nav aria-label="Gestão gastronômica" className="flex flex-wrap gap-4">{FB_KINDS.map(k=><Link key={k} className="min-h-11 content-center underline" href={'/admin/cardapio?kind='+k}>{labels[k]}</Link>)}</nav>
  <AdminSurface><h2 className="text-lg font-semibold">{labels[kind]}</h2>{parentField?<nav className="my-3 flex flex-wrap gap-3" aria-label="Filtrar por associação">{parents.map(p=><Link className="min-h-11 content-center underline" key={p.id} href={'/admin/cardapio?kind='+kind+'&parent='+p.id}>{p.name}</Link>)}</nav>:null}
   <FbReorderForm key={kind+(parent||'')} kind={kind} rows={rows.map(r=>({id:r.id,name:r.name,revision:r.revision}))} parentId={parent} canManage={canManage}/><ul className="mt-4 space-y-4">{rows.map(r=><li key={r.id} className="rounded-xl border border-[var(--admin-border)] p-4"><Link className="font-medium underline" href={'/admin/cardapio?kind='+kind+'&id='+r.id}>{r.name}</Link><p className="my-2 text-sm">{r.is_published?'Publicado':'Rascunho'}</p><FbRecordActions kind={kind} row={{id:r.id,revision:r.revision}} canManage={canManage}/></li>)}</ul>{!rows.length?<p className="mt-4">Nenhum conteúdo cadastrado nesta seleção.</p>:null}</AdminSurface>
  {row||canManage?<AdminSurface><h2 className="mb-5 text-lg font-semibold">{row?'Detalhe':'Novo conteúdo'} · {labels[kind]}</h2><FbEditor key={kind+(row?.id||'new')+':'+(row?.revision||0)} kind={kind} row={row} graph={{...graph,outlets:[],items:[]}} services={services.data||[]} canManage={canManage}/></AdminSurface>:null}
  {row?<AdminSurface><FbImagePanel key={kind+row.id+':'+row.revision} kind={kind} row={row} canManage={canManage}/></AdminSurface>:null}<FbLanguageSummary hotelId={profile.hotel_id}/>
 </main>;
}
