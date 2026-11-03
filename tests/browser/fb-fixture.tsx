import {createRoot} from 'react-dom/client';
import {fbFixture} from '../fixtures/fb';
import {HotelPublicAreaContent} from '../../components/public/hotel-public-area-content';
import {HotelPublicPageContent} from '../../components/public/hotel-public-page-content';
import {FbEditor,FbRecordActions,FbReorderForm} from '../../components/admin/fb-editor';
import type {FbKind} from '../../lib/fb/types';
import type {DomainContext} from '../../lib/domain-context';
const args=new URLSearchParams(location.search),index=Number(args.get('index')||0),language=(args.get('lang')||'pt') as 'pt'|'en'|'es';
const data=fbFixture(index,language);const graph=structuredClone(data.fb!);
if(args.get('image')==='1'){for(const row of [graph.outlets[0],graph.items[0]])row.main_image_path=data.hotel.id+'/fb/'+(row===graph.outlets[0]?'outlet':'item')+'/'+row.id+'/53300000-0000-4000-8000-000000000001.png';}
if(args.get('content')==='0') {graph.outlets=[];graph.menus=[];graph.categories=[];graph.items=[];graph.outlet_menus=[];graph.service_links=[];data.sections=[];}
if(args.get('destination')==='0') {graph.outlets.forEach(o=>o.action_type='none');graph.service_links=[];data.sections.forEach(s=>{s.url=null;s.service_action_type='standard';});}
data.fb=args.get('enabled')==='0'?null:graph;
if(args.get('legacyRoom')==='1'&&data.sections[1])data.sections[1].service_action_type='room_restaurant_menu';
if(args.get('version')==='v3')data.presentation!.experienceVersion='v3';
const domain={kind:'product-subdomain',isPotentialHotelSubdomain:true,productRootDomain:'libguest.digital',subdomain:data.hotel.subdomain,navigationScope:'authenticated-preview'} as DomainContext;
const props={pageData:data,language,domainContext:domain,preferSubdomainRoot:true};
const view=args.get('view')||'gastronomy';const kind=(args.get('kind')||'outlet') as FbKind;
const row={outlet:graph.outlets[0],menu:graph.menus[0],category:graph.categories[0],item:graph.items[0]}[kind];
const canManage=args.get('viewer')!=='1';
const content=view==='home'?<HotelPublicPageContent {...data} language={language} domainContext={domain} preferSubdomainRoot/>:view==='admin'?<main className="mx-auto max-w-5xl p-5" style={{'--admin-accent':'#174c66','--admin-text':'#18252f','--admin-surface':'#ffffff','--admin-border':'#c9d5dc'} as React.CSSProperties}><h1>Gastronomia · editor local</h1><p>Fixture isolada; sem sessão ou escrita real.</p>{args.get('enabled')==='0'?<p>Módulo indisponível</p>:<><FbReorderForm kind={kind} rows={{outlet:graph.outlets,menu:graph.menus,category:graph.categories,item:graph.items}[kind]} canManage={canManage}/><FbEditor kind={kind} row={row} graph={graph} services={data.sections} canManage={canManage}/>{row?<FbRecordActions kind={kind} row={row} canManage={canManage}/>:null}</>}</main>:<HotelPublicAreaContent {...props} area={view==='room'&&!data.fb?'servicos':'cardapio'}/>;
createRoot(document.getElementById('root')!).render(content);
