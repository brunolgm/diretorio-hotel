import assert from 'node:assert/strict';
import {join} from 'node:path';
// Invoked by the existing isolated fixture runner with --closure. No remote requests.
export async function runV4Closure({page,origin,output}){
 const rows=[],properties=[['bugan','bugan'],['grand-mercure','grand-mercure'],['novotel-leme','deep-ocean'],['novotel-salvador','novotel'],['mercure','mercure'],['default','default']];
 const viewports=[[360,800],[375,812],[390,844],[430,932],[1024,900],[1440,900],[1536,864]];
 async function ready(){await page.locator('h1').first().waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow');assert.ok(!(await page.locator('h1').first().innerText()).includes('404'));}
 async function visit(href){await page.goto(new URL(href,origin).href);await ready();}
 async function dock(){
  const dock=page.locator('.public-bottom-dock');if(!await dock.count())return;
  const last=page.locator('.public-service-full-content a').last();if(!await last.count())return;
  await last.focus();await page.waitForTimeout(30);const button=await last.boundingBox(),bar=await dock.boundingBox();assert.ok(button.y+button.height<=bar.y+1,'last CTA hidden by dock');assert.ok(button.height>=44);
  assert.equal(await last.evaluate(el=>getComputedStyle(el).outlineStyle!=='none'),true,'keyboard focus not visible');
 }
 async function contrast(){
  const failures=await page.locator('[data-essential] p,[data-essential] dt,[data-essential] dd,.public-area-hero h1').evaluateAll(elements=>{
   const rgb=s=>(s.match(/[\d.]+/g)??[]).map(Number),luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
   return elements.filter(el=>{
    const style=getComputedStyle(el);let parent=el,bg=[];while(parent){bg=rgb(getComputedStyle(parent).backgroundColor);if(bg.length===3||bg[3]===1)break;parent=parent.parentElement;}
    if(!parent)return false;const a=luminance(rgb(style.color)),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size=parseFloat(style.fontSize),large=size>=24||(size>=18.66&&Number(style.fontWeight)>=700);return ratio<(large?3:4.5);
   }).map(el=>el.textContent);
  });assert.deepEqual(failures,[],'essential information contrast');
 }
 for(const [property,theme]of properties)for(const lang of ['pt','en','es'])for(const [width,height]of viewports){
  if(width===360)console.log(`Journey matrix ${property} ${lang}`);
  await page.setViewportSize({width,height});const home=origin+'/preview?'+new URLSearchParams({scope:'preview',experience:'v4',tourism:'coherent',closure:'1',property,theme,lang});await visit(home);
  const actions=await page.locator('[data-v4-action]').evaluateAll(items=>Object.fromEntries(items.map(a=>[a.dataset.v4Action,a.getAttribute('href')])));
   const cards=property==='bugan'?await page.locator('.v3-tourism-cards>a').evaluateAll(items=>items.map(a=>a.getAttribute('href'))):['/preview/explorar/turismo/praia-de-boa-viagem?lang='+lang];if(property==='bugan'){assert.equal(cards.length,4);assert.equal(new Set(cards).size,4);}
  const info='/preview/explorar/informacoes'+(lang==='pt'?'':'?lang='+lang);
  await visit(info);const wifi=await page.locator('[data-essential="wifi"]').innerText();assert.ok(wifi.includes('Bugan by Atlantica'));assert.ok(wifi.includes(lang==='en'?'first name, last name':lang==='es'?'nombre, apellido':'nome, sobrenome'));
  const breakfast=await page.locator('[data-essential="breakfast"]').innerText();assert.ok(breakfast.includes('06:00–10:00'));assert.ok(breakfast.includes('06:00–10:30'));assert.ok(breakfast.includes(lang==='en'?'Monday to Friday':lang==='es'?'Lunes a viernes':'Segunda a sexta'));assert.ok((await page.locator('main').innerText()).includes('14:00'));
  const hero=await page.locator('.public-area-hero').boundingBox();assert.ok(hero.height<260,'oversized internal header');
  await contrast();
  if(property==='bugan'&&lang==='pt'&&[390,1440].includes(width))await page.screenshot({path:join(output,`closure-info-${width}.png`),fullPage:true});
  await visit(actions.services);assert.equal(await page.locator('.hotel-service-editorial-card').count(),13);
  const search=page.locator('input[type="search"]');await search.fill('Filipe');assert.equal(await page.locator('.hotel-service-editorial-card').count(),1);await search.fill('');
  const disclosure=page.locator('.public-service-disclosure summary').first();await disclosure.focus();await page.keyboard.press('Enter');assert.ok(await page.locator('.public-service-disclosure[open]').count());
  const serviceHref=await page.locator('a[href^="/preview/servicos/"]').first().getAttribute('href');await visit(serviceHref);assert.ok(!(await page.locator('body').innerText()).includes('60 caracteres'));await dock();
  const back=await page.locator('.public-service-full-content a').last().getAttribute('href');assert.equal(back,actions.services);
  await visit(actions.dining);assert.equal(await page.locator('h1').innerText(),'Restaurante Filipe');await dock();assert.ok(!(await page.locator('body').innerText()).includes('parcial'));
  await visit(actions.contact);assert.equal(await page.locator('a[href^="tel:"]').count(),4);assert.ok((await page.locator('main').innerText()).includes('*1'));
  const numbers=await page.locator('a[href^="tel:"]').evaluateAll(a=>a.map(el=>el.getAttribute('href')));assert.ok(numbers.every(h=>/^tel:\+[1-9]\d{7,14}$/.test(h)));
  for(const tab of ['meu-voo','partidas','chegadas']){await visit('/preview/explorar/voos?'+new URLSearchParams({lang,tab}));if(tab==='meu-voo')assert.ok(await page.locator('[role="status"]').count());else assert.ok((await page.locator('body').innerText()).includes('REC'));assert.equal(await page.locator('form').count(),0);}
  for(const [index,href]of cards.entries()){
   // Full four-card journeys at every Bugan viewport; other themes check the shared catalogue.
   if(property!=='bugan'&&index>0)continue;await visit(href);
   if(index===0){assert.equal(await page.locator('h1').innerText(),'Praia de Boa Viagem');}
   else{assert.ok(await page.locator('[data-tourism-item]').count());assert.equal(await page.locator('option[value="EXPERIENCE"]').count(),0);await page.locator('[data-tourism-item]').first().click();await ready();assert.ok(page.url().includes('collection='));}
   const links=await page.locator('a[data-analytics-language]').evaluateAll(a=>a.map(el=>el.getAttribute('href')));assert.ok(links.every(h=>h.startsWith('/preview/')));
  }
  await visit(home);const text=await page.locator('body').innerText();if(property==='bugan')assert.ok(text.includes('Restaurante Filipe'));assert.ok(page.url().includes('lang='+lang));
  rows.push({property,lang,width,height,journeys:['wifi','breakfast','service','dining','tourism','flights','contact','language-return'],passed:true});
 }
 return rows;
}
