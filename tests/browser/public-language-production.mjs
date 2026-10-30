// Public deployed UI only. No credentials, storage seed, database writes or provider requests.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {checkLanguageMenu} from './public-language-switcher.mjs';
const output='out/language-switcher/production';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.V3_BROWSER_CHANNEL??'msedge'});
const rows=[],errors=[];let statusRequests=0;
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(u.pathname==='/api/flights/status')statusRequests++;return q.method()==='GET'&&!u.pathname.startsWith('/api/')&&(u.hostname.endsWith('.libguest.digital')||u.hostname==='libguest.digital'||u.hostname==='micuekfznunwwofxnovw.supabase.co')?r.continue():r.abort();});
 const origin='https://buganrecife.libguest.digital';
 await page.goto(origin+'/explorar/servicos');const detail=await page.locator('a[href*="/servicos/"]').first().getAttribute('href');assert.ok(detail);
 const paths=['/','/explorar/voos','/explorar/servicos','/explorar/turismo','/explorar/contato','/explorar/informacoes',detail,'/explorar/turismo/praia-de-boa-viagem'];
 for(const path of paths)for(const lang of ['pt','en','es'])for(const [width,height]of path==='/explorar/voos'?[[360,640],[375,667],[390,645],[390,844],[430,932],[1024,768],[1440,900],[1536,864]]:[[390,844],[1440,900]]){
  await page.setViewportSize({width,height});const url=new URL(path,origin);url.searchParams.set('lang',lang);const response=await page.goto(url.href);assert.equal(response.status(),200);
  const {trigger,popup}=await checkLanguageMenu(page,lang);
  if(path==='/explorar/voos'&&lang==='pt'&&[390,1440,1536].includes(width))await page.screenshot({path:join(output,'open-'+width+'x'+height+'.png')});
  await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  rows.push({page:path.startsWith('/servicos/')?'service detail':path,lang,width,height,passed:true});
 }
 for(const host of ['grandmercureriocopacabana','novotelrioleme','novotelrv','mercurerioboutiquecopacabana'])for(const lang of ['pt','en','es'])for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});const response=await page.goto('https://'+host+'.libguest.digital/?lang='+lang);assert.equal(response.status(),200);const {popup}=await checkLanguageMenu(page,lang);await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});rows.push({hotel:host,lang,width,passed:true});
 }
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await page.goto(origin+'/explorar/voos?lang=pt');const trigger=page.locator('.hotel-theme-language-trigger').first();await trigger.focus();await page.keyboard.press('Enter');await page.getByRole('menu').waitFor();await page.waitForTimeout(100);await page.keyboard.press('End');await page.waitForTimeout(50);await page.waitForFunction(()=>document.activeElement?.getAttribute('data-analytics-language')==='es');assert.equal(await page.locator('[data-analytics-language=es]').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');await page.waitForURL(/lang=es/);assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  await page.locator('a[href*="/explorar/servicos"]:visible').first().click();await page.waitForURL(/explorar\/servicos.*lang=es/);await checkLanguageMenu(page,'es');await page.locator('h1').first().click();assert.equal(await trigger.getAttribute('aria-expanded'),'false');for(const [before,selected]of [['es','en'],['en','pt']]){await checkLanguageMenu(page,before);await page.locator('[data-analytics-language='+selected+']').click();await page.waitForURL(new RegExp('lang='+selected));assert.equal(await trigger.getAttribute('aria-expanded'),'false');}await checkLanguageMenu(page,'pt');await page.keyboard.press('Escape');rows.push({width,keyboardAndNavigation:true,allThreeSelected:true,passed:true});
 }
 assert.deepEqual(errors,[]);assert.equal(statusRequests,0);writeFileSync(join(output,'report.json'),JSON.stringify({rows,errors,statusRequests,providerRequests:0},null,2));console.log(JSON.stringify({passed:rows.length,total:rows.length,providerRequests:0,statusRequests}));
}finally{await browser.close();}
