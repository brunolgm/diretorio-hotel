import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
// All scenarios are isolated renderer fixtures. No auth, database, requests to hotels or provider.
export async function runPremiumHotfix({page,origin,output}){
 const rows=[],views=[[360,640],[375,667],[390,645],[390,844],[430,932],[768,1024],[1024,768],[1440,900],[1536,864]];
 await page.route('**/api/**',r=>r.abort());
 await page.route('https://example.test/banner.png',r=>r.fulfill({contentType:'image/png',body:readFileSync('docs/references/bugan/public-v3/hero-piscina-real.png')}));
 await page.goto(origin+'/preview?scope=preview&experience=v4');
 async function visit(code,width,height,lang='pt',theme='bugan',version='v4'){
  await page.setViewportSize({width,height});await page.evaluate(()=>{localStorage.clear();sessionStorage.clear()});
  const args=new URLSearchParams({scope:code==='G'?'public':'preview',experience:version,theme,lang,closure:'1',tourism:'coherent',communications:'1',premiumCase:code});
  if(code==='G')args.set('seedFlight','1');if(code==='J')args.set('guides','draft');if(code==='K')args.set('guideEditor','1');
  const path=code==='G'?'/hotel/bugan-recife':code==='I'||code==='L'?'/preview/explorar/informacoes':code==='J'?'/preview/guias/52130000-0000-4000-8000-000000000001':'/preview';
  await page.goto(origin+path+'?'+args);await page.locator(code==='K'?'[data-guide-editor]':'h1').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,code+' '+width+' '+lang);
 }
 async function check(code,width){
  if(code==='A'){assert.equal(await page.locator('[data-v4-alerts],[data-v4-offers],[data-v4-updates],[data-home-saved-flight]:visible').count(),0);assert.equal(await page.locator('[data-editorial]').count(),3);assert.equal(await page.locator('.v3-tourism-cards>a').count(),4);}
  if(code==='B'||code==='C'){
   const strip=page.locator('[data-v4-alerts]');assert.equal(await strip.getAttribute('data-important-count'),code==='B'?'1':'3');assert.equal(await strip.locator('[data-important-notice]').count(),1);assert.equal(await strip.locator('details,.v4-important-detail').count(),0);
   assert.ok((await strip.boundingBox()).height<=(width<768?270:130),'responsive compact notice with summary');assert.ok((await strip.locator('.v4-important-copy p').innerText()).length<=220);assert.equal(await strip.getByRole('button').count(),1);
   if(code==='C')assert.equal(await page.locator('.v4-important-more').count(),1);
  }
  if(code==='D'||code==='E'){
   const card=page.locator('[data-v4-offers] article');assert.equal(await card.count(),1);if(width>=768)assert.ok((await card.boundingBox()).width<=640,'single promotion uses available width proportionally');
   assert.equal(await card.locator('img').count(),code==='D'?1:0);if(code==='D')await card.locator('img').evaluate(i=>i.decode());else assert.ok((await card.boundingBox()).height<280);
   assert.equal(await card.locator('a').getAttribute('href'),'https://example.test/offer');
  }
  if(code==='F'){assert.equal(await page.locator('[data-v4-updates] article').count(),1);assert.equal(await page.locator('[data-v4-offers],[data-v4-alerts]').count(),0);}
  if(code==='G'){const card=page.locator('[data-home-saved-flight]:visible');await card.waitFor();assert.equal(await card.count(),1);assert.ok((await card.innerText()).includes('REC'));assert.equal(await card.locator('.v4-flight-saved-indicator svg').count(),1);assert.ok((await card.boundingBox()).height<=(width<768?120:170));assert.equal(await page.locator('.v4-saved-flight').count(),0);}
  if(code==='H'){assert.equal(await page.locator('.flight-location-facts').count(),0);assert.equal(await page.locator('.flight-location-pending').count(),1);assert.equal(await page.locator('[data-flight-operational-status]').getAttribute('data-state'),'scheduled');assert.ok((await page.locator('.flight-time-facts').innerText()).includes('13:00'));assert.equal(await page.locator('[data-flight-source-updated]').count(),0);}
  if(code==='I'){
   assert.equal(await page.locator('[data-hotel-overview]').count(),1);assert.equal(await page.locator('[data-internal-editorial=about]').count(),1);assert.equal(await page.locator('[data-internal-editorial=accommodation]').count(),1);
   assert.equal(await page.locator('.public-internal-benefits li').count(),4);
   const targets=await page.locator('.public-internal-anchors a[href^="#"]').evaluateAll(a=>a.map(el=>document.getElementById(el.getAttribute('href').slice(1))!==null));assert.ok(targets.every(Boolean),'no empty anchors');
  }
  if(code==='J'){await page.locator('[data-room-guide]').getByRole('tab').nth(1).click();assert.equal(await page.locator('[data-guide-draft-preview]').count(),1);assert.equal(await page.locator('.room-guide-channels [data-guide-channel]').count(),12);assert.equal(await page.getByText('Netflix',{exact:true}).count(),1);}
 }
 for(const code of ['A','B','C','D','E','F','G','H','I','J'])for(const [width,height]of views){
  await visit(code,width,height);await check(code,width);
  for(const img of await page.locator('[data-internal-editorial] img,.room-guide-step img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}
  await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('[data-public-internal-body]')?.scrollTo(0,0)});
  if([390,1440].includes(width))await page.screenshot({path:join(output,'premium-'+code+'-'+width+'x'+height+'.png'),fullPage:!['J','H'].includes(code)});
  if(code==='B'||code==='C'){await page.locator(code==='C'?'.v4-important-more':'.v4-important-read').focus();await page.keyboard.press('Enter');await page.locator('[data-communication-directory]').waitFor();assert.equal(await page.locator('.public-communication-grid article').count(),code==='C'?3:1);assert.equal(await page.locator('.public-communication-body').first().evaluate(e=>getComputedStyle(e).overflow),'visible');}
  rows.push({case:code,width,height,lang:'pt',passed:true});
 }
 for(const lang of ['en','es'])for(const code of ['A','B','C','D','E','F','G','H','I','J'])for(const width of [390,1440]){await visit(code,width,844,lang);await check(code,width);rows.push({case:code,width,lang,passed:true});}
 for(const width of [390,1440]){
  await visit('K',width,900);await page.locator('[data-guide-editor] summary').click();await page.getByLabel('Número do registro 1',{exact:true}).fill('91');await page.getByLabel('Categoria do registro 1',{exact:true}).fill('Fixture category');
  const form=JSON.parse(await page.locator('input[name=configuration]').inputValue());assert.equal(form.channels[0].number,'91');assert.equal(form.channels[0].category,'Fixture category');assert.equal(form.applicability.scope,'unconfirmed');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.getByLabel('Número do registro 1',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:join(output,'premium-K-'+width+'.png')});rows.push({case:'K',width,passed:true});
 }
 for(const theme of ['bugan','grand-mercure','deep-ocean','novotel','mercure','default'])for(const lang of ['pt','en','es'])for(const version of ['v3','v4']){await visit('L',390,844,lang,theme,version);assert.equal(await page.locator('[data-hotel-overview]').count(),version==='v4'?1:0);rows.push({case:'L',theme,lang,version,passed:true});}
 writeFileSync(join(output,'premium-acceptance.json'),JSON.stringify({scope:'Isolated A–L fixtures, not a real administrative session or a new provider query',rows},null,2));return rows;
}
