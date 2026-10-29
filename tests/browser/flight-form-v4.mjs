import assert from 'node:assert/strict';
import {join} from 'node:path';
export async function runFlightForm({page,output}){
 const rows=[];
 for(const theme of ['bugan','grand-mercure','deep-ocean','novotel','mercure','default'])for(const lang of ['pt','en','es'])for(const [width,height]of [[360,640],[375,667],[390,645],[390,844],[430,932],[1024,768],[1440,900]]){
  if(width===360)console.log(`Public flight form ${theme} ${lang}`);
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:4174/after?'+new URLSearchParams({scenario:'form',theme,lang,experience:'v4'}));
  await page.locator('#guest-flight-flightNumber').waitFor();const labels=await page.evaluate(()=>window.fixtureLabels);
  const visible=async locator=>{
   await locator.focus();await locator.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));const box=await locator.boundingBox();assert.ok(box);
   const dockTop=await page.locator('nav').evaluateAll(nodes=>Math.min(innerHeight,...nodes.map(n=>({r:n.getBoundingClientRect(),s:getComputedStyle(n),n})).filter(({r,s,n})=>r.height>0&&r.height<180&&Math.abs(r.bottom-innerHeight)<3&&(s.position==='fixed'||n.classList.contains('public-bottom-dock'))).map(({r})=>r.top)));
   assert.ok(box.y+box.height<=dockTop+1,`${theme} ${width} field hidden by dock`);assert.ok(box.y>=0);
  };
  if(theme==='bugan'&&width<768){const body=page.locator('[data-public-internal-body]');assert.equal(await body.evaluate(el=>getComputedStyle(el).overflowY),'auto');assert.ok(await body.evaluate(el=>el.scrollHeight>el.clientHeight));}
  await page.locator('button[type="submit"]').click();assert.ok(await page.locator('[aria-invalid="true"]').count());
  const values={airline:'LA',flightNumber:'3530',departureAirport:'REC',arrivalAirport:'GRU',departureDate:'2026-09-09',scheduledDepartureTime:'19:15'};
  for(const [key,value]of Object.entries(values)){const field=page.locator('#guest-flight-'+key);await visible(field);await field.fill(value);}
  if(theme==='bugan'&&width===390&&height===645){
   // Simulate a browser keyboard that reduces visualViewport but not innerHeight.
   await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{value:320,configurable:true});window.visualViewport.dispatchEvent(new Event('resize'));});
   for(const [key,value]of Object.entries(values)){const field=page.locator('#guest-flight-'+key);await visible(field);await field.fill(value);}
   await page.screenshot({path:join(output,`form-keyboard-${lang}.png`)});
   await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{value:645,configurable:true});window.visualViewport.dispatchEvent(new Event('resize'));});
  }
  const submit=page.locator('button[type="submit"]');await visible(submit);await submit.click();await page.locator('[data-saved-guest-flight]').waitFor();await page.locator('[data-guest-flight-status][data-verified="true"]').waitFor();
  const requests=await page.evaluate(()=>window.fixturePayloads);assert.equal(requests.length,1);assert.equal(requests[0].scheduledDepartureAt,'2026-09-09T19:15:00-03:00');assert.ok(!JSON.stringify(requests).includes('roomToken'));
  const saved=await page.evaluate(()=>Object.values(localStorage).map(v=>{try{return JSON.parse(v)}catch{return null}}).find(v=>v?.version===1));assert.equal(saved.flightNumber,'3530');assert.ok(!('status' in saved));assert.ok(!('gate' in saved));
  await page.getByRole('button',{name:labels.editFlight,exact:true}).click();assert.equal(await page.locator('#guest-flight-flightNumber').inputValue(),'3530');await page.locator('#guest-flight-flightNumber').fill('3531');await visible(page.locator('button[type="submit"]'));await page.locator('button[type="submit"]').click();await page.waitForFunction(()=>window.fixturePayloads.length===2);
  await page.getByRole('button',{name:labels.removeFlight,exact:true}).click();await page.locator('#guest-flight-flightNumber').waitFor();assert.equal(await page.locator('#guest-flight-flightNumber').inputValue(),'');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);rows.push({theme,lang,width,height,saveEditRemove:true,passed:true});
 }
 for(const scenario of ['matched','budget_unavailable','not_found','quota_exhausted','timeout','storage_error']){
  await page.setViewportSize({width:390,height:645});await page.goto('http://127.0.0.1:4174/after?'+new URLSearchParams({scenario:'form',theme:'bugan',lang:'pt',experience:'v4',status:scenario==='storage_error'?'matched':scenario}));await page.locator('#guest-flight-flightNumber').waitFor();
  const values={airline:'AZU',flightNumber:'AZU4277',departureAirport:'REC',arrivalAirport:'CGH',departureDate:'2026-09-09',scheduledDepartureTime:'19:15'};
  for(const [k,v]of Object.entries(values))await page.locator('#guest-flight-'+k).fill(v);
  if(scenario==='storage_error')await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('Synthetic storage failure')};});
  await page.locator('button[type="submit"]').evaluate(el=>el.scrollIntoView({block:'center'}));await page.locator('button[type="submit"]').click();
  if(scenario==='storage_error'){await page.locator('[role="alert"]').waitFor();assert.equal(await page.locator('form').count(),1);assert.equal(await page.evaluate(()=>window.fixturePayloads.length),0);}
  else{
   await page.locator('[data-saved-guest-flight]').waitFor();await page.waitForFunction(()=>document.querySelector('[data-guest-flight-status]')?.getAttribute('aria-busy')==='false');
   assert.equal(await page.evaluate(()=>window.fixturePayloads[0].flight_iata),'AD4277');
   const saved=await page.evaluate(()=>Object.values(localStorage).map(v=>{try{return JSON.parse(v)}catch{return null}}).find(v=>v?.version===1));assert.equal(saved.airlineCode,'AZU');assert.equal(saved.flightNumber,'AZU4277');
   assert.equal(await page.locator('[data-guest-flight-status]').getAttribute('data-verified'),String(scenario==='matched'));
   if(scenario==='budget_unavailable')assert.ok((await page.locator('[data-guest-flight-status]').innerText()).includes('Não foi possível atualizar'));
   const official=page.locator('a[href="https://apps.voeazul.com.br/FlightStatus/aspx/Main.aspx"]');assert.equal(await official.count(),1);
   if(scenario==='matched'){
    const refreshLabel=await page.evaluate(()=>window.fixtureLabels.flightData.refresh),refresh=page.getByRole('button',{name:refreshLabel,exact:true});await page.clock.fastForward(61000);assert.equal(await page.evaluate(()=>window.fixturePayloads.length),1);
    await refresh.click();await page.waitForFunction(()=>window.fixturePayloads.length===2);
   }
  }
  rows.push({scenario,width:390,height:645,canonicalAzul:true,passed:true});
 }
 return rows;
}
