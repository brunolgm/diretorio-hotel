/* Reproducible component QA. No tenant/auth claim; network restricted to loopback.
 * npm install; Edge installed locally. Screenshots/reports go to ignored out/.
 * Installs a dev-only route from the versioned fixture and removes it in finally.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
const root=process.cwd();
const route=path.join(root,'app/bugan-qa-local/page.tsx');
const fixture=fs.readFileSync(path.join(root,'tests/fixtures/bugan-visual-page.tsx'));
const output=path.join(root,'out/public-v3');
const origin='http://127.0.0.1:3107';
const assets=path.join(root,'docs/references/bugan/public-v3');
const files={hero:'hero-piscina-real.png',about:'fachada-bugan-real.png',restaurant:'restaurante-filipe-real.png',accommodation:'acomodacao-bugan-real.png'};
for(const file of [...Object.values(files),'golden-master-public-v3.png']) assert.ok(fs.existsSync(path.join(assets,file)),`Missing reference: ${file}`);
assert.ok(!fs.existsSync(route),'Refusing to overwrite an existing route');
fs.mkdirSync(path.dirname(route),{recursive:true}); fs.writeFileSync(route,fixture);
fs.mkdirSync(output,{recursive:true});
const log=fs.openSync(path.join(output,'server.log'),'w');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3107'],{cwd:root,stdio:['ignore',log,log],windowsHide:true,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-component-fixture',NEXT_TELEMETRY_DISABLED:'1'}});
let browser;
const results=[]; const errors=[];
try {
  let ready=false;
  for(let i=0;i<60;i++) {
    try {const r=await fetch(`${origin}/bugan-qa-local`,{signal:AbortSignal.timeout(1500)}); if(r.ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,'Local fixture server did not start. Inspect server.log.');
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async request=>{
    const url=new URL(request.request().url());
    if(url.origin===origin&&!url.pathname.startsWith('/api/')) return request.continue();
    // Real reference photographs are supplied only to this local component fixture.
    if(url.origin==='http://127.0.0.1:54321'&&url.pathname.startsWith('/storage/v1/object/public/hotel-assets/')) {
      const slot=url.pathname.split('/').at(-2);
      if(files[slot]) return request.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(assets,files[slot]))});
    }
    return request.abort();
  });
  async function visit(query,width=390,height=844){
    await page.setViewportSize({width,height});
    const response=await page.goto(`${origin}/bugan-qa-local?${query}`);
    assert.equal(response.status(),200,query);
    await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
    await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode().catch(()=>{}))));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${query} ${width}`);
  }
  for(const [name,width,height,query] of [
    ['desktop-1440',1440,900,'media=yes&tourism=yes&flights=yes&reserve=yes'],
    ['desktop-1536',1536,864,'media=yes&tourism=yes&flights=yes&lang=en'],
    ['mobile-390',390,844,'media=yes&tourism=yes&flights=yes'],
    ['mobile-430',430,932,'media=yes&tourism=yes&flights=yes&lang=es'],
    ['four-accesses',1440,900,'media=yes'],
    ['fallback',390,844,'empty=yes&hero=no'],
    ['mobile-specific',390,844,'media=yes&mobile=yes'],
    ['media-admin',1440,900,'mediaadmin=yes'],
    ['admin-bugan',390,844,'admin=yes'],
  ]) {
    await visit(query,width,height);
    await page.screenshot({path:path.join(output,`${name}.png`),fullPage:true});
    results.push({name,width,height,status:200,overflow:false});
    if(name==='mobile-390') {
      const trigger=page.getByRole('button',{name:'Abrir navegação'}); await trigger.click();
      await page.getByRole('dialog').waitFor();
      await page.screenshot({path:path.join(output,'mobile-drawer.png')});
      for(let i=0;i<16;i++){await page.keyboard.press('Tab');await page.waitForFunction(()=>Boolean(document.activeElement.closest('[role="dialog"]')));}
      await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({state:'hidden'});
      assert.ok(await trigger.evaluate(el=>el===document.activeElement));
    }
    if(name==='media-admin') {
      const picker=page.getByRole('slider',{name:'Desktop ponto X'}).first(); await picker.fill('80');
      assert.equal(await picker.inputValue(),'80');
      await page.getByRole('button',{name:'Selecionar ponto focal na fotografia'}).first().click({position:{x:30,y:30}});
      assert.notEqual(await picker.inputValue(),'80');
      const desktopInput=page.locator('input[name="desktop_image"]').first();
      await desktopInput.setInputFiles(path.join(assets,files.hero));
      await page.getByRole('alert').first().waitFor();
      assert.equal(await page.getByRole('button',{name:'Salvar Hero',exact:true}).isDisabled(),true);
      await desktopInput.setInputFiles([]);
      assert.equal(await page.getByRole('button',{name:'Salvar Hero',exact:true}).isEnabled(),true);
    }
  }
  let combinations=0;
  for(const width of [390,430,1440,1536]) for(const lang of ['pt','en','es']) for(const cards of [2,3,4,5,6]){
    await visit(`media=yes&cards=${cards}&lang=${lang}`,width,width>1000?900:844);
    assert.equal(await page.locator('[data-v3-accesses]>a').count(),cards);
    assert.equal(await page.locator('.public-bottom-dock a[href*="turismo"],.public-bottom-dock a[href*="voos"]').count(),0);
    combinations++;
  }
  for(const brand of ['grand-mercure','novotel','mercure','bugan','midnight-slate']) {
    for(const query of [`theme=${brand}&tourismpage=yes&tourism=yes`,`theme=${brand}&tourismpage=yes&tourism=yes&detail=yes`,`theme=${brand}&flightpage=yes`,`theme=${brand}&area=turismo`,`theme=${brand}&room=yes&media=yes`]) {
      await visit(query);
      assert.equal(await page.locator(`main[data-hotel-theme="${brand}"]`).count(),1);
      if(query.includes('tourismpage=yes')) assert.ok(await page.getByText('Item sintético de Turismo',{exact:true}).count());
      if(query.includes('area=turismo')) assert.ok(await page.getByText('Turismo legado sintético',{exact:true}).count());
    }
    results.push({brand,tourismCatalog:true,tourismDetail:true,flights:true,legacy:true,roomContextFixture:true});
  }
  await visit('media=yes');
  assert.equal(await page.locator('[data-access="tourism"],[data-access="flights"],[data-v3-tourism]').count(),0);
  assert.equal(await page.locator('.v3-reserve').count(),0);
  await visit('media=yes&tourism=yes&flights=yes');
  assert.equal(await page.locator('[data-access="tourism"]').count(),1);
  assert.equal(await page.locator('[data-access="flights"]').count(),1);
  assert.equal(await page.locator('[data-v3-tourism]').count(),1);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify({fixtureOnly:true,realReferencePhotos:true,combinations,results,errors},null,2)+'\n');
  console.log(`PASS: ${combinations} responsive/language/card cases; five themes; media focal picker; drawer focus/Escape; optional modules. Component fixtures only.`);
} finally {
  await browser?.close();
  if(process.platform==='win32') spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}); else server.kill();
  fs.closeSync(log);
  if(fs.existsSync(route)&&fs.readFileSync(route).equals(fixture)){fs.unlinkSync(route);fs.rmdirSync(path.dirname(route));}
  const validator=path.join(root,'.next/dev/types/validator.ts');
  if(fs.existsSync(validator)&&fs.readFileSync(validator,'utf8').includes('/bugan-qa-local')) fs.unlinkSync(validator);
}
