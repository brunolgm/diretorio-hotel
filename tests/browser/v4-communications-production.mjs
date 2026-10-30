// Anonymous deployed UI. Only local browser form/storage writes; every provider/API request is intercepted.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const output='out/v4-communications-production';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.V3_BROWSER_CHANNEL??'msedge'}),rows=[],errors=[];
let intercepted=0;
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const q=r.request(),u=new URL(q.url());return q.method()==='GET'&&!u.pathname.startsWith('/api/')&&(u.hostname==='libguest.digital'||u.hostname.endsWith('.libguest.digital')||u.hostname==='micuekfznunwwofxnovw.supabase.co')?r.continue():r.abort();});
 await page.route('**/api/flights/status',r=>{intercepted++;return r.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false,error:'not_found'})});});
 const origin='https://buganrecife.libguest.digital',views=[[360,640],[375,667],[390,645],[390,844],[430,932],[768,1024],[1440,900],[1536,864]];
 for(const lang of ['pt','en','es']){
  const labels=lang==='en'?{edit:'Edit flight',cancel:'Cancel',remove:'Remove flight'}:lang==='es'?{edit:'Editar vuelo',cancel:'Cancelar',remove:'Eliminar vuelo'}:{edit:'Editar voo',cancel:'Cancelar',remove:'Remover voo'};
  await page.setViewportSize({width:390,height:844});await page.goto(origin+'/explorar/voos?tab=meu-voo&lang='+lang);await page.locator('#guest-flight-flightNumber').waitFor();
  const date=await page.evaluate(()=>{const d=new Date(Date.now()+86400000);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');});
  for(const [key,value]of Object.entries({airline:'AD',flightNumber:'4277',departureAirport:'REC',arrivalAirport:'CGH',departureDate:date,scheduledDepartureTime:'16:40'}))await page.locator('#guest-flight-'+key).fill(value);
  await page.locator('button[type=submit]').click();await page.locator('[data-saved-guest-flight]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-guest-flight-status]')?.getAttribute('aria-busy')==='false');
  const prior=intercepted;
  for(const [width,height]of views){
   await page.setViewportSize({width,height});assert.equal((await page.goto(origin+'/?lang='+lang)).status(),200);const card=page.locator('[data-home-saved-flight]');await card.waitFor();assert.ok((await card.innerText()).includes('AD 4277'));assert.equal(new URL(await card.locator('a').getAttribute('href'),origin).searchParams.get('lang')??'pt',lang);const overflow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,position:getComputedStyle(e).position}))}));assert.equal(overflow.scrollWidth<=width,true,JSON.stringify({lang,width,height,...overflow}));assert.equal(intercepted,prior,'Home must never request provider status');assert.equal(await page.locator('[data-editorial]').count(),3);assert.equal(await page.locator('.v3-tourism-cards>a').count(),4);if(lang==='pt'&&[390,1440].includes(width))await page.screenshot({path:output+'/home-'+width+'x'+height+'.png',fullPage:true});rows.push({lang,width,height,savedFlight:true,homeProviderRequests:0,passed:true});
  }
  // A separate origin has its own canonical browser storage, even for the same hotel.
  await page.goto('https://libguest.digital/hotel/bugan-recife?lang='+lang);await page.locator('h1').waitFor();assert.equal(await page.locator('[data-home-saved-flight]').count(),0);
  await page.goto(origin+'/?lang='+lang);await page.locator('[data-home-saved-flight] a').click();await page.locator('[data-saved-guest-flight]').waitFor();await page.getByRole('button',{name:labels.edit,exact:true}).click();await page.locator('#guest-flight-flightNumber').fill('1234');await page.locator('button[type=submit]').click();await page.locator('[data-saved-guest-flight]').waitFor();await page.goto(origin+'/?lang='+lang);await page.locator('[data-home-saved-flight]').waitFor();assert.ok((await page.locator('[data-home-saved-flight]').innerText()).includes('AD 1234'));
  await page.locator('[data-home-saved-flight] a').click();await page.getByRole('button',{name:labels.remove,exact:true}).click();await page.locator('#guest-flight-flightNumber').waitFor();await page.goto(origin+'/?lang='+lang);await page.locator('h1').waitFor();assert.equal(await page.locator('[data-home-saved-flight]').count(),0);rows.push({lang,realFormSaveEditRemove:true,originIsolation:true,passed:true});
 }
 for(const host of ['grandmercureriocopacabana','novotelrioleme','novotelrv','mercurerioboutiquecopacabana'])for(const lang of ['pt','en','es']){
  await page.setViewportSize({width:390,height:844});const response=await page.goto('https://'+host+'.libguest.digital/?lang='+lang);assert.equal(response.status(),200);await page.locator('h1').first().waitFor();assert.equal(await page.locator('[data-home-saved-flight]').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);rows.push({host,lang,otherHotelPreserved:true,passed:true});
 }
 const rejected=await page.request.post('https://libguest.digital/api/admin/service-guides',{data:{operation:'prepare'}});assert.equal(rejected.status(),401);
 assert.deepEqual(errors,[]);writeFileSync(output+'/report.json',JSON.stringify({rows,errors,interceptedStatusRequests:intercepted,realProviderRequests:0},null,2));console.log(JSON.stringify({passed:rows.length,realProviderRequests:0,errors}));
}finally{await browser.close();}
