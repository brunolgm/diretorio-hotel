import {createHash} from 'node:crypto';
import {parseRoomGuide} from '../lib/room-guides.ts';
export const stable=x=>JSON.stringify(Array.isArray(x)?x.map(v=>JSON.parse(stable(v))):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(stable(x[k]))])):x);
export const digest=x=>createHash('sha256').update(stable(x)).digest('hex');
const check=(ok,code='PT409')=>{if(!ok)throw {code};};
export function desiredTvDraft(draft,m){const next=structuredClone(draft);check(stable(next.steps.map(s=>s.key))===stable(m.expectedKeys),'STEP_CONFLICT');for(const text of m.steps){const step=next.steps.find(s=>s.key===text.key);step.title=structuredClone(text.title);step.body=structuredClone(text.body);}check(parseRoomGuide(next,m.hotelId,m.serviceId),'MANIFEST_INVALID');check(digest(next)===m.desiredDraftSha256,'MANIFEST_INVALID');return next;}
export async function finalizeBuganTv(client,m,progress=()=>{}){
 let attempted=false;const read=async(operation,query)=>{progress({stage:attempted?'readback':'preflight',operation,writesAttempted:attempted});const r=await query;check(!r.error,'READ_UNCONFIRMED');return r.data;};
 check(m.version===1&&m.hotelId==='5eb7d695-ccf7-4594-b9df-fc46aaa25695'&&m.serviceId==='31dd1fd0-91a1-4b91-a157-9b2a47f2d153'&&m.publication===false&&m.expectedLifecycle==='active'&&m.expectedRevision===6&&m.steps.length===5,'MANIFEST_INVALID');
 const u=await client.auth.getUser();check(!u.error&&u.data?.user?.email==='libguestbugan@yahoo.com','AUTH_REQUIRED');
 const p=await read('profile.read',client.from('profiles').select('hotel_id,role,is_active').eq('id',u.data.user.id).single());check(p?.hotel_id===m.hotelId&&p.role==='administrador'&&p.is_active===true,'AUTHORIZATION_REQUIRED');
 const inspect=async()=>{
  const hotel=await read('hotel.read',client.from('hotels').select('id,name,slug,subdomain,brand_code,theme_preset,platform_status').eq('id',m.hotelId).single());check(hotel?.platform_status==='active'&&hotel.slug==='bugan-recife'&&hotel.subdomain==='buganrecife','LIFECYCLE_CONFLICT');
  const modules=await read('get_current_hotel_modules',client.rpc('get_current_hotel_modules'));check(['content.services','content.languages'].every(k=>modules?.some(r=>r.module_key===k&&r.is_enabled===true)),'MODULES_REQUIRED');
  const admins=await read('administrators.read',client.from('profiles').select('id,role,is_active').eq('hotel_id',m.hotelId).order('id'));check(m.administratorIds.every(id=>admins?.some(r=>r.id===id&&r.role==='administrador'&&r.is_active===true)),'ADMINISTRATOR_CONFLICT');
  const services=await read('services.read',client.from('hotel_sections').select('*').eq('hotel_id',m.hotelId).order('id'));check(services?.filter(s=>s.enabled).length===13&&m.guideIds.every(id=>services.some(s=>s.id===id&&s.enabled===false)),'SERVICE_STATE_CONFLICT');check(digest(services.find(s=>s.id===m.serviceId))===m.expectedServiceSha256,'SERVICE_STATE_CONFLICT');
  const all=await read('guides.read',client.from('hotel_service_guides').select('*').eq('hotel_id',m.hotelId).order('service_id'));check(all?.length===4&&all.every(g=>g.published===null),'PUBLICATION_CONFLICT');
  return {hotel,admins,services,modules:[...modules].sort((a,b)=>a.module_key.localeCompare(b.module_key)),otherGuides:all.filter(g=>g.service_id!==m.serviceId)};
 };
 const baseline=await inspect();
 const current=async()=>{const rows=await read('get_current_hotel_service_guide',client.rpc('get_current_hotel_service_guide',{p_service_id:m.serviceId}));const row=rows?.[0];check(row?.hotel_id===m.hotelId&&row.service_id===m.serviceId&&row.published===null,'AUTHORIZATION_REQUIRED');const hash=digest(row.draft);check(row.revision===m.expectedRevision&&hash===m.expectedDraftSha256||row.revision===m.expectedRevision+1&&hash===m.desiredDraftSha256);return row;};
 let row=await current(),updated=false;
 if(row.revision===m.expectedRevision){
  const next=desiredTvDraft(row.draft,m);check(stable(await inspect())===stable(baseline),'PRESERVATION_CONFLICT');await current();attempted=true;progress({stage:'corrections',operation:'save_current_hotel_service_guide',writesAttempted:true});
  const result=await client.rpc('save_current_hotel_service_guide',{p_service_id:m.serviceId,p_expected_revision:m.expectedRevision,p_configuration:next,p_publish:false,p_review_confirmed:false});if(result.error)throw {code:result.error.code==='PT409'?'PT409':'WRITE_UNCONFIRMED'};check(result.data?.[0]?.revision===m.expectedRevision+1&&result.data[0].is_published===false,'RESPONSE_AMBIGUOUS');updated=true;
 }
 row=await current();check(row.revision===m.expectedRevision+1&&digest(row.draft)===m.desiredDraftSha256,'WRITE_UNCONFIRMED');check(stable(await inspect())===stable(baseline),'PRESERVATION_CONFLICT');
 const audit=await read('audit.read',client.from('admin_audit_log').select('id').eq('hotel_id',m.hotelId).eq('entity_id',m.serviceId).eq('actor_user_id',u.data.user.id).eq('action','service.guide_draft_saved').contains('metadata',{revision:row.revision}).limit(1));check(audit?.length>0,'AUDIT_UNCONFIRMED');
 return {status:'tv_editorial_confirmed',hotelId:m.hotelId,revision:row.revision,updated,steps:5,languages:['pt','en','es'],guidesEnabled:0,publication:false,channelsPreserved:true,imagesPreserved:true,otherGuidesPreserved:true,lifecycle:'active',googleUsed:false,airlabsUsed:false};
}
