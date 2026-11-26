import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoomServiceHours,roomServiceHoursCopy} from '../../lib/fb/room-service-hours.ts';
const hours={timezone:'America/Recife',start_minute:480,end_minute:1380,outside_regular_hours:true,reopens_at:'2026-11-27T11:00:00Z'};
test('daily schedule and reopening use reviewed PT/EN/ES copy and the hotel timezone',()=>{
  assert.deepEqual(roomServiceHoursCopy(hours,'pt',false),{hours:'Todos os dias, das 8h às 23h.',notice:'Room Service fechado. Reabre às 8h.'});
  assert.deepEqual(roomServiceHoursCopy(hours,'en',false),{hours:'Daily, 8:00 AM–11:00 PM.',notice:'Room Service is closed. Reopens at 8:00 AM.'});
  assert.deepEqual(roomServiceHoursCopy(hours,'es',false),{hours:'Todos los días, de 8:00 a 23:00.',notice:'Room Service cerrado. Reabre a las 8:00.'});
});
test('opening and authoritative availability remove the closed notice without hiding the schedule',()=>{
  for(const language of ['pt','en','es'] as const){
    assert.equal(roomServiceHoursCopy({...hours,outside_regular_hours:false,reopens_at:null},language,true).notice,null);
    assert.equal(roomServiceHoursCopy(hours,language,true).notice,null);
    assert.equal(roomServiceHoursCopy({...hours,outside_regular_hours:false},language,false).notice,null);
  }
});
test('unknown reopening never promises 8h and calendar overrides use the returned next opening',()=>{
  assert.equal(roomServiceHoursCopy({...hours,reopens_at:null},'pt',false).notice,'Room Service fechado.');
  assert.equal(roomServiceHoursCopy({...hours,reopens_at:'2026-11-27T13:30:00Z'},'pt',false).notice,'Room Service fechado. Reabre às 10h30.');
});
test('invalid or missing calendar metadata cannot enter the guest presentation',()=>{
  assert.equal(parseRoomServiceHours(hours),hours);
  for(const value of [null,{}, {...hours,start_minute:-1},{...hours,start_minute:8.5},{...hours,end_minute:480},{...hours,end_minute:1440},{...hours,timezone:'Invalid/Timezone'},{...hours,reopens_at:'wrong'},{...hours,outside_regular_hours:'false'}])assert.equal(parseRoomServiceHours(value),undefined);
});
