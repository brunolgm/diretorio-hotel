// A real lost HTTP connection while the actual DB transaction waits on a lock.
// The proxy never fabricates Auth/SQL/Storage results and keeps upstream alive.
import '../../scripts/bootstrap-runtime.mjs';
import {createServer,request} from 'node:http';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {labSql} from '../../scripts/fb-local-lab.mjs';
import {associateTourismImage} from '../../lib/tourism/image.ts';
import {isOwnedFbImagePath} from '../../lib/fb/media.ts';
import {validateImageUpload,IMAGE_UPLOAD_POLICIES} from '../../lib/security/image-upload.ts';
export async function verifyLateCommit({s,t,project,check,record,bytes}){
 // Recheck actual Admin after streamed loading UI has disappeared. Reuse only
 // the contexts that already signed in normally; do not create or forge sessions.
 let actors=0;
 for(const context of t.ui.context.browser().contexts()){
  const page=context.pages()[0];if(!page)continue;
  const url=new URL(page.url());if(url.pathname!=='/admin/cardapio')continue;
  const kind=url.searchParams.get('kind'),id=url.searchParams.get('id');
  const entity=record(kind,id);if(!entity)throw Error('Admin screenshot requires existing selected entity');
  const slug=labSql("select slug from public.hotels where id='"+entity.hotel_id+"'",true);
  await page.locator('h1').first().waitFor();await page.getByRole('tab',{name:'Conteúdo',exact:true}).click();await page.locator('input[name=name]').waitFor();
  const role=await page.getByRole('button',{name:'Salvar alterações',exact:true}).count()?'operator':'viewer';
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:1000});
   await page.locator('input[name=name]').waitFor();
   check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'hydrated real Admin responsive '+slug+' '+role+' '+width);
   await page.screenshot({path:join(s.dir,slug+'-admin-'+role+'-'+width+'.png'),fullPage:true});
  }
  actors++;
 }
 check(actors===12,'all twelve normally authenticated Operator/Viewer contexts captured after loading');
 const row=record('outlet',t.outlet.id),path=t.id+'/fb/outlet/'+row.id+'/'+randomUUID()+'.png';
 const validated=await validateImageUpload({size:bytes.length,type:'image/png',arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)},IMAGE_UPLOAD_POLICIES.tourism);
 check(validated.ok,'fault-test upload bytes use actual validator');
 const upload=await project.storage.from('hotel-assets').upload(path,validated.value.bytes,{contentType:validated.value.mimeType,upsert:false});if(upload.error)throw upload.error;
 const {data:{session}}=await t.operator.client.auth.getSession();
 const lock=spawn('docker',['exec','-i',s.containers.db,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',s.database],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 const locked=new Promise((resolve,reject)=>{lock.stdout.on('data',d=>{if(d.toString().includes('LOCKED'))resolve();});lock.once('error',reject);lock.once('exit',code=>{if(code)reject(Error('Lock process failed'));});});
 lock.stdin.end("begin; select id from public.hotels where id='"+t.id+"' for update; select 'LOCKED'; select pg_sleep(3); commit;");
 await locked;
 let upstreamResolve,upstreamReject;
 const upstreamDone=new Promise((resolve,reject)=>{upstreamResolve=resolve;upstreamReject=reject;});
 const proxy=createServer((incoming,outgoing)=>{
  const upstream=request(s.api+incoming.url,{method:incoming.method,headers:{...incoming.headers,host:new URL(s.api).host}},response=>{
   let body='';response.on('data',chunk=>body+=chunk);response.on('end',()=>upstreamResolve({status:response.statusCode,body}));
  });
  upstream.once('error',upstreamReject);incoming.pipe(upstream);
  // Disconnect only the client. The DB's real upstream request remains connected.
  setTimeout(()=>outgoing.destroy(),80);
 });
 await new Promise(resolve=>proxy.listen(54348,'127.0.0.1',resolve));
 const removals=[];let observedOld=false;
 try{
  const feedback=await associateTourismImage({hotelId:t.id,itemId:row.id,oldPath:row.main_image_path,newPath:path,revision:String(row.revision),
   ownsPath:(p,h,id)=>isOwnedFbImagePath(p,h,'outlet',id),errorMessage:()=>'',io:{
    associate:async()=>{
     try{const r=await fetch('http://127.0.0.1:54348/rest/v1/rpc/set_current_hotel_fb_image',{method:'POST',headers:{apikey:s.anon,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_kind:'outlet',p_id:row.id,p_expected_revision:row.revision,p_path:path})});return {data:await r.json(),error:null};}
     catch{return {data:null,error:null};}
    },
    read:async()=>{const r=await t.operator.client.from('hotel_fb_outlets').select('main_image_path').eq('id',row.id).single();if(r.error)throw r.error;observedOld=r.data.main_image_path===row.main_image_path;return r.data.main_image_path;},
    remove:async p=>{removals.push(p);return project.storage.from('hotel-assets').remove([p]);},log:()=>{}
   }});
  check(observedOld&&Boolean(feedback.warning)&&removals.length===0,'real ambiguous response plus old read never authorizes cleanup');
  const committed=await upstreamDone;
  check(committed.status===200&&record('outlet',row.id).main_image_path===path,'real late DB commit associates preserved upload');
  check((await fetch(s.api+'/storage/v1/object/public/hotel-assets/'+path)).ok,'late committed image still exists in actual Storage');
  const cleared=await t.operator.client.rpc('set_current_hotel_fb_image',{p_kind:'outlet',p_id:row.id,p_expected_revision:row.revision+1,p_path:null});if(cleared.error)throw cleared.error;
  await project.storage.from('hotel-assets').remove([path]);
 }finally{await new Promise(resolve=>proxy.close(resolve));}
 // Read-only postcondition, against the actual dedicated DB.
 check(labSql("select main_image_path is null from public.hotel_fb_outlets where id='"+row.id+"';",true)==='t','fault test ends with confirmed null association');
}
