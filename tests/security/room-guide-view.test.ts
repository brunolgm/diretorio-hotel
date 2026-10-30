import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guideChannelResults,guideChannelPage,parseGuideView,GUIDE_CHANNEL_PAGE_SIZE} from '../../lib/room-guide-view.ts';
import type {RoomGuide} from '../../lib/room-guides.ts';
const guide=JSON.parse(readFileSync('docs/bootstrap/bugan-room-guides-20261030.json','utf8')).guides[0].configuration as RoomGuide;
test('SporTV searches the entire draft inventory; exact six numbers survive pagination',()=>{
 const before=JSON.stringify(guide),r=guideChannelResults(guide,'SpOrTV','all',true);
 assert.deepEqual(r.channels.map(c=>c.number),['37','38','39','537','538','539']);assert.equal(r.apps.length,0);assert.equal(JSON.stringify(guide),before);
 assert.deepEqual(guideChannelResults(guide,'539','all',true).channels.map(c=>c.number),['539']);
});
test('applications respect queries and never become linear numbered results',()=>{
 const r=guideChannelResults(guide,'Netflix','all',true);assert.equal(r.channels.length,0);assert.equal(r.apps.length,1);assert.equal(r.apps[0].kind,'application');
 assert.equal(guideChannelResults(guide,'sportv','all',true).apps.length,0);assert.equal(guideChannelResults(guide,'','all',true).apps.length,1);
 assert.deepEqual(guideChannelResults(guide,'no-such-tv-result','all',true),{channels:[],apps:[]});
});
test('format filters are literal; absent format never becomes SD or HD',()=>{
 for(const quality of ['HD','SD','unspecified'] as const){const r=guideChannelResults(guide,'',quality,true);assert.ok(r.channels.every(c=>c.quality===quality));}
 const r=guideChannelResults(guide,'18','SD',true);assert.equal(r.channels.some(c=>c.number==='18'),false);
});
test('pagination is bounded, complete and nonmutating; searches precede slicing',()=>{
 const all=guideChannelResults(guide,'','all',true).channels;assert.equal(all.length,221);const collected=[];
 for(let n=1;n<=Math.ceil(all.length/GUIDE_CHANNEL_PAGE_SIZE);n++){const p=guideChannelPage(all,n);assert.ok(p.items.length<=12);collected.push(...p.items);}
 assert.deepEqual(collected,all);assert.equal(guideChannelPage(all,999).page,19);assert.equal(guideChannelPage(all,-1).page,1);assert.equal(guideChannelPage([],1).items.length,0);
 assert.equal(guideChannelPage(guideChannelResults(guide,'539','all',true).channels,1).items[0].number,'539');
});
test('public presentation cannot render review channels, even if supplied to the UI',()=>{
 const r=guideChannelResults(guide,'','all',false);assert.equal(r.channels.length,0);assert.equal(r.apps[0].name,'Netflix');
});
test('untrusted UI preferences cannot authorize data, escape indices or select hidden tabs',()=>{
 for(const raw of ['', 'null','[]','{broken'])assert.equal(parseGuideView(raw,guide,true).tab,'how');
 const v=parseGuideView(JSON.stringify({tab:'admin',step:999,quality:'4K',page:-5,search:'a'.repeat(500),hotel_id:'foreign'}),guide,true);assert.equal(v.tab,'how');assert.equal(v.step,4);assert.equal(v.quality,'all');assert.equal(v.page,1);assert.equal(v.search.length,160);
 assert.equal(parseGuideView('{"tab":"channels"}',{...guide,channels:[]},false).tab,'how');
});
