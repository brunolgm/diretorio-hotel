import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { summarizeTourismTranslations } from '../../lib/tourism/translations.ts';

const item = { id:'one',name:'Nome',short_description:'Texto',full_description:null,opening_hours:null,price_info:null,duration_info:null };
test('language summary uses field completeness, handles missing rows and ignores foreign translations',()=>{
  const rows = summarizeTourismTranslations([item,{...item,id:'two'},{...item,id:'three'}],[{item_id:'one',language:'en',name:'Name',short_description:'Text'},{item_id:'one',language:'es',name:'Nombre'},{item_id:'two',language:'en',name:'Name'},{item_id:'foreign',language:'es',name:'Foreign',short_description:'Text'}]);
  assert.deepEqual(rows.map((r)=>[r.en,r.es]),[['complete','partial'],['partial','missing'],['missing','missing']]);
  assert.deepEqual(summarizeTourismTranslations([],[]),[]);
});
test('five editorial domains retain their queries/counts/links without global translation triggers',()=>{
  const before=execFileSync('git',['show','91634a4:app/admin/idiomas/page.tsx'],{encoding:'utf8'}).replace(/\r/g,'');
  const after=readFileSync('app/admin/idiomas/page.tsx','utf8').replace(/\r/g,'').replace("import { TourismLanguageSummary } from '@/components/admin/tourism-language-summary';\n",'').replace('      <TourismLanguageSummary hotelId={profile.hotel_id} />\n','').replace('description="Fontes dos cinco módulos editoriais"','description="Conteúdos fonte cadastrados"');
  assert.equal(after,before);
  const summary=readFileSync('components/admin/tourism-language-summary.tsx','utf8');
  assert.match(summary,/hasHotelModule\('content.tourism'\)/);assert.match(summary,/\.eq\('hotel_id', hotelId\)/);assert.match(summary,/summarizeTourismTranslations/);
  assert.doesNotMatch(summary,/translateTourismFields|syncTourismTranslations|form action|createAdminClient|fetch\(/);
});
