import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {rows,literal} from './fb-local-seed.mjs';
import {labSql} from '../../scripts/fb-local-lab.mjs';
export async function verifyAdversarial(io){
 const {s,tenants,project,check,rpc,deny,saved,record,auditCount,uiSave,publicPage}=io;
 const {default:sharp}=await import('sharp');
 const deniedUploadBytes=await sharp(readFileSync('docs/references/bugan/public-v3/restaurante-filipe-real.png')).resize(32,32).png().toBuffer();
 const anon={client:createClient(s.api,s.anon,{auth:{persistSession:false,autoRefreshToken:false}})};
 const tables=['outlets','menus','categories','items','outlets_translations','menus_translations','categories_translations','items_translations','outlet_menus','service_links'];
 const legacyProof=labSql(readFileSync('supabase/tests/53_fb_populated_legacy_unique.sql','utf8'));
 writeFileSync(join(s.dir,'legacy-unique-proof.log'),legacyProof);
 check(legacyProof.includes('"passed" : true'),'populated legacy UNIQUE: real lock, no heap/tuple changes, reversible with FK handling');
 for(const table of tables){const r=await anon.client.from('hotel_fb_'+table).select('*');check(r.error?.code==='42501','anon no raw '+table);}
 await deny({client:project},'save_current_hotel_fb',{p_kind:'menu',p_id:null,p_expected_revision:0,p_values:{name:'Bypass'}},'42501','actual service_role cannot bypass domain mutation');
 for(let index=0;index<tenants.length;index++){
  const t=tenants[index],foreign=tenants[(index+1)%tenants.length],op=t.operator;
  const unpublished=await uiSave(t.ui.page,'item',{is_published:false},t.item.id);
  check(!(await rpc(anon,'get_public_hotel_fb',{p_hotel_id:t.id,p_language:'pt'})).items.some(i=>i.id===unpublished.id),'Operator actual UI unpublish '+t.name);
  await uiSave(t.ui.page,'item',{is_published:true},t.item.id);
  check((await rpc(anon,'get_public_hotel_fb',{p_hotel_id:t.id,p_language:'pt'})).items.some(i=>i.id===t.item.id),'Operator actual UI republish '+t.name);
  await t.ui.page.goto(s.app+'/admin/cardapio?kind=outlet');
  const orderForm=t.ui.page.locator('form').filter({has:t.ui.page.locator('input[name=rows]')});
  const originalOrder=JSON.parse(await orderForm.locator('input[name=rows]').inputValue());
  await orderForm.getByRole('button',{name:'Mover conteúdo para baixo',exact:true}).click();await t.ui.page.waitForURL(u=>u.searchParams.has('success'));
  const actualOrder=rows("select json_agg(id order by sort_order,id) from public.hotel_fb_outlets where hotel_id="+literal(t.id));
  check(actualOrder[1]===originalOrder[0].id&&actualOrder[0]===originalOrder[1].id,'Operator actual UI reorder '+t.name);
  for(const actor of [op,t.viewer])for(const table of tables){
   const r=await actor.client.from('hotel_fb_'+table).select('*').eq('hotel_id',foreign.id);
   check(!r.error&&r.data.length===0,'RLS foreign '+table+' '+t.name+' '+(actor===op?'Operator':'Viewer'));
  }
  const before=auditCount(t);
  await deny(op,'save_current_hotel_fb',{p_kind:'outlet',p_id:foreign.outlet.id,p_expected_revision:foreign.outlet.revision,p_values:{name:'Forbidden'}},'P0002','foreign outlet identity '+t.name);
  for(const kind of ['menu','category','item'])await deny(op,'save_current_hotel_fb',{p_kind:kind,p_id:foreign[kind].id,p_expected_revision:1,p_values:{name:'Forbidden'}},'P0002','foreign '+kind+' identity '+t.name);
  await deny(op,'save_current_hotel_fb',{p_kind:'outlet',p_id:null,p_expected_revision:0,p_values:{name:'Forbidden',menu_ids:[foreign.menu.id]}},'23503','foreign menu association '+t.name);
  await deny(op,'save_current_hotel_fb',{p_kind:'category',p_id:null,p_expected_revision:0,p_values:{name:'Forbidden',menu_id:foreign.menu.id}},'23503','foreign category/menu '+t.name);
  await deny(op,'save_current_hotel_fb',{p_kind:'item',p_id:null,p_expected_revision:0,p_values:{name:'Forbidden',category_id:foreign.category.id}},'23503','foreign item/category '+t.name);
  await deny(op,'save_current_hotel_fb',{p_kind:'outlet',p_id:null,p_expected_revision:0,p_values:{name:'Forbidden',action_type:'service',service_id:foreign.services.filipe}},'23503','foreign Service association '+t.name);
  await deny(op,'save_current_hotel_fb_translation',{p_kind:'item',p_id:foreign.item.id,p_language:'en',p_source_revision:1,p_fields:{name:'Forbidden'}},'P0002','foreign translation '+t.name);
  await deny(op,'set_current_hotel_fb_image',{p_kind:'item',p_id:t.item.id,p_expected_revision:record('item',t.item.id).revision,p_path:foreign.id+'/fb/item/'+foreign.item.id+'/'+randomUUID()+'.png'},'23514','foreign media '+t.name);
  await deny(op,'update_platform_hotel_module',{p_hotel_id:t.id,p_module_key:'fb.menu',p_enabled:false},'42501','Operator cannot change entitlement '+t.name);
  const revision=record('item',t.item.id).revision;
  for(const [values,code]of [[{price_amount_minor:-1},'22023'],[{price_amount_minor:100000001},'23514'],[{price_amount_minor:2147483648},'22023'],[{currency:'ZZZ'},'23514'],[{currency:'brl'},'23514'],[{price_on_request:true,price_amount_minor:1},'23514']])
   await deny(op,'save_current_hotel_fb',{p_kind:'item',p_id:t.item.id,p_expected_revision:revision,p_values:values},code,'actual DB price/currency rejection '+t.name+' '+JSON.stringify(values));
  check(auditCount(t)===before,'all rejected tenant/price writes roll back audit '+t.name);
  for(const actor of [op,t.viewer]){
   const r=await actor.client.from('hotel_fb_items').update({name:'Bypass'}).eq('id',t.item.id);check(r.error?.code==='42501','direct DML denied '+t.name);
   const path=t.id+'/fb/item/'+t.item.id+'/'+randomUUID()+'.png';
   const upload=await actor.client.storage.from('hotel-assets').upload(path,deniedUploadBytes,{contentType:'image/png',upsert:false});
   check(String(upload.error?.statusCode)==='403'&&/row.level.security|permission/i.test(upload.error?.message||''),'actual Storage RLS rejects browser-role upload '+t.name+' '+JSON.stringify(upload.error));
  }
  const second=createClient(s.api,s.anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const login=await second.auth.signInWithPassword({email:op.email,password:op.password});check(!login.error,'second independent actual Auth session '+t.name);
  for(const [kind,id,patches]of [['outlet',t.outlet.id,[{short_description:'A local'},{short_description:'B local'}]],['item',t.item.id,[{short_description:'A item'},{short_description:'B item'}]],['item',t.zero.id,[{is_published:false},{is_published:false}]]]){
   const row=record(kind,id),before=auditCount(t);
   const results=await Promise.all([op.client,second].map((client,n)=>client.rpc('save_current_hotel_fb',{p_kind:kind,p_id:id,p_expected_revision:row.revision,p_values:patches[n]})));
   check(results.filter(r=>!r.error).length===1&&results.filter(r=>r.error?.code==='PT409'&&r.status===409).length===1,'real concurrent CAS '+kind+' '+t.name+' '+JSON.stringify(results.map(r=>({status:r.status,error:r.error}))));
   const winner=results.findIndex(r=>!r.error),current=record(kind,id);
   check(Object.entries(patches[winner]).every(([k,v])=>current[k]===v)&&current.revision===row.revision+1,'CAS preserves winner '+kind+' '+t.name);
   check(auditCount(t)===before+1,'CAS has one true audit '+kind+' '+t.name);
  }
  const stale=await rpc(op,'save_current_hotel_fb_translation',{p_kind:'item',p_id:t.item.id,p_language:'es',p_source_revision:1,p_fields:{name:'Stale must not save'}});
  check(stale===false,'actual stale translation false '+t.name);
  const graph=await rpc(anon,'get_public_hotel_fb',{p_hotel_id:t.id,p_language:'en'});
  check(graph.items.find(i=>i.id===t.item.id).name==='Prato de fixture','actual stale field fallback to PT '+t.name);
  await t.ui.page.goto(s.app+'/admin/idiomas');
  check(await t.ui.page.getByText('Gastronomia · idiomas por campos da fonte PT',{exact:true}).count()===1,'real language administration '+t.name);
  const snapshot=rows("select json_agg(to_jsonb(x) order by id) from public.hotel_sections x where hotel_id="+literal(t.id));
  await uiSave(t.ui.page,'outlet',{action_type:'none'},t.outlet.id);
  assert.deepEqual(rows("select json_agg(to_jsonb(x) order by id) from public.hotel_sections x where hotel_id="+literal(t.id)),snapshot);
  check(true,'unbinding leaves legacy Service fields byte-equivalent '+t.name);
  await uiSave(t.ui.page,'outlet',{action_type:'service',service_id:t.services.filipe,menu_ids:[t.menu.id]},t.outlet.id);
  console.log('Actual RLS/CAS/denied-Storage matrix completed: '+t.name);
 }
 const t=tenants[4],page=t.ui.page;
 const image='docs/references/bugan/public-v3/restaurante-filipe-real.png';
 const validImage={name:'fixture-local.png',mimeType:'image/png',buffer:await sharp(readFileSync(image)).resize({width:900,height:600,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9,palette:true,colors:128}).toBuffer()};
 const mediaCount=()=>rows("select count(*)::text from storage.objects where bucket_id='hotel-assets' and name like "+literal(t.id+'/fb/%'));
 async function imageForm(target,kind,id){await target.goto(s.app+'/admin/cardapio?kind='+kind+'&id='+id);await target.getByRole('tab',{name:'Imagem',exact:true}).click();return target.locator('form').filter({has:target.locator('input[type=file]')});}
 async function upload(target,kind,id,payload=validImage,success=true){
  const form=await imageForm(target,kind,id);await form.locator('input[type=file]').setInputFiles(payload);await form.getByRole('button',{name:/^(Enviar|Alterar) imagem$/}).click();
  await target.waitForURL(u=>u.searchParams.has(success?'success':'error'),{timeout:120000});return record(kind,id);
 }
 const first=await upload(page,'outlet',t.outlet.id);
 check(Boolean(first.main_image_path),'actual application upload association');
 for(const width of [390,1440]){
  await publicPage.setViewportSize({width,height:1000});await publicPage.goto(s.app+'/hotel/'+t.slug+'/explorar/cardapio');
  await publicPage.waitForFunction(()=>[...document.querySelectorAll('[data-fb-native] img')].some(img=>img.complete&&img.naturalWidth>0));
  check(await publicPage.locator('[data-fb-native] img').count()===1,'actual public image rendered '+width);
  const filipe=publicPage.locator('[data-fb-native] details').filter({has:publicPage.locator('summary').filter({hasText:'Restaurante Filipe'})});
  await filipe.locator('summary').click();await filipe.locator('summary').scrollIntoViewIfNeeded();
  await publicPage.screenshot({path:join(s.dir,'bugan-real-storage-'+width+'.png'),fullPage:true});
 }
 const publicObject=await fetch(s.api+'/storage/v1/object/public/hotel-assets/'+first.main_image_path);
 check(publicObject.ok&&(await publicObject.arrayBuffer()).byteLength>0,'actual public Storage object readable');
 const other=await t.ui.context.newPage();await imageForm(other,'outlet',t.outlet.id);
 await other.getByRole('tab',{name:'Conteúdo',exact:true}).click();await other.locator('input[name=name]').fill('Rascunho local anterior ao conflito');await other.getByRole('tab',{name:'Imagem',exact:true}).click();
 const second=await upload(page,'outlet',t.outlet.id);const before=auditCount(t);
 const staleForm=other.locator('form').filter({has:other.locator('input[type=file]')});
 await staleForm.locator('input[type=file]').setInputFiles(validImage);await staleForm.getByRole('button',{name:/^(Enviar|Alterar) imagem$/}).click();
 await other.waitForURL(u=>u.searchParams.has('error'),{timeout:120000});
 check(record('outlet',t.outlet.id).main_image_path===second.main_image_path,'stale media upload preserves first tab winner');
 check(await other.locator('input[name=name]').inputValue()===record('outlet',t.outlet.id).name,'RSC conflict refresh never combines stale editable fields with a fresh revision');
 check(auditCount(t)===before&&mediaCount()===1,'stale media emits no false audit and cleans rejected upload');
 check(!(await fetch(s.api+'/storage/v1/object/public/hotel-assets/'+first.main_image_path)).ok,'confirmed replacement cleans old real object');
 const duplicate=await project.storage.from('hotel-assets').upload(second.main_image_path,readFileSync(image),{contentType:'image/png',upsert:false});check(Boolean(duplicate.error),'real Storage upsert false preserves existing object');
 await deny(t.operator,'set_current_hotel_fb_image',{p_kind:'outlet',p_id:t.outlet.id,p_expected_revision:second.revision,p_path:second.main_image_path},'23514','old image cannot be reattached during cleanup');
 await deny(t.operator,'set_current_hotel_fb_image',{p_kind:'outlet',p_id:t.outlet.id,p_expected_revision:second.revision,p_path:t.id+'/fb/outlet/'+t.outlet.id+'/'+randomUUID()+'.png'},'23514','invented owned path rejected against real Storage');
 for(const payload of [{name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not an image')},{name:'fake.jpg',mimeType:'image/jpeg',buffer:validImage.buffer},{name:'large.png',mimeType:'image/png',buffer:Buffer.concat([validImage.buffer,Buffer.alloc(2*1024*1024+1-validImage.buffer.length)])}]){
  const before=record('outlet',t.outlet.id);await upload(page,'outlet',t.outlet.id,payload,false);check(record('outlet',t.outlet.id).revision===before.revision&&mediaCount()===1,'invalid actual image rejected before Storage '+payload.name);
 }
 const oversized=await sharp({create:{width:6100,height:1,channels:3,background:'#abcdef'}}).png().toBuffer();
 await upload(page,'outlet',t.outlet.id,{name:'dimensions.png',mimeType:'image/png',buffer:oversized},false);check(mediaCount()===1,'dimensions rejected by real action');
 await page.goto(s.app+'/admin/cardapio?kind=outlet&id='+t.outlet.id);
 await page.getByRole('tab',{name:'Imagem',exact:true}).click();page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Remover imagem',exact:true}).click();await page.waitForURL(u=>u.searchParams.has('success'));
 check(record('outlet',t.outlet.id).main_image_path===null&&mediaCount()===0,'real image removal associates null then cleans');
 const {verifyLateCommit}=await import('./fb-local-late-commit.mjs');
 await verifyLateCommit({s,t,project,check,record,bytes:validImage.buffer});
 // Reusable menu deletion rules, exercised through actual application confirmation.
 async function deleteUi(kind,id){
  await page.goto(s.app+'/admin/cardapio?kind='+kind);
  const row=page.locator('[data-fb-admin-record]').filter({has:page.locator('a[href*="id='+id+'"]')});
  await row.getByLabel('Mais ações do conteúdo',{exact:true}).click();
  let confirmed=false;page.once('dialog',async dialog=>{confirmed=true;await dialog.accept();});
  await row.getByRole('button',{name:'Excluir definitivamente',exact:true}).click();
  await page.waitForURL(u=>u.searchParams.has('success')&&!u.searchParams.has('id'),{timeout:120000});
  check(confirmed&&record(kind,id)===null,'confirmed real hard delete '+kind);
 }
 const menu=await saved(t,'menu',null,{name:'Menu descartável',is_published:true});
 const category=await saved(t,'category',null,{name:'Categoria descartável',menu_id:menu.id,is_published:true});
 const item=await saved(t,'item',null,{name:'Item descartável',category_id:category.id,is_published:true});
 const outletA=await saved(t,'outlet',null,{name:'Associação A',menu_ids:[menu.id]});
 const outletB=await saved(t,'outlet',null,{name:'Associação B',menu_ids:[menu.id]});
 await saved(t,'outlet',outletA.id,{menu_ids:[]},outletA.revision);
 check(record('menu',menu.id)!==null&&record('item',item.id)!==null,'unlink shared menu never deletes content');
 await deleteUi('outlet',outletB.id);check(record('menu',menu.id)!==null&&record('item',item.id)!==null,'delete outlet retains shared menu and items');
 const itemImage=await upload(page,'item',item.id);
 await deleteUi('menu',menu.id);
 check(record('category',category.id)===null&&record('item',item.id)===null,'menu cascade removes category and item deliberately');
 check(!(await fetch(s.api+'/storage/v1/object/public/hotel-assets/'+itemImage.main_image_path)).ok,'menu cascade cleanup confirmed against real Storage');
 const cat=await saved(t,'category',null,{name:'Categoria cascade',menu_id:t.menu.id});
 const i1=await saved(t,'item',null,{name:'Item cascade 1',category_id:cat.id});
 const i2=await saved(t,'item',null,{name:'Item cascade 2',category_id:cat.id});
 await deleteUi('item',i1.id);check(record('category',cat.id)!==null&&record('item',i2.id)!==null,'item deletion preserves sibling and parent');
 await deleteUi('category',cat.id);check(record('item',i2.id)===null,'category cascade removes remaining item');
 const inserted=await t.operator.client.from('hotel_sections').insert({hotel_id:t.id,title:'Serviço descartável',service_action_type:'standard',enabled:true}).select('id').single();
 check(!inserted.error,'actual authorized Service fixture creation '+inserted.error?.code);
 const service=inserted.data.id;
 const associated=await saved(t,'outlet',null,{name:'Outlet com Serviço descartável',action_type:'service',service_id:service});
 const deleted=await t.operator.client.from('hotel_sections').delete().eq('id',service);check(!deleted.error,'actual Service delete');
 check(record('outlet',associated.id)!==null&&rows("select count(*)::text from public.hotel_fb_service_links where outlet_id="+literal(associated.id))===0,'Service deletion cascades link only');
 // Room tokens enter through the existing /r route. Never treated as Auth identity.
 for(const tenant of tenants){
  const nativeRoom=await uiSave(tenant.ui.page,'outlet',{name:'Cardápio por apartamento',type:'room_service',action_type:'service',service_id:tenant.services.room,is_published:true});
  await publicPage.goto(s.app+'/hotel/'+tenant.slug+'/explorar/cardapio');
  const detail=publicPage.locator('[data-fb-native] details').filter({has:publicPage.locator('summary').filter({hasText:'Cardápio por apartamento'})});
  await detail.locator('summary').click();
  const roomHref=await detail.locator('a').first().getAttribute('href');
  check(roomHref.includes('/servicos/'+tenant.services.room)&&!roomHref.includes('roomToken')&&nativeRoom.external_url===null,'native room outlet reuses original Service resolver '+tenant.name);
  const context=await publicPage.context().browser().newContext();const request=context.request;
  try{
   const serviceUrl=s.app+'/hotel/'+tenant.slug+'/servicos/'+tenant.services.room;
   let response=await request.get(serviceUrl,{maxRedirects:0});check(response.status()===200,'room menu missing context '+tenant.name);
   for(const [label,token]of [['invalid','bad'],['inactive',tenant.roomTokens.inactive],['valid',tenant.roomTokens.valid],['missing-url',tenant.roomTokens.missing]]){
    await context.clearCookies();const entry=await request.get(s.app+'/r/'+token,{maxRedirects:0});
    check(entry.status()>=300&&entry.status()<400,'real QR resolver '+label+' '+tenant.name);
    response=await request.get(serviceUrl,{maxRedirects:0});
    if(label==='valid')check(response.status()>=300&&response.status()<400&&response.headers().location==='https://room.fixture.invalid/menu','room valid URL uses existing redirect '+tenant.name);
    else check(response.status()===200&&!response.headers().location,'room invalid/inactive/missing URL has safe page '+tenant.name+' '+label);
   }
   await context.clearCookies();await request.get(s.app+'/r/'+tenants[(tenants.indexOf(tenant)+1)%6].roomTokens.valid,{maxRedirects:0});
   response=await request.get(serviceUrl,{maxRedirects:0});check(response.status()===200&&!response.headers().location,'foreign room token cannot authorize '+tenant.name);
   response=await request.get(s.app+'/admin/cardapio',{maxRedirects:0});check(response.headers().location?.includes('/login'),'room token never becomes administrative identity '+tenant.name);
  }finally{await context.close();}
 }
 // The deployed Data API caps results at 1000; the native quota permits 5000.
 // Create through the real authenticated RPC and verify both actual Admin reads.
 const scaleTenant=tenants[5];
 const scaleMenu=await saved(scaleTenant,'menu',null,{name:'Cardápio de escala'});
 const scaleCategory=await saved(scaleTenant,'category',null,{name:'Categoria de escala',menu_id:scaleMenu.id});
 let lastScale;
 for(let offset=0;offset<1005;offset+=20){
  const batch=await Promise.all(Array.from({length:Math.min(20,1005-offset)},(_,i)=>saved(scaleTenant,'item',null,{name:'Escala '+String(offset+i).padStart(4,'0'),category_id:scaleCategory.id})));
  lastScale=batch.at(-1);
 }
 const capped=await scaleTenant.operator.client.from('hotel_fb_items').select('id',{count:'exact'}).eq('category_id',scaleCategory.id);
 check(capped.data.length===1000&&capped.count===1005,'actual Data API cap is exercised by 1005 authenticated creations');
 await scaleTenant.ui.page.goto(s.app+'/admin/cardapio?kind=item&id='+lastScale.id);
 check(await scaleTenant.ui.page.locator('input[name=name]').inputValue()==='Escala 1004','real Admin edits a record beyond the first 1000');
 await scaleTenant.ui.page.goto(s.app+'/admin/idiomas');
 check(await scaleTenant.ui.page.locator('tbody tr').filter({hasText:'Escala 1004'}).count()===1,'real language summary includes source beyond 1000');
 await rpc(scaleTenant.operator,'delete_current_hotel_fb',{p_kind:'menu',p_id:scaleMenu.id,p_expected_revision:scaleMenu.revision});
 check(record('item',lastScale.id)===null,'authenticated scale fixture cleanup cascades intentionally');
 console.log('Actual adversarial/RLS/CAS/Storage/delete/room matrix completed.');
}
