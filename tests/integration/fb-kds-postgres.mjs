// Focused PostgreSQL (PGlite WASM) integration, in memory, synthetic data only.
// Install test runtime outside dependency manifest: npm install --prefix out/kds-postgres --no-save --ignore-scripts @electric-sql/pglite@0.3.15
// Auth claims are supplied by test settings; GoTrue/PostgREST are not exercised here.
import {PGlite} from '../../out/kds-postgres/node_modules/@electric-sql/pglite/dist/index.js';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const db=new PGlite();const checks=[];
const read=n=>readFileSync('supabase/migrations/'+n,'utf8');
const b1=read('20261103035109_sprint_53_b1_orders_foundation.sql'),b23=read('20261103050831_sprint_53_b23_public_journey_operations.sql');
function fn(source,name){const start=source.search(new RegExp('create (?:or replace )?function '+name.replaceAll('.','\\.')+'\\('));assert.ok(start>=0,name);return source.slice(start,source.indexOf('$$;',source.indexOf('$$',start)+2)+3);}
function table(name){const start=b1.indexOf('create table fb_order_private.'+name+'(');assert.ok(start>=0,name);return b1.slice(start,b1.indexOf('\n);',start)+4);}
const digest=v=>createHash('sha256').update(v).digest('hex');const literal=v=>"'"+String(v).replaceAll("'","''")+"'";
async function claims(user=null,role='authenticated'){await db.exec(`reset role;select set_config('request.jwt.claim.sub',${literal(user||'')},false);select set_config('request.jwt.claim.role',${literal(role)},false);set role ${role};`);}
async function sql(text,params=[]){return (await db.query(text,params)).rows;}
async function call(name,params=[]){return (await sql('select public.'+name+'('+params.map((_,i)=>'$'+(i+1)).join(',')+') result',params))[0].result;}
const check=(v,n)=>{assert.ok(v,n);checks.push(n);};
async function denied(work,code,label){await assert.rejects(work,e=>e.code===code,label);checks.push(label);}
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema fb_order_private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;
 create table public.hotels(id uuid primary key,name text,platform_status text default 'active');
 create table public.profiles(id uuid primary key,hotel_id uuid references public.hotels(id),is_active boolean,role text);
 create table public.hotel_module_entitlements(hotel_id uuid references hotels(id),module_key text,is_enabled boolean,primary key(hotel_id,module_key));
 create table public.kds_test_audit(actor uuid,hotel uuid,action text,entity uuid);
 create function public.record_admin_audit_event(a uuid,h uuid,action text,kind text,e uuid,metadata jsonb,extra text) returns void language sql as $$insert into public.kds_test_audit values(a,h,action,e)$$;`);
 await db.exec(fn(read('202608110001_45b_authz_helpers_and_rls_baseline.sql'),'public.has_active_hotel_role'));
 await db.exec(fn(read('202608250001_51_travel_flights_entitlement.sql'),'public.is_hotel_module_enabled'));
 for(const name of ['sectors','operator_grants','orders','order_private_data','order_groups','order_lines','order_line_options','order_line_notes','order_events','order_access_tokens'])await db.exec(table(name));
 for(const name of ['hash','service_only','actor','require_cap','audit','event','finish_order'])await db.exec(fn(b1,'fb_order_private.'+name));
 for(const name of ['operational_role','can','drain_actor'])await db.exec(fn(b23,'fb_order_private.'+name));
 await db.exec(fn(b1,'public.transition_current_hotel_fb_order_group'));
 await db.exec(fn(b23,'public.transition_current_hotel_fb_order_group_v2'));
 // B23 replaces the actor call in canonical transitions for drain operations; fixture is active.
 const canonicalBefore=await sql("select pg_get_functiondef('public.transition_current_hotel_fb_order_group_v2(uuid,integer,text)'::regprocedure) definition");
 await db.exec(read('20261112033049_sprint_53_kds_universal.sql'));
 check((await sql("select pg_get_functiondef('public.transition_current_hotel_fb_order_group_v2(uuid,integer,text)'::regprocedure) definition"))[0].definition===canonicalBefore[0].definition,'KDS migration preserves canonical transition definition');
 const h=randomUUID(),other=randomUUID(),admin=randomUUID(),operator=randomUUID(),outsider=randomUUID(),sector=randomUUID(),bar=randomUUID(),foreignSector=randomUUID();
 await db.query('insert into hotels(id,name) values($1,\'Hotel sintético\'),($2,\'Outro hotel sintético\')',[h,other]);
 for(const hotel of [h,other])for(const moduleKey of ['core.directory','fb.menu'])await db.query('insert into hotel_module_entitlements values($1,$2,true)',[hotel,moduleKey]);
 await db.query("insert into profiles values($1,$2,true,'editor'),($3,$2,true,'operador'),($4,$5,true,'editor')",[admin,h,operator,outsider,other]);
 await db.query("insert into fb_order_private.sectors(id,hotel_id,name) values($1,$2,'Cozinha sintética'),($3,$2,'Bar sintético'),($4,$5,'Outro setor')",[sector,h,bar,foreignSector,other]);
 for(const [user,hotel,cap,s] of [[admin,h,'orders.configure',null],[admin,h,'orders.read',null],[operator,h,'orders.read',sector],[operator,h,'orders.transition',sector],[outsider,other,'orders.configure',null],[outsider,other,'orders.read',null]])await db.query('insert into fb_order_private.operator_grants(hotel_id,user_id,capability,sector_id) values($1,$2,$3,$4)',[hotel,user,cap,s]);
 const settings={layout:'kanban',theme:'dark',contrast:false,font_size:20,ticket_limit:24,sort:'oldest',states:['registered','accepted','preparing','ready','out_for_delivery'],show_code:true,show_items:true,attention_minutes:null,critical_minutes:null,sound:false};
 await claims(admin);
 const save=(id=null,revision=0,mode='monitor',sectors=[sector,bar],config=settings)=>call('save_current_hotel_fb_kds_screen',[id,revision,'Tela sintética','Cozinha',mode,true,sectors,config]);
 let screen=await save();check(screen.hotel_id===h&&screen.sector_ids.length===2,'screen tenant derived from actor; multiple authorized sectors');
 await denied(()=>save(null,0,'monitor',[foreignSector]),'22023','cross tenant sector rejected');
 await denied(()=>save(screen.id,99),'PT409','configuration CAS rejects old revision');
 await denied(()=>save(null,0,'monitor',[sector],{...settings,critical_minutes:5,attention_minutes:10}),'22023','invalid alert thresholds rejected');
 await denied(()=>save(null,0,'monitor',[sector],{...settings,untrusted:true}),'22023','unknown settings rejected');
 await denied(()=>save(null,0,'monitor',[sector],{...settings,states:['registered','registered']}),'22023','duplicate columns rejected to prevent duplicate tickets');
 await claims(operator);await denied(()=>call('get_current_hotel_fb_kds_admin'),'42501','operator cannot configure without capability');
 await denied(()=>sql('select * from fb_kds_private.screens'),'42501','authenticated cannot read private tables directly');
 await claims(outsider);await denied(()=>call('rotate_current_hotel_fb_kds_access',[screen.id,1,null]),'42501','cross tenant rotation rejected');
 await claims(admin);const code=randomBytes(18).toString('base64url'),secret=randomBytes(32).toString('base64url');
 await call('rotate_current_hotel_fb_kds_access',[screen.id,1,digest(code)]);
 await claims(null,'anon');await denied(()=>call('get_fb_kds_snapshot',[secret]),'42501','anonymous cannot execute projection');
 await claims(admin);await denied(()=>call('redeem_fb_kds_pairing',[code,digest(secret),'TV sintética']),'42501','authenticated cannot redeem via privileged RPC');
 await claims(null,'service_role');await call('redeem_fb_kds_pairing',[code,digest(secret),'TV sintética']);
 await denied(()=>call('redeem_fb_kds_pairing',[code,digest(secret),'Outra TV']),'42501','pairing code single use');
 await denied(()=>call('get_fb_kds_snapshot',[randomBytes(32).toString('base64url')]),'42501','unknown session rejected');
 await db.exec('reset role');
 const order=randomUUID(),g=randomUUID(),b=randomUUID(),foreignOrder=randomUUID();
 for(const [id,hotel] of [[order,h],[foreignOrder,other]])await db.query("insert into fb_order_private.orders(id,hotel_id,outlet_origin_id,outlet_name,language,fulfilment,timezone,currency,total_minor) values($1,$2,$3,'Fixture','pt','pickup','America/Sao_Paulo','BRL',2000)",[id,hotel,randomUUID()]);
 await db.query("insert into fb_order_private.order_groups(id,hotel_id,order_id,sector_id,sector_name) values($1,$2,$3,$4,'Cozinha sintética'),($5,$2,$3,$6,'Bar sintético'),($7,$8,$9,$10,'Setor estrangeiro')",[g,h,order,sector,b,bar,randomUUID(),other,foreignOrder,foreignSector]);
 await db.query("insert into fb_order_private.order_lines(hotel_id,order_id,group_id,kind,origin_id,name,quantity,unit_minor,total_minor,currency,position) values($1,$2,$3,'item',$4,'Item sintético',2,1000,2000,'BRL',1)",[h,order,g,randomUUID()]);
 await db.query("insert into fb_order_private.order_private_data(hotel_id,order_id,first_name,last_name,room_label,note) values($1,$2,'SEGREDO','PESSOAL','1466','OBSERVACAO PRIVADA')",[h,order]);
 await claims(null,'service_role');let snapshot=await call('get_fb_kds_snapshot',[secret]);check(snapshot.tickets.length===2&&snapshot.total===2,'projection includes authorized groups once across sectors');check(!JSON.stringify(snapshot).includes('SEGREDO')&&!JSON.stringify(snapshot).includes('1466')&&!JSON.stringify(snapshot).includes('OBSERVACAO'),'no guest PII or private notes in projection');
 await denied(()=>call('transition_current_hotel_fb_kds_group',[secret,g,1,'accepted']),'42501','paired device session alone cannot authorize staff command');
 await claims(operator);await denied(()=>call('transition_current_hotel_fb_kds_group',[secret,g,1,'accepted']),'42501','monitor cannot mutate even authorized staff');
 await claims(admin);let adminData=await call('get_current_hotel_fb_kds_admin');screen=adminData.screens[0];screen=await save(screen.id,screen.revision,'operational');
 await claims(null,'service_role');await denied(()=>call('get_fb_kds_snapshot',[secret]),'42501','editing screen immediately revokes session');
 const code2=randomBytes(18).toString('base64url'),secret2=randomBytes(32).toString('base64url');await claims(admin);await call('rotate_current_hotel_fb_kds_access',[screen.id,screen.revision,digest(code2)]);await claims(null,'service_role');await call('redeem_fb_kds_pairing',[code2,digest(secret2),'Tablet sintético']);
 await claims(outsider);await denied(()=>call('transition_current_hotel_fb_kds_group',[secret2,g,1,'accepted']),'42501','cross tenant operation rejected');
 await claims(operator);await denied(()=>call('transition_current_hotel_fb_kds_group',[secret2,b,1,'accepted']),'42501','staff cannot operate other screen sector without grant');
 await denied(()=>call('transition_current_hotel_fb_kds_group',[secret2,g,1,'ready']),'22023','canonical transition cannot skip preparation');
 await call('transition_current_hotel_fb_kds_group',[secret2,g,1,'accepted']);checks.push('canonical transition accepted with current CAS');
 await denied(()=>call('transition_current_hotel_fb_kds_group',[secret2,g,1,'accepted']),'PT409','duplicate action rejected by revision');
 await call('transition_current_hotel_fb_kds_group',[secret2,g,2,'preparing']);await call('transition_current_hotel_fb_kds_group',[secret2,g,3,'ready']);
 await denied(()=>call('transition_current_hotel_fb_kds_group',[secret2,g,4,'out_for_delivery']),'22023','pickup cannot use room delivery transition');
 await call('transition_current_hotel_fb_kds_group',[secret2,g,4,'delivered']);checks.push('pickup flow completes using canonical transitions');
 await db.exec('reset role');const events=await sql("select count(*)::int n from kds_test_audit where action='fb.kds.group_transition'");check(events[0].n===4,'commands audited alongside canonical order events');
 await db.exec(`update fb_order_private.operator_grants set active=false where user_id='${admin}' and capability='orders.configure'`);await claims(null,'service_role');await denied(()=>call('get_fb_kds_snapshot',[secret2]),'42501','creator capability revocation invalidates screen');
 await db.exec(`reset role;update fb_order_private.operator_grants set active=true where user_id='${admin}';`);await claims(admin);adminData=await call('get_current_hotel_fb_kds_admin');screen=adminData.screens[0];await call('rotate_current_hotel_fb_kds_access',[screen.id,screen.revision,null]);await claims(null,'service_role');await denied(()=>call('get_fb_kds_snapshot',[secret2]),'42501','explicit revocation immediately denies reads');
 await claims(admin);adminData=await call('get_current_hotel_fb_kds_admin');screen=adminData.screens[0];screen=await save(screen.id,screen.revision,'dispatch',[bar]);
 const code3=randomBytes(18).toString('base64url'),secret3=randomBytes(32).toString('base64url');await call('rotate_current_hotel_fb_kds_access',[screen.id,screen.revision,digest(code3)]);
 await db.exec(`reset role;update fb_kds_private.screens set pair_expires_at=clock_timestamp()-interval '1 second' where id='${screen.id}'`);await claims(null,'service_role');await denied(()=>call('redeem_fb_kds_pairing',[code3,digest(secret3),'Expedição']),'42501','expired pairing code denied');
 await db.exec(`reset role;update fb_kds_private.screens set pair_expires_at=clock_timestamp()+interval '1 minute' where id='${screen.id}';update fb_order_private.operator_grants set sector_id=null where user_id='${operator}'`);await claims(null,'service_role');await call('redeem_fb_kds_pairing',[code3,digest(secret3),'Expedição']);
 snapshot=await call('get_fb_kds_snapshot',[secret3]);check(snapshot.tickets.length===1&&snapshot.tickets[0].sector_id===bar,'projection excludes sectors removed from screen');
 await claims(operator);await denied(()=>call('transition_current_hotel_fb_kds_group',[secret3,b,1,'accepted']),'42501','dispatch cannot accept or prepare orders');
 await db.exec(`reset role;update fb_order_private.order_groups set status='ready',revision=4 where id='${b}';update fb_order_private.orders set fulfilment='room_delivery' where id='${order}'`);await claims(operator);
 await denied(()=>call('transition_current_hotel_fb_kds_group',[secret3,b,4,'delivered']),'22023','room delivery cannot skip out_for_delivery');
 await call('transition_current_hotel_fb_kds_group',[secret3,b,4,'out_for_delivery']);await call('transition_current_hotel_fb_kds_group',[secret3,b,5,'delivered']);checks.push('dispatch room delivery follows canonical delivery states');
 await db.exec(`reset role;update fb_kds_private.screens set active=false where id='${screen.id}'`);await claims(null,'service_role');await denied(()=>call('get_fb_kds_snapshot',[secret3]),'42501','inactive screen cannot read');
 await db.exec(`reset role;update fb_kds_private.screens set active=true where id='${screen.id}';update hotel_module_entitlements set is_enabled=false where hotel_id='${h}' and module_key='fb.menu'`);await claims(null,'service_role');await denied(()=>call('get_fb_kds_snapshot',[secret3]),'42501','module deactivation revokes screen data access');await claims(admin);await denied(()=>call('get_current_hotel_fb_kds_admin'),'42501','module deactivation denies KDS administration');
 await db.exec('reset role');const ordersBefore=await sql('select count(*)::int n from fb_order_private.orders');
 await db.exec("set libguest.kds_rollback='approved'");await db.exec(readFileSync('supabase/tests/53_kds_rollback.sql','utf8'));
 check((await sql('select count(*)::int n from fb_order_private.orders'))[0].n===ordersBefore[0].n,'rollback preserves order facts');
 check((await sql("select pg_get_functiondef('public.transition_current_hotel_fb_order_group_v2(uuid,integer,text)'::regprocedure) definition"))[0].definition===canonicalBefore[0].definition,'rollback preserves canonical order operations');
 const report={engine:'PostgreSQL via PGlite 0.3.15',auth:'synthetic claim settings; no GoTrue or PostgREST',passed:checks.length,checks,remoteWrites:0,physicalPrinting:false};mkdirSync('out/kds-universal',{recursive:true});writeFileSync('out/kds-universal/postgres-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await db.close();}
