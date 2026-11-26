import test from 'node:test';
import assert from 'node:assert/strict';
import {syncRoomCommercialTranslations,commercialTranslationFeedback} from '../../lib/fb/room-commercial-translations.ts';
import type {RoomNameRow} from '../../lib/fb/room-name-translations.ts';
import dictionary from '../../lib/fb/bugan-room-names.json' with {type:'json'};
const row=(values:Partial<RoomNameRow>={}):RoomNameRow=>({hotel_id:'hotel',outlet_id:'room',kind:'combo',id:'synthetic',
 source_name:'Combo de almoço',context_name:'',parent_id:null,saved_source_name:null,name_en:null,name_es:null,revision:0,...values});
function fixture(rows:RoomNameRow[]) {
 const calls:{fields:Record<string,string|null>;language:string}[]=[];const saved:unknown[]=[];
 return {calls,saved,io:{languagesEnabled:async()=>true,load:async()=>rows,
  translate:async(fields:Record<string,string|null>,language:'en'|'es')=>{calls.push({fields,language});return Object.fromEntries(Object.keys(fields).map(key=>[key,language+' label']));},
  save:async(args:unknown)=>{saved.push(args);return true;}}};
}
test('batches only commercial Portuguese names into two provider requests',async()=>{
 const f=fixture([row(),row({kind:'combo_slot',id:'slot',source_name:'Bebida'}),row({kind:'modifier_group',id:'group'}),row({kind:'modifier_option',id:'option'}),row({kind:'item',id:'product'})]);
 assert.deepEqual(await syncRoomCommercialTranslations(f.io),{generated:4,preserved:0,pending:0,disabled:false});
 assert.equal(f.calls.length,2);assert.equal(Object.keys(f.calls[0].fields).length,4);
 assert.deepEqual(Object.keys(f.calls[0].fields),['label0','label1','label2','label3']);
 assert.equal(f.saved.length,4);assert.ok(!JSON.stringify(f.calls).includes('amount_minor'));
});
test('preserves reviewed overrides, deliberate blanks and approved default names',async()=>{
 const [defaultId,initial]=Object.entries(dictionary.names)[0];
 const f=fixture([row({revision:3,origin:'reviewed',name_en:null,name_es:'Revisado',saved_source_name:'Nome anterior'}),row({id:defaultId,source_name:initial.source})]);
 const result=await syncRoomCommercialTranslations(f.io);
 assert.equal(result.preserved,2);assert.equal(result.pending,1);assert.equal(f.calls.length,0);assert.equal(f.saved.length,0);
});
test('complete automatic names are a no-op; missing language alone is retried',async()=>{
 const source='Combo de almoço';const f=fixture([row({revision:1,origin:'automatic',saved_source_name:source,name_en:'Lunch',name_es:'Almuerzo'}),row({id:'partial',revision:1,origin:'automatic',saved_source_name:source,name_en:'Lunch'})]);
 await syncRoomCommercialTranslations(f.io);assert.deepEqual(f.calls.map(x=>x.language),['es']);
 assert.equal((f.saved[0] as {p_name_en:string}).p_name_en,'Lunch');
});
test('renamed automatic names regenerate; failed language never reuses stale text',async()=>{
 const f=fixture([row({revision:1,origin:'automatic',saved_source_name:'Anterior',name_en:'Old',name_es:'Viejo'})]);
 const result=await syncRoomCommercialTranslations({...f.io,translate:async(_,language)=>language==='en'?null:{label0:'Nuevo'}});
 assert.deepEqual(f.saved,[{p_kind:'combo',p_id:'synthetic',p_source_name:'Combo de almoço',p_revision:1,p_name_en:null,p_name_es:'Nuevo'}]);
 assert.equal(result.pending,1);assert.equal(result.generated,1);
});
test('provider errors and invalid output remain pending without a translation save',async()=>{
 const outputs:(Record<string,string|null>|null)[]=[null,{}, {label0:''},{label0:'a'.repeat(161)},{label0:'bad\nlabel'}];
 for(const output of outputs) {
  const f=fixture([row()]);const result=await syncRoomCommercialTranslations({...f.io,translate:async()=>output});
  assert.equal(result.pending,1);assert.equal(f.saved.length,0);
 }
 const f=fixture([row()]);assert.equal((await syncRoomCommercialTranslations({...f.io,translate:async()=>{throw Error('offline');}})).pending,1);
});
test('language entitlement stops provider and storage; stale CAS remains pending',async()=>{
 const f=fixture([row()]);assert.equal((await syncRoomCommercialTranslations({...f.io,languagesEnabled:async()=>false})).disabled,true);
 assert.equal(f.calls.length,0);assert.equal(f.saved.length,0);
 assert.equal((await syncRoomCommercialTranslations({...f.io,save:async()=>false})).pending,1);
 assert.match(commercialTranslationFeedback('pending'),/Rascunho salvo/);
});
