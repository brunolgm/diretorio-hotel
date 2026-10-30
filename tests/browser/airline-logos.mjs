// Presentation regression. All flight responses are local fixtures/replays, never provider calls.
import assert from 'node:assert/strict';
import {join} from 'node:path';
export async function runAirlineLogos({page,output}){
 const rows=[],origin='http://127.0.0.1:4174';
 async function visit(params){await page.goto(origin+'/after?'+new URLSearchParams({scenario:'premium',experience:'v4',theme:'bugan',lang:'pt',...params}));await page.locator('[data-saved-guest-flight]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-guest-flight-status]')?.getAttribute('aria-busy')==='false');}
 async function check(code){const mark=page.locator('[data-airline-mark]');assert.equal(await mark.getAttribute('data-airline-mark'),code);const box=await mark.boundingBox();assert.equal(box.width,56);assert.equal(box.height,56);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(code==='fallback'){assert.equal(await mark.locator('img').count(),0);assert.equal(await mark.locator('svg').count(),1);}else{const img=mark.locator('img');await img.waitFor();await page.waitForFunction(()=>{const i=document.querySelector('[data-airline-mark] img');return i?.complete&&i.naturalWidth>0;});assert.ok(await img.getAttribute('alt'));const ratio=await img.evaluate(i=>({render:i.getBoundingClientRect().width/i.getBoundingClientRect().height,natural:i.naturalWidth/i.naturalHeight}));assert.ok(Math.abs(ratio.render-ratio.natural)<.06,'official proportions preserved');}
 }
 for(const theme of ['bugan','grand-mercure','deep-ocean','novotel','mercure','default'])for(const lang of ['pt','en','es'])for(const [width,height]of [[360,640],[375,667],[390,645],[390,844],[430,932],[1024,768],[1440,900],[1536,864]]){
  await page.setViewportSize({width,height});await visit({theme,lang});await check('LA');assert.ok((await page.locator('.flight-number').innerText()).includes('LA 3565'));assert.ok((await page.locator('.flight-location-facts').innerText()).includes('07'));assert.equal(await page.evaluate(()=>window.fixturePayloads.length),1);
  if(theme==='bugan'&&lang==='pt'&&[390,1440].includes(width)){await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);document.querySelector('[data-public-internal-body]').scrollTop=0;});await page.screenshot({path:join(output,'logos-latam-'+width+'x'+height+'.png')});}
  rows.push({theme,lang,width,height,logo:'LA',passed:true});
 }
 await page.setViewportSize({width:390,height:844});
 for(const lang of ['pt','en','es'])for(const [logoCase,code,status]of [['azul','AD','live'],['gol','G3','not_found'],['tam','LA',''],['known','fallback','not_found'],['unknown','fallback','not_found'],['ambiguous','fallback',''],['conflict','fallback','']]){
  await visit({lang,logoCase,status});await check(code);assert.ok(await page.locator('.flight-number').innerText());
  if(code==='AD'){assert.equal(await page.locator('.flight-time-facts>div').count(),3);assert.ok((await page.locator('.flight-time-facts').innerText()).includes('17:20'));}
  if(code==='fallback')assert.equal(await page.locator('[data-flight-operational-status]').count(),0);
  if(lang==='pt')await page.screenshot({path:join(output,'logos-'+logoCase+'.png')});rows.push({lang,logoCase,code,status,passed:true});
 }
 // A failed image must not change card geometry, manual storage, provider query or displayed data.
 await visit({});const before={stored:await page.evaluate(()=>localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('libguest:flight:')))),query:await page.evaluate(()=>window.fixturePayloads),text:await page.locator('[data-saved-guest-flight]').innerText(),box:await page.locator('[data-saved-guest-flight]').boundingBox()};
 await page.route('**/brand/airlines/latam.png',r=>r.abort());await visit({});await page.locator('[data-airline-mark="fallback"]').waitFor();await check('fallback');assert.equal(await page.locator('[data-saved-guest-flight]').innerText(),before.text);assert.deepEqual(await page.evaluate(()=>window.fixturePayloads),before.query);assert.equal(await page.evaluate(()=>localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('libguest:flight:')))),before.stored);assert.deepEqual(await page.locator('[data-saved-guest-flight]').boundingBox(),before.box);await page.screenshot({path:join(output,'logos-failed-image.png')});await page.unroute('**/brand/airlines/latam.png');rows.push({failedImage:true,geometryAndDataPreserved:true,passed:true});
 for(const tab of ['partidas','chegadas']){await page.goto(origin+'/after?'+new URLSearchParams({scenario:'premium',experience:'v4',theme:'bugan',lang:'pt',tab}));await page.locator('h1').waitFor();assert.equal(await page.locator('[data-airline-mark]').count(),0);assert.equal(await page.evaluate(()=>window.fixturePayloads.length),0);rows.push({tab,noDecorativeLogo:true,passed:true});}
 return rows;
}
