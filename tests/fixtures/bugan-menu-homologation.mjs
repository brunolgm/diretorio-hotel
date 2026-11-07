// Simulation only. Never imported by production; no DB, entitlement or order writes.
export const previewId=(kind,id='1')=>'54'+String(kind).padStart(2,'0')+'0000-0000-4000-8000-'+String(id).padStart(12,'0');
export function reviewGraph(source){
 const base={hotel_id:previewId(0),is_published:true,sort_order:0,revision:1,source_revision:1};
 const outlet=(name,type,id)=>({...base,id,name,type,short_description:null,full_description:null,opening_hours:null,location_info:null,main_image_path:null,is_featured:false,action_type:'none',external_url:null});
 const graph={outlets:[outlet('Restaurante Filipe','restaurant',previewId(1)),outlet('Room Service','room_service',previewId(2))],menus:[{...base,id:previewId(3),name:source.outlet_e_menu.nome_proposto,short_description:null}],categories:source.categorias.map(c=>({...base,...c.campos_nativos,id:previewId(4,c.goomer_id),menu_id:previewId(3),description:null,is_published:true})),items:source.itens.map(i=>({...base,...i.campos_nativos,id:previewId(5,i.goomer_id),category_id:previewId(4,i.goomer_categoria_id),short_description:null,allergens_info:null,dietary_info:null,main_image_path:null,is_published:true,is_available:true})),outlet_menus:[1,2].map(n=>({hotel_id:previewId(0),outlet_id:previewId(n),menu_id:previewId(3),sort_order:0})),service_links:[]};
 return graph;
}
// Candidate calendars demonstrate [open,close); unknown/ambiguous windows stay excluded.
// Real production code uses PostgreSQL clock_timestamp() + scope_available(), unchanged.
export function candidateAvailable(candidate,instant){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
 const minute=Number(parts.hour)*60+Number(parts.minute);
 return candidate==='24h'||candidate==='11_2230'&&minute>=660&&minute<1350||candidate==='terca_18_20'&&parts.weekday==='Tue'&&minute>=1080&&minute<1200;
}
export function simulatedOffer(source,instant){
 const graph=reviewGraph(source),allowed=new Set(source.itens.filter(i=>candidateAvailable(i.janela_room_service_proposta,instant)).map(i=>previewId(5,i.goomer_id)));
 return {outlets:[{id:previewId(2),name:'Room Service',description:null,image_url:null,available:true,hidden:false,pickup:false,room_delivery:true,menus:graph.menus.map(menu=>({id:menu.id,name:menu.name,categories:graph.categories.filter(c=>graph.items.some(i=>i.category_id===c.id&&allowed.has(i.id))).map(c=>({id:c.id,name:c.name}))})),products:graph.items.filter(i=>allowed.has(i.id)).map(i=>({id:i.id,kind:'item',menu_id:previewId(3),category_id:i.category_id,name:i.name,description:i.full_description,amount_minor:i.price_amount_minor,currency:i.currency,available:true,groups:[]}))}],has_room_context:true};
}
export function simulatedValidation(source,instant,outletId,intent){
 if(outletId!==previewId(2))return {error:'forbidden',status:403};
 const products=simulatedOffer(source,instant).outlets[0].products;
 if(!intent?.lines?.length||intent.lines.some(line=>line.kind!=='item'||line.menu_id!==previewId(3)||!products.some(product=>product.id===line.id)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>20))return {error:'review_required',status:409};
 return {status:200,products};
}
