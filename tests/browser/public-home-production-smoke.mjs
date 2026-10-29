// Anonymous smoke. Form state is device-local; status POST is intercepted, never sent.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const baseline=process.argv.includes('--baseline'),phase=baseline?'before':'after',output=resolve('out/hotfix-public-home');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.V3_BROWSER_CHANNEL??'msedge'}),rows=[];
try{
 const page=await browser.newPage();
 await page.route('**/*',r=>{const q=r.request(),u=new URL(q.url());return q.method()==='GET'&&['buganrecife.libguest.digital','libguest.digital','micuekfznunwwofxnovw.supabase.co'].includes(u.hostname)&&!u.pathname.startsWith('/api/')?r.continue():r.abort();});
 for(const [name,url]of [['subdomain','https://buganrecife.libguest.digital/'],['slug','https://libguest.digital/hotel/bugan-recife']])for(const [width,height]of baseline?[[390,645],[1440,900]]:[[360,640],[390,645],[430,932],[1440,900],[1536,864]]){
  await page.setViewportSize({width,height});const response=await page.goto(url);await page.locator('h1').waitFor();
  const row={name,url,width,height,status:response.status(),h1:await page.locator('h1').innerText(),v4:await page.locator('[data-public-experience="v4"]').count()===1,benefits:await page.locator('.v3-amenities>div').count(),cards:await page.locator('.v3-tourism-cards>a').count(),images:await page.locator('.v3-tourism-cards img').count(),editorials:await page.locator('[data-editorial]').count(),essentialsVisible:await page.locator('[data-public-v4-mobile]').isVisible().catch(()=>false)};
  if(!baseline){assert.equal(row.h1,'Bugan Recife');assert.ok(row.v4);assert.equal(row.benefits,4);assert.equal(row.cards,4);assert.equal(row.images,4);assert.equal(row.editorials,3);assert.equal(row.essentialsVisible,width<768);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  if(await page.locator('[data-v3-tourism]').count())await page.locator('[data-v3-tourism]').scrollIntoViewIfNeeded();
  if(!baseline){
   for(const img of await page.locator('.v3-tourism-cards img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());assert.ok(await img.evaluate(el=>el.naturalWidth>0));}
   row.destinations=await page.locator('.v3-tourism-cards>a').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('href')));
   assert.ok(row.destinations[0].includes('/praia-de-boa-viagem'));for(const [i,key]of ['recife-antigo','visitas-culturais','cultura-local'].entries())assert.ok(row.destinations[i+1].includes(key));
  }
  await page.evaluate(()=>{window.scrollTo(0,0);const cards=document.querySelector('.v3-tourism-cards');if(cards)cards.scrollLeft=0;});
  await page.screenshot({path:join(output,`${phase}-${name}-${width}.png`),fullPage:true});rows.push(row);
 }
 if(!baseline){
  // Test the actual deployed form; intercept status so this never spends provider credit.
  const payloads=[];await page.route('**/api/flights/status',r=>{payloads.push(r.request().postDataJSON());return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'budget_unavailable'})});});
  for(const [width,height]of [[360,640],[390,645],[430,932]]){
   await page.setViewportSize({width,height});await page.goto('https://buganrecife.libguest.digital/explorar/voos?tab=meu-voo');await page.locator('#guest-flight-flightNumber').waitFor();
   const fields={airline:'AZU',flightNumber:'AZU4277',departureAirport:'REC',arrivalAirport:'CGH',departureDate:'2026-10-29',scheduledDepartureTime:'16:40'};
   for(const [key,value]of Object.entries(fields)){const field=page.locator('#guest-flight-'+key);await field.fill(value);}
   const submit=page.locator('button[type="submit"]');await submit.evaluate(el=>el.scrollIntoView({block:'center'}));const box=await submit.boundingBox(),dock=await page.locator('.public-bottom-dock').boundingBox();assert.ok(box.y+box.height<=dock.y+1);await submit.click();await page.locator('[data-saved-guest-flight]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-guest-flight-status]')?.getAttribute('aria-busy')==='false');assert.equal(payloads.at(-1).flight_iata,'AD4277');assert.equal(await page.locator('[data-guest-flight-status]').getAttribute('data-verified'),'false');
   await page.screenshot({path:join(output,`after-public-form-${width}.png`)});await page.getByRole('button',{name:'Editar voo',exact:true}).click();assert.equal(await page.locator('#guest-flight-flightNumber').inputValue(),'AZU4277');await page.getByRole('button',{name:'Cancelar',exact:true}).click();await page.getByRole('button',{name:'Remover voo',exact:true}).click();await page.locator('#guest-flight-flightNumber').waitFor();rows.push({name:'actual production form with intercepted status',width,height,passed:true,providerRequests:0});
  }
 }
 writeFileSync(join(output,`${phase}.json`),JSON.stringify(rows,null,2));console.log(JSON.stringify({phase,rows}));
}finally{await browser.close();}
