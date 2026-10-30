// Real deployed UI, isolated storage, replayed captured responses. Zero provider spend.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const replay=JSON.parse(readFileSync('tests/security/fixtures/airlabs-la3565-cache-replay.json','utf8'));
const logoMode=process.argv.includes('--logos');
const output=logoMode?'out/airline-logos-production':'out/flight-premium-production';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.V3_BROWSER_CHANNEL??'msedge'});
const rows=[],errors=[];let intercepted=0;
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-29T23:40:45Z')});
 await page.route('**/*',r=>{const q=r.request(),u=new URL(q.url());return q.method()==='GET'&&['buganrecife.libguest.digital','libguest.digital','micuekfznunwwofxnovw.supabase.co'].includes(u.hostname)&&!u.pathname.startsWith('/api/')?r.continue():r.abort();});
 await page.route('**/api/flights/status',r=>{const q=r.request().postDataJSON();assert.equal(q.departureAirport,'REC');intercepted++;
  if(logoMode&&q.flight_iata!=='LA3565'){if(q.flight_iata==='AD4277'){const live=JSON.parse(readFileSync('tests/security/fixtures/airlabs-restored-ad4277.json','utf8'));return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(live.response)});}return r.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false,error:'not_found'})});}
  assert.equal(q.flight_iata,'LA3565');assert.equal(q.arrivalAirport,'BSB');return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(replay.response)});});
 for(const [width,height,lang]of [[360,640,'pt'],[390,645,'pt'],[430,932,'pt'],[1024,768,'pt'],[1440,900,'pt'],[1536,864,'pt'],[390,645,'en'],[390,645,'es']]){
  const labels=lang==='en'?{edit:'Edit flight',cancel:'Cancel',remove:'Remove flight'}:lang==='es'?{edit:'Editar vuelo',cancel:'Cancelar',remove:'Eliminar vuelo'}:{edit:'Editar voo',cancel:'Cancelar',remove:'Remover voo'};
  await page.setViewportSize({width,height});await page.goto('https://buganrecife.libguest.digital/explorar/voos?tab=meu-voo&lang='+lang);await page.locator('#guest-flight-flightNumber').waitFor();
  assert.equal(await page.locator('[data-flight-premium]').count(),1);
  for(const [key,value]of Object.entries({airline:'TAM',flightNumber:'3565',departureAirport:'REC',arrivalAirport:'BSB',departureDate:'2026-10-29',scheduledDepartureTime:'20:50'}))await page.locator('#guest-flight-'+key).fill(value);
  await page.locator('button[type="submit"]').evaluate(el=>el.scrollIntoView({block:'center'}));await page.locator('button[type="submit"]').click();
  await page.locator('[data-guest-flight-status][data-verified="true"]').waitFor();assert.equal(await page.locator('[data-flight-operational-status]').innerText(),lang==='en'?'Scheduled':'Programado');assert.equal(await page.locator('[data-flight-source-updated]').count(),0);if(logoMode){await page.locator('[data-airline-mark="LA"] img').waitFor();assert.equal(await page.locator('[data-airline-mark="LA"] img').getAttribute('alt'),'LATAM');await page.waitForFunction(()=>document.querySelector('[data-airline-mark] img')?.naturalWidth>0);}
  assert.ok((await page.locator('.flight-location-facts').innerText()).includes('07'));assert.ok((await page.locator('.flight-number').innerText()).includes('LA 3565'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('.public-bottom-dock').isVisible(),width<768);
  if(lang==='pt'&&[390,1440,1536].includes(width)){
   await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);document.querySelector('[data-public-internal-body]').scrollTop=0;});await page.screenshot({path:output+'/top-'+width+'.png'});
   await page.locator('.flight-verified-summary').evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:output+'/details-'+width+'.png'});
  }
  await page.getByRole('button',{name:labels.edit,exact:true}).click();assert.equal(await page.locator('#guest-flight-airline').inputValue(),'TAM');await page.getByRole('button',{name:labels.cancel,exact:true}).click();await page.getByRole('button',{name:labels.remove,exact:true}).click();await page.locator('#guest-flight-flightNumber').waitFor();
  for(const tab of ['partidas','chegadas']){await page.locator('[data-flight-tabs] a[href*="tab='+tab+'"]').click();await page.locator('[data-flight-tabs] a[aria-current="page"]').waitFor();assert.ok((await page.locator('[data-flight-tabs] a[aria-current="page"]').getAttribute('href')).includes('tab='+tab));assert.equal(await page.locator('[data-guest-flight-form]').count(),0);}
  await page.locator('.public-area-hero a[href^="/?"]').or(page.locator('.public-area-hero a[href="/"]')).first().click();await page.locator('h1').waitFor();assert.equal(await page.locator('h1').innerText(),'Bugan Recife');
  rows.push({width,height,lang,passed:true});
 }
 if(logoMode){
  await page.setViewportSize({width:390,height:844});
  for(const [airline,number,code]of [['Azul','4277','AD'],['GOL','1888','G3'],['TAP','1888','fallback'],['XX','1888','fallback'],['LAT','1888','fallback']]){
   await page.goto('https://buganrecife.libguest.digital/explorar/voos?lang=pt');await page.locator('#guest-flight-flightNumber').waitFor();
   for(const [key,value]of Object.entries({airline,flightNumber:number,departureAirport:'REC',arrivalAirport:'CGH',departureDate:'2026-10-29',scheduledDepartureTime:'16:40'}))await page.locator('#guest-flight-'+key).fill(value);
   await page.locator('button[type="submit"]').click();await page.locator('[data-airline-mark="'+code+'"]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-guest-flight-status]')?.getAttribute('aria-busy')==='false');
   if(code!=='fallback')await page.waitForFunction(()=>document.querySelector('[data-airline-mark] img')?.naturalWidth>0);
   await page.screenshot({path:output+'/logo-'+code+'-'+airline+'.png'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(code==='AD')assert.ok((await page.locator('.flight-time-facts').innerText()).includes('17:20'));
   await page.getByRole('button',{name:'Remover voo',exact:true}).click();rows.push({airline,logo:code,passed:true});
  }
  await page.route('**/brand/airlines/latam.png',r=>r.abort());await page.goto('https://buganrecife.libguest.digital/explorar/voos?lang=pt');await page.locator('#guest-flight-flightNumber').waitFor();
  for(const [key,value]of Object.entries({airline:'LA',flightNumber:'3565',departureAirport:'REC',arrivalAirport:'BSB',departureDate:'2026-10-29',scheduledDepartureTime:'20:50'}))await page.locator('#guest-flight-'+key).fill(value);
  await page.locator('button[type="submit"]').click();await page.locator('[data-airline-mark="fallback"]').waitFor();await page.locator('[data-guest-flight-status][data-verified="true"]').waitFor();await page.screenshot({path:output+'/failed-image.png'});assert.ok((await page.locator('.flight-location-facts').innerText()).includes('07'));rows.push({failedImage:true,dataPreserved:true,passed:true});
 }
 assert.deepEqual(errors,[]);writeFileSync(output+'/report.json',JSON.stringify({scope:'actual production UI with intercepted real response replay; not a new provider verification',rows,errors,interceptedStatusRequests:intercepted,providerRequests:0},null,2));console.log(JSON.stringify({passed:rows.length,total:rows.length,providerRequests:0}));
}finally{await browser.close();}
