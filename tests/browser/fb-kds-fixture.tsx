import {createRoot} from 'react-dom/client';
import {FbOrdersPanel} from '../../components/admin/fb-orders-panel';
import {FbKdsAdmin} from '../../components/admin/fb-kds-admin';
import {FbKdsDisplay} from '../../components/fb-kds-display';
import {DEFAULT_KDS_SETTINGS,type KdsAdmin,type KdsScreen,type KdsSnapshot} from '../../lib/fb/kds/contracts';
import type {PanelPage} from '../../lib/fb/orders/operations';
import {getAdminThemeStyle,resolveAdminTheme} from '../../lib/admin-theme';
const args=new URLSearchParams(location.search),view=args.get('view')||'orders';
const id=(n:number)=>String(n).padStart(8,'0')+'-0000-4000-8000-'+String(n).padStart(12,'0');
const now=Date.now();
const initial:PanelPage={access:{hotel_id:id(1),hotel:{name:'Hotel de demonstração · SINTÉTICO',city:'Recife',logo_url:null,brand_code:'bugan',theme_preset:'bugan'},hotel_status:'active',accepting:true,capabilities:[]},orders:Array.from({length:8},(_,i)=>({order_id:id(100+i),status:['registered','accepted','preparing','ready'][i%4],revision:1,created_at:new Date(now-(i*3+2)*60000).toISOString(),currency:'BRL',fulfilment:i%2?'pickup':'room_delivery',total_minor:5800+i*1000,groups:[{id:id(200+i),sector_id:id(i%2?11:10),sector_name:i%2?'Bar sintético':'Cozinha sintética',status:['registered','accepted','preparing','ready'][i%4],revision:1}],lines:[{id:id(300+i),group_id:id(200+i),parent_id:null,name:['Sanduíche da casa · fixture','Suco de laranja · fixture','Filé com legumes · fixture','Água mineral · fixture'][i%4],quantity:i%3+1,kind:'item',total_minor:5800}],options:[{line_id:id(300+i),name:'Sem gelo · fixture',group_name:'Preparo'}],history:[{action:'orders.registered',status:'registered',at:new Date(now-(i*3+2)*60000).toISOString()}],permissions:{pii:i===0,cancel:true,transition_groups:[id(200+i)]},cancellation_requests:[],printing_unavailable:true})),next:null};
const screen:KdsScreen={id:id(2),hotel_id:id(1),name:'Cozinha principal · SINTÉTICO',location:'Área de produção',mode:args.get('mode')==='operational'?'operational':'monitor',active:true,revision:1,sector_ids:[id(10),id(11)],settings:{...DEFAULT_KDS_SETTINGS,states:['registered','accepted','preparing','ready'],attention_minutes:10,critical_minutes:20,...(args.get('layout')?{layout:args.get('layout') as 'compact'|'tickets'}:{})},device_name:'TV fixture',last_seen_at:new Date(now).toISOString(),paired:true};
const admin:KdsAdmin={hotel_id:id(1),hotel_name:initial.access.hotel.name,screens:[screen,{...screen,id:id(3),name:'Expedição · SINTÉTICO',mode:'dispatch',paired:false,device_name:null}],sectors:[{id:id(10),name:'Cozinha sintética'},{id:id(11),name:'Bar sintético'}]};
const snapshot:KdsSnapshot={screen,hotel_name:initial.access.hotel.name,tickets:args.get('empty')==='1'?[]:initial.orders.map(o=>({id:o.groups[0].id,order_id:o.order_id,sector_id:o.groups[0].sector_id,sector_name:o.groups[0].sector_name,status:o.status,revision:1,created_at:o.created_at,fulfilment:o.fulfilment,can_transition:screen.mode!=='monitor',lines:o.lines.map(l=>({id:l.id,name:l.name,quantity:l.quantity,options:o.options.map(op=>op.name)}))})),total:args.get('empty')==='1'?0:8,updated_at:new Date(now).toISOString()};
// All API requests are deliberately intercepted within this fixture.
window.fetch=async(input,options)=>{
 const path=String(input);await new Promise(resolve=>setTimeout(resolve,40));
 const body=options?.body?JSON.parse(String(options.body)):null;
 if(body)document.body.dataset.fixturePost=JSON.stringify(body);
 if(path.startsWith('/api/admin/fb-orders'))return Response.json(body?{first_name:'Pessoa SINTÉTICA',last_name:'Fixture',room_label:'Unidade fictícia',note:'Observação SINTÉTICA autorizada',line_notes:[],expired:false,expires_at:new Date(now+600000).toISOString()}:initial);
 if(path.startsWith('/api/admin/fb-kds')){
  if(body?.operation==='pair'){screen.revision++;return Response.json({code:'CODIGO_SINTETICO_12345678',expires_at:new Date(Date.now()+600000).toISOString()});}
  if(body?.operation==='save'){const values={...screen,...body.screen,id:body.screen.id||id(4),revision:(body.screen.revision||0)+1};const at=admin.screens.findIndex(s=>s.id===values.id);if(at>=0)admin.screens[at]=values;else admin.screens.push(values);return Response.json(values);}
  return Response.json(body?{ok:true}:admin);
 }
 if(path==='/api/fb/kds'){
  if(args.get('pair')==='1')return Response.json({error:'forbidden'},{status:403});
  if(body?.operation==='transition'){const t=snapshot.tickets.find(t=>t.id===body.group_id);if(t){t.status=body.status;t.revision++;}return Response.json({ok:true});}
  if(document.body.dataset.fixtureOffline==='1')throw Error('Synthetic offline');
  return Response.json(snapshot);
 }
 throw Error('Unexpected fixture request '+path);
};
createRoot(document.getElementById('root')!).render(view==='display'?<FbKdsDisplay/>:<main className="admin-theme" style={{...getAdminThemeStyle(resolveAdminTheme('bugan','bugan')),minHeight:'100vh',background:'var(--admin-bg)',padding:args.get('mobile')?'16px':'32px'}}><span style={{fontSize:12,color:'var(--admin-text)'}}>FIXTURE SINTÉTICA · SEM PEDIDOS REAIS</span><h1 style={{fontSize:28,fontWeight:650,color:'var(--admin-text-strong)',margin:'16px 0 24px'}}>{view==='admin'?'KDS · Gestão de telas':'Pedidos · Operação gastronômica'}</h1>{view==='admin'?<FbKdsAdmin initial={admin}/>:<FbOrdersPanel initial={initial}/>}</main>);
