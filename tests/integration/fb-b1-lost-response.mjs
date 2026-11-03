// Disconnect the real HTTP client while PostgreSQL waits on an actual hotel lock.
// The upstream remains connected. No fabricated transaction or response.
import {createServer,request} from 'node:http';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {labSql} from '../../scripts/fb-local-lab.mjs';
const {deriveOrderAccessSecret,orderSecretDigest}=await import('../../lib/fb/orders/credentials.server.ts');
export async function verifyB1LostResponse({state,t,boundary,baseIntent,check,query}){
 const session=await boundary.beginSession(t.slug);if(!session.ok)throw Error('Fault fixture session failed');
 const input={slug:t.slug,session:session.data.secret,key:randomUUID(),outlet:t.outlet.id,intent:baseIntent(t),roomToken:null,expectedTotalMinor:2500,expectedCurrency:'BRL'};
 const access=deriveOrderAccessSecret(input.session,t.slug,t.outlet.id,input.key);
 const body={p_hotel_slug:t.slug,p_session_secret:input.session,p_key:input.key,p_outlet_id:t.outlet.id,p_intent:input.intent,p_room_token:null,p_access_digest:orderSecretDigest(access),p_expected_total_minor:2500,p_expected_currency:'BRL'};
 const before=query("select count(*)::text from fb_order_private.orders where hotel_id='"+t.id+"'");
 labSql('select 1'); // Manager verifies the owned container before the lock helper.
 const lock=spawn('docker',['exec','-i',state.containers.db,'psql','-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',state.database],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 const locked=new Promise((resolve,reject)=>{lock.stdout.on('data',d=>{if(d.toString().includes('LOCKED'))resolve();});lock.once('error',reject);lock.once('exit',code=>{if(code)reject(Error('Local lock helper failed'));});});
 lock.stdin.end("begin;select id from public.hotels where id='"+t.id+"' for update;select 'LOCKED';select pg_sleep(2.5);commit;");
 await locked;
 let complete,fail;const upstreamDone=new Promise((resolve,reject)=>{complete=resolve;fail=reject;});
 const proxy=createServer((incoming,outgoing)=>{
  const upstream=request(state.api+incoming.url,{method:incoming.method,headers:{...incoming.headers,host:new URL(state.api).host}},response=>{
   let text='';response.on('data',chunk=>text+=chunk);response.on('end',()=>complete({status:response.statusCode,data:JSON.parse(text)}));
  });
  upstream.once('error',fail);incoming.pipe(upstream);setTimeout(()=>outgoing.destroy(),80);
 });
 await new Promise((resolve,reject)=>{proxy.once('error',reject);proxy.listen(54349,'127.0.0.1',resolve);});
 try{
  let disconnected=false;
  try{await fetch('http://127.0.0.1:54349/rest/v1/rpc/confirm_fb_order',{method:'POST',headers:{apikey:state.service,Authorization:'Bearer '+state.service,'Content-Type':'application/json'},body:JSON.stringify(body)});}
  catch{disconnected=true;}
  check(disconnected,'actual committed-response test disconnects client transport');
  const committed=await upstreamDone;
  check(committed.status===200,'upstream actual transaction commits after client disconnect');
  const retry=await boundary.confirm(input);
  check(retry.ok&&retry.data.replayed&&retry.data.order_id===committed.data.order_id,'actual lost response retry returns same committed order');
  check(query("select count(*)::text from fb_order_private.orders where hotel_id='"+t.id+"'")===before+1,'actual HTTP loss produces exactly one order');
  check(query("select count(*)::text from fb_order_private.order_events where order_id='"+committed.data.order_id+"' and action='orders.registered'")===1,'actual HTTP loss produces exactly one registration event');
 }finally{await new Promise(resolve=>proxy.close(resolve));}
}
