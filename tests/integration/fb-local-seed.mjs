// Synthetic data only, written exclusively to the owned disposable lab.
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {labState,labSql} from '../../scripts/fb-local-lab.mjs';
import {BASELINE_MODULE_KEYS} from '../../lib/modules/catalog.ts';
export const identities=[
 ['Grand Mercure Copacabana','grand-mercure','grand-mercure'],
 ['Novotel Leme','novotel-leme','novotel'],
 ['Novotel Salvador Rio Vermelho','novotel-salvador','novotel'],
 ['Mercure Rio Boutique Copacabana','mercure','mercure'],
 ['Bugan Recife','bugan','bugan'],
 ['Default técnico','default',null],
];
export const literal=v=>v===null?'null':"'"+String(v).replaceAll("'","''")+"'";
export const rows=sql=>JSON.parse(labSql(sql,true));
export async function seedLab(){
 const s=labState();if(rows('select count(*)::text from public.hotels')!==0)throw Error('Requires a freshly created empty lab');
 const project=createClient(s.api,s.service,{auth:{persistSession:false,autoRefreshToken:false}});
 async function actor(name){
  const email=name+'-'+randomBytes(4).toString('hex')+'@fixture.invalid',password=randomBytes(24).toString('base64url');
  const {data,error}=await project.auth.admin.createUser({email,password,email_confirm:true});
  if(error)throw Error('Local Auth create failed: '+error.message);
  const client=createClient(s.api,s.anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await client.auth.signInWithPassword({email,password});if(login.error)throw Error('Local Auth sign-in failed: '+login.error.message);
  return {id:data.user.id,email,password,client};
 }
 const platform=await actor('platform');
 labSql("insert into public.platform_users(user_id,role,is_active) values("+literal(platform.id)+",'platform_admin',true)");
 const bucket=await project.storage.createBucket('hotel-assets',{public:true});if(bucket.error)throw bucket.error;
 const tenants=[];
 for(let i=0;i<identities.length;i++){
  const [name,key,brand]=identities[i],id=randomUUID(),slug='fb-lab-'+key;
  labSql("insert into public.hotels(id,name,slug,subdomain,brand_code,theme_preset,platform_status,city,wifi_name,breakfast_hours,checkin_time,checkout_time) values("+
   [id,name,slug,slug,brand,brand||'midnight-slate','active','Laboratório local','Wi-Fi sintético','06:00–10:00','14:00','12:00'].map(literal).join(',')+");");
  // Explicit synthetic Platform configuration via its real authenticated RPC.
  // No raw entitlement insertion, no fb.menu default and no production tenant.
  for(const key of [...BASELINE_MODULE_KEYS,'content.tourism','travel.flights']){
   const existing=await platform.client.rpc('is_hotel_module_enabled',{p_hotel_id:id,p_module_key:key});
   if(existing.error)throw existing.error;
   if(!existing.data){const enabled=await platform.client.rpc('update_platform_hotel_module',{p_hotel_id:id,p_module_key:key,p_enabled:true});if(enabled.error)throw enabled.error;}
  }
  const operator=await actor('operator'+i),viewer=await actor('viewer'+i);
  for(const [a,role]of [[operator,'operador'],[viewer,'visualizador']])labSql("insert into public.profiles(id,hotel_id,email,full_name,role,is_active) values("+[a.id,id,a.email,'Usuário sintético',role].map(literal).join(',')+",true)");
  const services={filipe:randomUUID(),external:randomUUID(),room:randomUUID()};
  const goomer='https://goomer.fixture.invalid/menu';
  labSql("insert into public.hotel_sections(id,hotel_id,title,content,service_action_type,url,category,icon,enabled,sort_order) values "+
   [[services.filipe,id,'Restaurante Filipe','Conteúdo editorial sintético do restaurante, preservado como Serviço standard com experiência interna.','standard',null,'Restaurante','UtensilsCrossed',true,0],
    [services.external,id,'Room Service','Canal externo configurado em fixture.','external_url',goomer,'Room Service','BellRing',true,1],
    [services.room,id,'Cardápio por apartamento','Acesso pelo resolvedor existente, com contexto do apartamento.','room_restaurant_menu',null,'Restaurante','UtensilsCrossed',true,2]]
    .map(values=>'('+values.map(v=>typeof v==='boolean'||typeof v==='number'?String(v):literal(v)).join(',')+')').join(',')+';');
  labSql("insert into public.hotel_departments(hotel_id,name,description,hours,action,url) values("+[id,'Recepção','Contato local de fixture','24 horas','Recepção',null].map(literal).join(',')+");insert into public.hotel_policies(hotel_id,title,description) values("+[id,'Política de fixture','Informação sintética para regressão visual.'].map(literal).join(',')+");");
  labSql("insert into public.hotel_announcements(hotel_id,title,body,category,is_active) values "+
   [[id,'Aviso do laboratório','Informação sintética para verificar o alerta preservado.','alerta'],[id,'Atualização do laboratório','Informação sintética para verificar as atualizações preservadas.','informativo']]
   .map(values=>'('+values.map(literal).join(',')+',true)').join(',')+";insert into public.hotel_promotional_banners(hotel_id,title,subtitle,is_active) values("+[id,'Oferta do laboratório','Conteúdo sintético para regressão.'].map(literal).join(',')+",true);");
  labSql("insert into public.hotel_tourism_items(hotel_id,slug,type,category_key,name,short_description,is_published,featured) values("+[id,'atracao-local','PLACE','culture_and_history','Atração do laboratório','Conteúdo sintético para preservar Turismo.'].map(literal).join(',')+",true,true);");
  const airport=randomUUID(),iata='ZX'+String.fromCharCode(65+i);
  labSql("insert into public.airports(id,iata_code,name,city,country_code,timezone,latitude,longitude) values("+[airport,iata,'Aeroporto sintético','Laboratório','BR','UTC'].map(literal).join(',')+",0,0);insert into public.hotel_airports(hotel_id,airport_id,sort_order) values("+[id,airport].map(literal).join(',')+",1);insert into public.hotel_flight_settings(hotel_id,home_card_enabled,home_card_title,home_card_description) values("+literal(id)+",true,'Voos do laboratório','Configuração sintética sem chamadas ao provedor.') on conflict(hotel_id) do update set home_card_enabled=true,home_card_title=excluded.home_card_title,home_card_description=excluded.home_card_description;");
  const roomTokens={valid:randomBytes(18).toString('base64url'),inactive:randomBytes(18).toString('base64url'),missing:randomBytes(18).toString('base64url')};
  labSql("insert into public.hotel_room_links(hotel_id,room_number,room_token,restaurant_menu_url,is_active) values "+
   [[id,'F-01',roomTokens.valid,'https://room.fixture.invalid/menu',true],[id,'F-02',roomTokens.inactive,'https://room.fixture.invalid/inactive',false],[id,'F-03',roomTokens.missing,null,true]]
   .map(values=>'('+values.map(v=>typeof v==='boolean'?String(v):literal(v)).join(',')+')').join(',')+';');
  const path=id+'/hero/hero/'+randomUUID()+'.png';
  const upload=await project.storage.from('hotel-assets').upload(path,readFileSync('docs/references/bugan/public-v3/restaurante-filipe-real.png'),{contentType:'image/png',upsert:false});if(upload.error)throw upload.error;
  labSql("insert into public.hotel_public_experience_media(hotel_id,slot,image_path,alt_text,title,description,is_published) values("+[id,'hero',path,'Imagem local do laboratório',name,'Experiência sintética para homologação local.'].map(literal).join(',')+",true);");
  const presentation={version:1,experienceVersion:'v4',heroTitleMode:'media_title',heroDesktopFocal:null,benefits:[],tourism:{title:{pt:'',en:'',es:''},description:{pt:'',en:'',es:''},cards:[]}};
  labSql("insert into public.hotel_public_presentation(hotel_id,configuration,revision) values("+literal(id)+","+literal(JSON.stringify(presentation))+"::jsonb,1) on conflict(hotel_id) do update set configuration=excluded.configuration;");
  const legacyServices=rows("select json_agg(to_jsonb(t) order by id) from public.hotel_sections t where hotel_id="+literal(id));
  const legacyRooms=rows("select json_agg(to_jsonb(t) order by id) from public.hotel_room_links t where hotel_id="+literal(id));
  tenants.push({id,name,slug,brand,operator,viewer,services,roomTokens,goomer,legacyServices,legacyRooms});
 }
 labSql("notify pgrst, 'reload schema';");
 return {s,platform,tenants,project};
}
