import assert from 'node:assert/strict';
import {join} from 'node:path';
// Shared rendered pages, no real API/session/provider. Invoked by tourism-v4.mjs --languages.
export async function checkLanguageMenu(page,language){
 const trigger=page.locator('.hotel-theme-language-trigger').first(),popup=page.locator('.hotel-theme-language-menu');
 await trigger.scrollIntoViewIfNeeded();
 const before=await trigger.boundingBox();await trigger.click();await popup.waitFor();assert.equal(await trigger.getAttribute('aria-expanded'),'true');assert.equal(await trigger.getAttribute('aria-haspopup'),'menu');assert.equal(await trigger.getAttribute('aria-controls'),await popup.getAttribute('id'));
 await page.waitForFunction(()=>{const p=document.querySelector('.hotel-theme-language-menu');const b=p?.getBoundingClientRect();return b&&b.width>0&&b.x>=0&&b.y>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1;},undefined,{timeout:5000}).catch(async error=>{console.error(await popup.evaluate(el=>{const b=el.getBoundingClientRect(),s=getComputedStyle(el);return {popup:{x:b.x,y:b.y,width:b.width,height:b.height},availableWidth:s.getPropertyValue('--available-width'),availableHeight:s.getPropertyValue('--available-height'),zoom:getComputedStyle(document.documentElement).zoom,viewport:{width:innerWidth,height:innerHeight},positioner:el.parentElement.getAttribute('style')};}));await page.screenshot({path:'out/language-switcher/collision-failed.png'});throw error;});
 assert.equal(await popup.getByRole('menuitem').count(),3);assert.equal(await popup.locator('[aria-current="page"]').getAttribute('data-analytics-language'),language);
 for(const [code,label]of [['pt','Português'],['en','English'],['es','Español']]){
  const item=popup.locator('[data-analytics-language="'+code+'"]');assert.ok((await item.innerText()).includes(label));assert.ok(new URL(await item.getAttribute('href'),'https://example.test').searchParams.get('lang')===code);
  assert.equal(await item.evaluate(el=>{const b=el.getBoundingClientRect();return b.height>=44&&[.15,.5,.85].every(x=>el.contains(document.elementFromPoint(b.x+b.width*x,b.y+b.height/2)));}),true,'option clipped or obscured: '+code);
 }
 assert.deepEqual(await trigger.boundingBox(),before,'opening must not move trigger/layout');
 assert.equal(await popup.evaluate(el=>el.closest('header')===null),true,'popup must escape clipping header');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 return {trigger,popup};
}
export async function runPublicLanguageSwitcher({page,origin,output}){
 const rows=[],properties=[['bugan','bugan'],['grand-mercure','grand-mercure'],['novotel-leme','deep-ocean'],['novotel-salvador','novotel'],['mercure','mercure'],['default','default']];
 const paths=['/preview','/preview/explorar/voos','/preview/explorar/servicos','/preview/explorar/turismo','/preview/explorar/contato','/preview/explorar/informacoes','/preview/servicos/service-0','/preview/explorar/turismo/praia-de-boa-viagem'];
 const viewports=[[360,640],[375,667],[390,645],[390,844],[430,932],[1024,768],[1440,900],[1536,864]];
 async function visit(path,property,theme,lang='pt'){await page.goto(origin+path+'?'+new URLSearchParams({scope:'preview',experience:'v4',tourism:'coherent',closure:'true',property,theme,lang}));await page.locator('.hotel-theme-language-trigger').first().waitFor();assert.equal(await page.locator('h1').first().innerText()==='404 fixture',false);}
 if(!process.argv.includes('--interactions-only'))for(const [property,theme]of properties)for(const lang of ['pt','en','es'])for(const [width,height]of viewports)for(const path of paths){
  if(width===360&&path==='/preview')console.log('Language menu matrix '+property+' '+lang);
  await page.setViewportSize({width,height});await visit(path,property,theme,lang);const {popup}=await checkLanguageMenu(page,lang);
  if(property==='bugan'&&lang==='pt'&&path.includes('voos')&&[390,1440,1536].includes(width))await page.screenshot({path:join(output,'language-open-'+width+'x'+height+'.png')});
  await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});assert.equal(await page.locator('.hotel-theme-language-trigger').first().getAttribute('aria-expanded'),'false');rows.push({property,theme,lang,width,height,path,passed:true});
 }
 // Keyboard, outside dismissal, native links, selected state and language continuity.
 if(!process.argv.includes('--edges-only'))for(const [property,theme]of properties)for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await visit('/preview/explorar/voos',property,theme);
  const trigger=page.locator('.hotel-theme-language-trigger').first();await trigger.focus();await page.keyboard.press('Enter');await page.getByRole('menu').waitFor();await page.waitForTimeout(100);await page.keyboard.press('End');await page.waitForTimeout(50);await page.waitForFunction(()=>document.activeElement?.getAttribute('data-analytics-language')==='es');assert.equal(await page.locator('[data-analytics-language=es]').evaluate(el=>el===document.activeElement),true);assert.equal(await page.locator('[data-analytics-language=es]').evaluate(el=>getComputedStyle(el).outlineStyle!=='none'||getComputedStyle(el).boxShadow!=='none'),true);
  await page.keyboard.press('Home');await page.waitForFunction(()=>document.activeElement?.getAttribute('data-analytics-language')==='pt');assert.equal(await page.locator('[data-analytics-language=pt]').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.activeElement?.getAttribute('data-analytics-language')==='en');await page.keyboard.press('Enter');await page.waitForURL(/lang=en/);assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  await checkLanguageMenu(page,'en');await page.locator('[data-analytics-language=es]').click();await page.waitForURL(/lang=es/);assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  // Some existing fallback presets expose internal navigation through Home only.
  let services=page.locator('a[href*="/explorar/servicos"]:visible').first();
  if(!await services.count()){await page.locator('a[href^="/preview?"]:visible').first().click();await page.waitForURL(/\/preview\?lang=es/);services=page.locator('a[href*="/explorar/servicos"]:visible').first();}
  await services.click();await page.waitForURL(/explorar\/servicos.*lang=es/);await checkLanguageMenu(page,'es');await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  await checkLanguageMenu(page,'es');await page.locator('h1').first().click();assert.equal(await trigger.getAttribute('aria-expanded'),'false');rows.push({property,width,keyboardAndNavigation:true,passed:true});
 }
 // Browser zoom simulation: CSS viewport reflow + DPR, matching a 1440x900 screen at 200%.
 const cdp=await page.context().newCDPSession(page);
 for(const [property,theme]of properties)for(const zoom of [1,2])for(const corner of ['top-left','bottom-right']){
  console.log('Language corner '+property+' '+zoom+' '+corner);await cdp.send('Emulation.clearDeviceMetricsOverride');await page.setViewportSize({width:zoom===2?1440:430,height:zoom===2?900:932});if(zoom===2)await cdp.send('Emulation.setDeviceMetricsOverride',{width:720,height:450,deviceScaleFactor:2,mobile:false,screenWidth:1440,screenHeight:900});await visit('/preview/explorar/voos',property,theme);await page.evaluate(({zoom,corner})=>{void zoom;const t=document.querySelector('.hotel-theme-language-trigger'),w=t.parentElement;t.closest('[data-hotel-theme]').appendChild(w);Object.assign(w.style,{position:'fixed',zIndex:'101',...(corner==='top-left'?{top:'4px',left:'4px'}:{bottom:'4px',right:'4px'})});},{zoom,corner});
  const {popup}=await checkLanguageMenu(page,'pt');await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});rows.push({property,zoom,corner,passed:true});
 }
 await cdp.send('Emulation.clearDeviceMetricsOverride');await cdp.detach();
 return rows;
}
