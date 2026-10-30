import assert from 'node:assert/strict';
import {join} from 'node:path';
export async function runFlightPremium({page,output}){
 const rows=[],origin='http://127.0.0.1:4174';
 const props=[['bugan','Bugan Recife'],['grand-mercure','Grand Mercure'],['deep-ocean','Novotel Leme'],['novotel','Novotel Salvador'],['mercure','Mercure'],['default','Default']];
 for(const [theme,property]of props)for(const lang of ['pt','en','es'])for(const [width,height]of [[360,640],[375,667],[390,645],[390,844],[430,932],[1024,768],[1440,900],[1536,864]]){
  if(width===360)console.log('Flight premium '+property+' '+lang);
  await page.setViewportSize({width,height});await page.goto(origin+'/after?'+new URLSearchParams({scenario:'premium',experience:'v4',theme,lang}));
  const status=page.locator('[data-guest-flight-status][data-verified="true"]');await status.waitFor();
  assert.equal(await page.locator('[data-flight-operational-status]').innerText(),lang==='en'?'Scheduled':'Programado');
  assert.ok((await status.innerText()).includes('20:50'));assert.ok((await status.innerText()).includes('T1'));assert.ok((await status.innerText()).includes('07'));
  assert.equal(await page.locator('[data-flight-source-updated]').count(),0,'query time must not masquerade as source update');
  assert.equal(await page.locator('[data-flight-consulted]').count(),1);
  assert.ok(parseFloat(await page.locator('.flight-number').evaluate(el=>getComputedStyle(el).fontSize))>parseFloat(await page.locator('[data-flight-operational-status]').evaluate(el=>getComputedStyle(el).fontSize)));
  const refresh=page.getByRole('button',{name:await page.evaluate(()=>window.fixtureLabels.flightData.refresh),exact:true});assert.ok(await refresh.isDisabled());
  assert.equal(await page.evaluate(()=>window.fixturePayloads.length),1);
  if(width>=768){assert.equal(await page.locator('.public-bottom-dock').isVisible().catch(()=>false),false);assert.ok(await page.locator('.flight-desktop-nav').isVisible());}
  // Focus every saved-card action and verify natural scroll keeps it above navigation.
  for(const control of await page.locator('[data-saved-guest-flight] a,[data-saved-guest-flight] button:enabled').all()){
   await control.focus();await control.evaluate(el=>el.scrollIntoView({block:'center'}));const b=await control.boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=height+1);
   const dock=await page.locator('.public-bottom-dock').count()?await page.locator('.public-bottom-dock').boundingBox():null;if(dock&&width<768)assert.ok(b.y+b.height<=dock.y+1,'action hidden by dock');
  }
  const contrastFailures=await page.locator('.flight-number,.flight-status-badge,.flight-time-facts strong,.flight-location-facts dd,[data-saved-guest-flight] button:enabled,[data-saved-guest-flight] a').evaluateAll(nodes=>{
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');canvas.width=canvas.height=1;
   const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
   const lum=rgb=>rgb.slice(0,3).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
   return nodes.filter(n=>{let parent=n,bg;while(parent){bg=rgb(getComputedStyle(parent).backgroundColor);if(bg[3]===255)break;parent=parent.parentElement;}if(!parent)return false;const s=getComputedStyle(n),a=lum(rgb(s.color)),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);return ratio<(large?3:4.5);}).map(n=>n.textContent);
  });assert.deepEqual(contrastFailures,[],theme+' essential contrast');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(theme==='bugan'&&lang==='pt'&&[390,1440,1536].includes(width)){
   await page.screenshot({path:join(output,'premium-actions-'+width+'x'+height+'.png')});await page.locator('.flight-verified-summary').evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:join(output,'premium-details-'+width+'x'+height+'.png')});await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);document.querySelector('[data-public-internal-body]').scrollTop=0;});await page.screenshot({path:join(output,'premium-'+width+'x'+height+'.png')});if(width>=1440)await page.screenshot({path:join(output,'premium-full-'+width+'.png'),fullPage:true});
  }
  assert.equal(await page.locator('[data-flight-service-list] li').count(),3,'disabled breakfast remains absent');
  for(const tab of ['partidas','chegadas']){
   const href=await page.locator('[data-flight-tabs] a[href*="tab='+tab+'"]').getAttribute('href');assert.ok(href.includes('lang='+lang)||lang==='pt');await page.goto(origin+href);await page.locator('h1').waitFor();assert.equal(await page.locator('[data-flight-tabs] a[aria-current="page"]').getAttribute('href'),href);assert.equal(await page.locator('form').count(),0);assert.equal(await page.locator('a[href="https://www.riogaleao.com/"]').count(),1);assert.equal(await page.evaluate(()=>window.fixturePayloads.length),0,'airport tabs never fetch provider');
  }
  rows.push({theme,lang,width,height,passed:true,source:'stored real LA3565 schedule replay, not a new provider query'});
 }
 await page.setViewportSize({width:390,height:645});
 await page.clock.setSystemTime(new Date('2026-10-29T23:17:11Z'));await page.goto(origin+'/after?scenario=premium&experience=v4&theme=bugan&lang=pt&status=live');
 await page.locator('[data-guest-flight-status][data-verified="true"]').waitFor();assert.equal(await page.locator('[data-flight-operational-status]').innerText(),'Em voo');assert.equal(await page.locator('[data-flight-source-updated]').count(),1);assert.equal(await page.locator('.flight-time-facts>div').count(),3,'estimated and actual remain separate');
 await page.screenshot({path:join(output,'premium-real-ad4277-replay.png')});
 await page.clock.setSystemTime(new Date('2026-10-29T23:40:45Z'));
 for(const error of ['not_found','budget_unavailable','rate_limited','timeout']){
  await page.goto(origin+'/after?scenario=premium&experience=v4&theme=bugan&lang=pt&status='+error);await page.waitForFunction(()=>document.querySelector('[data-guest-flight-status]')?.getAttribute('aria-busy')==='false');assert.equal(await page.locator('[data-guest-flight-status]').getAttribute('data-verified'),'false');assert.equal(await page.locator('[data-flight-operational-status]').count(),0);
  rows.push({error,passed:true});
 }
 // One explicit refresh after cooldown; advancing time alone never triggers polling.
 await page.goto(origin+'/after?scenario=premium&experience=v4&theme=bugan&lang=pt');await page.locator('[data-guest-flight-status][data-verified="true"]').waitFor();await page.clock.fastForward(61000);assert.equal(await page.evaluate(()=>window.fixturePayloads.length),1);await page.getByRole('button',{name:'Atualizar status',exact:true}).click();await page.waitForFunction(()=>window.fixturePayloads.length===2);
 return rows;
}
