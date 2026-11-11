// Local component review with synthetic tenants and simulated API responses only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync} from 'node:fs';
import {resolve, join, extname} from 'node:path';

const require = createRequire(import.meta.url);
const {build} = require('esbuild');
const {chromium} = require('playwright');
const postcss = require('postcss');
const refinement = process.argv.includes('--refinement');
const port = refinement ? 4218 : 4217;
const baseUrl = 'http://127.0.0.1:' + port;
const output = resolve(refinement ? 'out/smartmenu-final-review' : 'out/smartmenu-review');
const photoRoot = process.env.SMARTMENU_PHOTO_ROOT ?? resolve('../../../out/fb-premium-correction/photos');
mkdirSync(output, {recursive: true});
await build({entryPoints: ['tests/browser/smartmenu-fixture.tsx'], bundle: true, platform: 'browser', jsx: 'automatic', format: 'esm', tsconfig: 'tsconfig.json', outfile: join(output, 'fixture.js'), define: {'process.env': '{}', 'process.env.NODE_ENV': '"development"'}, alias: {'next/image': resolve('tests/browser/public-v3-next-stubs.tsx'), 'next/link': resolve('tests/browser/public-v3-link-stub.tsx'), 'next/navigation': resolve('tests/browser/public-v3-next-stubs.tsx')}});
const css = await postcss([require('@tailwindcss/postcss')()]).process(readFileSync('app/globals.css', 'utf8'), {from: resolve('app/globals.css')});
writeFileSync(join(output, 'style.css'), css.css + '\n' + ['fb-catalog.css', 'native-ordering.css', 'smartmenu.css'].map(name => readFileSync('components/public/' + name, 'utf8')).join('\n') + '\n.fixture-label{font:11px/1.5 system-ui;padding:5px 16px;background:#eee7dc;color:#514035}');
const photos = existsSync(photoRoot) ? readdirSync(photoRoot).filter(name => /^\d+\.jpg$/.test(name)).map(name => name.slice(0, -4)) : [];
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET' || path.startsWith('/api/')) {response.writeHead(403); response.end(); return;}
  if (path === '/__review/photos') {response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(photos)); return;}
  let file = ['/fixture.js', '/style.css'].includes(path) ? join(output, path.slice(1)) : null;
  if (path === '/__review/logo.png') file = 'docs/references/bugan/public-v3/bugan-logo-oficial.png';
  const photo = path.match(/^\/__review\/photo\/(\d+)$/);
  if (photo && photos.includes(photo[1])) file = join(photoRoot, photo[1] + '.jpg');
  if (file && existsSync(file)) {response.setHeader('Content-Type', extname(file) === '.js' ? 'application/javascript' : extname(file) === '.css' ? 'text/css' : extname(file) === '.png' ? 'image/png' : 'image/jpeg'); response.end(readFileSync(file)); return;}
  if (/\.(jpg|png|css|js|svg)$/.test(path)) {response.writeHead(404); response.end(); return;}
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end('<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
});
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
if (process.argv.includes('--serve')) {console.log('Revisão local em ' + baseUrl); await new Promise(() => {});}
const browser = await chromium.launch({channel: 'chrome', headless: true});
const checks = [], errors = [], screenshots = [];
let externalRequests = 0;
const check = (value, label) => {assert.ok(value, label); checks.push(label);};
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {if (new URL(route.request().url()).hostname !== '127.0.0.1') {externalRequests++; return route.abort();} return route.continue();});
  async function visit(query = {}) {await page.goto(baseUrl + '/?' + new URLSearchParams(query)); await page.locator('[data-smartmenu]').waitFor(); await page.evaluate(() => document.fonts.ready);}
  async function capture(name, fullPage = false) {await page.screenshot({path: join(output, name + '.png'), fullPage}); screenshots.push(name + '.png');}
  async function add(id, options = false) {
    const card = page.locator('[data-fb-order-product="' + id + '"]');
    await card.locator('h3 button').click();
    if (options) await page.locator('dialog input[type=radio]').first().check();
    await page.locator('dialog button[type=submit]').click();
    await page.locator('.fb-order-dialog').waitFor({state: 'detached'});
  }
  if (refinement) {
    await page.setViewportSize({width: 390, height: 844}); await visit();
    check(await page.locator('.smartmenu-hero > img').count() === 0, 'editorial hero absent uses typography, never product photo');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile layout stays within viewport');
    await capture('r2-01-home-mobile');
    await page.setViewportSize({width: 1440, height: 900}); await visit();
    await capture('r2-02-home-desktop', true);
    const withoutPhoto = page.locator('.smartmenu-product[data-has-photo=false]').first();
    check(await withoutPhoto.count() === 1, 'product without photo supported');
    const shortCard = await withoutPhoto.boundingBox();
    const photoCard = await page.locator('.smartmenu-product[data-has-photo=true]').first().boundingBox();
    check(shortCard.height < photoCard.height - 60, 'desktop card without photo uses intrinsic compact height');
    const priceGap = await withoutPhoto.evaluate(node => node.querySelector('.smartmenu-product-copy > strong').getBoundingClientRect().top - node.querySelector('h3').getBoundingClientRect().bottom);
    check(priceGap < 110, 'price remains close to product text');
    await withoutPhoto.screenshot({path: join(output, 'r2-03-produto-sem-foto.png')}); screenshots.push('r2-03-produto-sem-foto.png');
    for (const width of [360,375,390]) {
      await page.setViewportSize({width, height: 760}); await visit();
      const ids = await page.evaluate(() => window.smartmenuFixtureIds);
      await add(ids.first);
      await page.locator('[data-fb-order-product="' + ids.first + '"] h3 button').click();
      const dialog = page.locator('.fb-order-dialog[open]');
      await dialog.locator('input[type=radio]').first().check();
      const quantity = dialog.getByRole('spinbutton');
      await quantity.fill('2');
      await dialog.locator('textarea').fill('Observação de teste local');
      await quantity.scrollIntoViewIfNeeded();
      check(await quantity.isEditable(), 'quantity usable at ' + width);
      check(await page.locator('.fb-order-mobile-cart').isHidden(), 'persistent cart hidden during modal at ' + width);
      await capture('r2-04-adicionais-' + width);
      // Reduced visual viewport models the space left by the mobile virtual keyboard.
      await page.setViewportSize({width, height: 360});
      await dialog.locator('textarea').focus();
      await dialog.locator('textarea').scrollIntoViewIfNeeded();
      const addButton = dialog.locator('button[type=submit]');
      await addButton.scrollIntoViewIfNeeded();
      check(await addButton.isEnabled(), 'add usable with reduced keyboard viewport at ' + width);
      const addBounds = await addButton.boundingBox();
      const closeBounds = await dialog.getByRole('button', {name:'Fechar',exact:true}).boundingBox();
      check(addBounds.y >= 0 && addBounds.y + addBounds.height <= 360, 'add visible above keyboard at ' + width);
      check(closeBounds.y >= 0 && closeBounds.y + closeBounds.height <= 360, 'close visible above keyboard at ' + width);
      await capture('r2-04-teclado-' + width);
      await dialog.getByRole('button', {name:'Fechar',exact:true}).click();
      check(await dialog.count() === 0, 'close works with keyboard viewport at ' + width);
    }
    await page.setViewportSize({width:390,height:844}); await visit({tracking:'1'});
    await page.locator('.smartmenu-order-current h2').waitFor();
    check(await page.locator('[data-cancellation-contact]').innerText().then(text => !text.includes('BLOQUEADO') && text.includes('indisponível')), 'friendly missing cancellation contact');
    check(await page.locator('.smartmenu-order-history').count() === 1, 'order history retained');
    await capture('r2-05-acompanhamento', true);
    for (const status of ['registered','accepted','preparing','ready','out_for_delivery','delivered','cancelled']) {
      await visit({tracking:'1',status}); await page.locator('.smartmenu-order-current h2').waitFor();
      check(await page.locator('.smartmenu-progress [aria-current=step]').count() === 1, 'actual backend status represented ' + status);
      const expectedConfirmed = status === 'registered' ? 1 : 2;
      check(await page.locator('.smartmenu-progress [data-confirmed=true]').count() === expectedConfirmed, 'progress only follows returned facts ' + status);
    }
    for (const lang of ['en','es']) {
      await visit({tracking:'1',lang}); await page.locator('.smartmenu-order-current h2').waitFor();
      check(await page.locator('[data-cancellation-contact]').innerText().then(text => !text.includes('BLOCKED') && !text.includes('BLOQUEADO')), 'friendly cancellation localized ' + lang);
    }
    await visit({tracking:'1',expired:'1'}); await page.locator('[role=alert]').waitFor();
    check(await page.locator('.smartmenu-order-current').count() === 0, 'expired access hides order facts');
    await page.setViewportSize({width:1440,height:900});
    await visit({multiple:'1'}); const primaryId = await page.locator('[data-fb-order-outlet]').getAttribute('data-fb-order-outlet');
    check(await page.getByText('Produto exclusivo do segundo outlet · fixture',{exact:true}).count() === 0, 'multiple outlets preserve product ownership');
    await capture('r2-06-multiplos-outlets', true);
    await visit({multiple:'1',reverse:'1'});
    check(await page.locator('[data-fb-order-outlet]').getAttribute('data-fb-order-outlet') === primaryId, 'selection stable after array reorder');
  } else {
  for (const [width, height] of [[360,640],[375,667],[390,844],[430,932],[768,900],[1024,900],[1440,900],[1536,864]]) {
    await page.setViewportSize({width, height}); await visit();
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'responsive ' + width);
    check(await page.locator('[data-fb-order-product]').count() <= 15, 'compact initial catalogue ' + width);
    check(await page.locator('.fb-catalog-filters').evaluate(node => getComputedStyle(node).flexWrap === 'nowrap' && getComputedStyle(node).display === 'flex'), 'horizontal category strip ' + width);
    if (width === 390) await capture('01-mobile-inicial');
    if (width === 1440) await capture('11-desktop-completo', true);
  }
  await page.setViewportSize({width: 390, height: 844}); await visit();
  check(await page.getByText('Restaurante Filipe', {exact: true}).count() === 0, 'no restaurant selector');
  check(await page.getByText('Noite de Massas', {exact: true}).count() === 0, 'no Filipe-only event');
  const categories = page.locator('.fb-catalog-filters > button');
  const selectedText = await categories.nth(2).innerText();
  await categories.nth(2).click(); await capture('02-categoria-selecionada', true);
  check(await page.locator('[data-catalog-category]').count() === 1, 'only selected category mounted');
  await page.locator('[data-smartmenu-more]').click(); await capture('03-mais-categorias');
  check(await page.locator('.smartmenu-category-dialog[open] > div button').count() > 6, 'all categories accessible');
  await page.keyboard.press('Escape');
  check(await page.locator('[data-smartmenu-more]').evaluate(node => node === document.activeElement), 'category dialog restores keyboard focus');
  const search = page.getByRole('searchbox');
  await search.fill('pizza'); await capture('04-busca-resultados', true);
  check(await page.locator('[data-fb-order-product]').count() > 0, 'global search outside selected category');
  await search.fill('');
  check(await page.locator('.fb-catalog-filters > button[aria-pressed=true]').innerText() === selectedText, 'restore previous filter');
  await search.fill('zzzz-sem-resultado'); check(await page.locator('[data-fb-order-product]').count() === 0, 'empty search');
  await visit();
  let ids = await page.evaluate(() => window.smartmenuFixtureIds);
  await page.locator('[data-fb-order-product="' + ids.first + '"] h3 button').click();
  await capture('05-detalhe-adicionais');
  await page.locator('dialog input[type=radio]').first().check();
  await page.locator('dialog button[type=submit]').click();
  await page.locator('[data-smartmenu-recommendations]').scrollIntoViewIfNeeded(); await capture('06-recomendacao-complementar');
  check(await page.locator('[data-smartmenu-recommendations]').count() === 1, 'configured combo complement shown');
  check(await page.evaluate(() => window.smartmenuRequests.length) === 0, 'recommendation does not place or quote order');
  await page.locator('[data-smartmenu-recommendations] button').first().click();
  await page.locator('dialog button[type=submit]').click();
  await page.locator('#smartmenu-cart').scrollIntoViewIfNeeded(); await capture('08-carrinho');
  // Recreate uncustomized lines to exercise safe combo replacement.
  await visit(); ids = await page.evaluate(() => window.smartmenuFixtureIds);
  await add(ids.first);
  await page.locator('[data-smartmenu-recommendations] button').first().click(); await page.locator('dialog button[type=submit]').click();
  await page.locator('[data-smartmenu-combo]').scrollIntoViewIfNeeded(); await capture('07-sugestao-combo');
  await page.locator('[data-smartmenu-combo] button').click();
  for (const radio of await page.locator('dialog input[type=radio]').all()) await radio.check();
  await page.locator('dialog button[type=submit]').click();
  check(await page.locator('.smartmenu-cart-item').count() === 1, 'explicit combo replacement removes only matched lines');
  await page.getByRole('button', {name: 'Revisar pedido', exact: true}).click();
  await page.locator('input[name=first_name]').fill('Hóspede'); await page.locator('input[name=last_name]').fill('Sintético');
  await page.locator('#smartmenu-cart').screenshot({path: join(output, '09-finalizacao.png')}); screenshots.push('09-finalizacao.png');
  await page.getByRole('button', {name: 'Confirmar pedido', exact: true}).click();
  check((await page.getByRole('link', {name: 'Acompanhar pedido'}).getAttribute('href')).includes('smartmenu=1'), 'dedicated tracking on existing receipt link');
  await visit({tracking: '1'}); await page.locator('[data-fb-order-tracking] section').first().waitFor(); await capture('10-acompanhamento', true);
  check(await page.locator('.smartmenu-progress [aria-current=step]').innerText() === 'Registrado — aguardando aceite do hotel', 'actual backend status rendered');
  await visit({room: '0'}); ids = await page.evaluate(() => window.smartmenuFixtureIds);
  await page.locator('[data-fb-order-product="' + ids.first + '"] h3 button').click();
  check(await page.locator('dialog button[type=submit]').isDisabled(), 'no room QR disables order from detail');
  await visit({closed: '1'}); ids = await page.evaluate(() => window.smartmenuFixtureIds);
  await page.locator('[data-fb-order-product="' + ids.first + '"] h3 button').click();
  check(await page.locator('dialog button[type=submit]').isDisabled(), 'closed outlet disables add');
  await visit({unavailable: '1'}); ids = await page.evaluate(() => window.smartmenuFixtureIds);
  await page.locator('[data-fb-order-product="' + ids.first + '"] h3 button').click();
  check(await page.locator('dialog button[type=submit]').isDisabled(), 'unavailable product disables add');
  await visit({large: '1'});
  check(await page.locator('[data-fb-order-product]').count() <= 15, '1000 extra products stay bounded initially');
  await page.getByRole('searchbox').fill('Produto de teste');
  check(await page.locator('[data-fb-order-product]').count() === 12, 'large search bounded to 12');
  await page.getByRole('button', {name: 'Carregar mais itens', exact: true}).click();
  check(await page.locator('[data-fb-order-product]').count() === 24, 'explicit progressive search');
  await page.getByRole('searchbox').fill('Produto de teste 1');
  check(await page.locator('[data-fb-order-product]').count() === 12, 'new search resets product batch');
  await page.setViewportSize({width: 360, height: 640});
  await visit();
  await page.evaluate(() => {document.documentElement.style.fontSize = '200%';});
  const enlargedOverflow = await page.evaluate(() => [...document.querySelectorAll('[data-smartmenu] *')].filter(node => {const r=node.getBoundingClientRect();return r.width && (r.right>innerWidth+1 || r.left < -1);}).slice(0,20).map(node=>({tag:node.tagName,classes:node.className,width:node.getBoundingClientRect().width,right:node.getBoundingClientRect().right})));
  writeFileSync(join(output,'enlarged-overflow.json'),JSON.stringify(enlargedOverflow,null,2));
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '200 percent text has no global horizontal overflow');
  await page.emulateMedia({reducedMotion: 'reduce'});
  check(await page.locator('[data-smartmenu]').evaluate(node => getComputedStyle(node).scrollBehavior === 'auto'), 'reduced motion respected');
  await page.setViewportSize({width: 390, height: 844});
  for (let hotel = 0; hotel < 6; hotel++) for (const lang of ['pt','en','es']) {
    await visit({hotel: String(hotel), lang});
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'theme/language ' + hotel + '/' + lang);
    if (lang === 'pt') await capture('tema-' + hotel);
  }
  await visit({uncertain: '1'}); ids = await page.evaluate(() => window.smartmenuFixtureIds); await add(ids.first);
  await page.getByRole('button', {name: 'Revisar pedido', exact: true}).click();
  await page.locator('input[name=first_name]').fill('Teste'); await page.locator('input[name=last_name]').fill('Local');
  await page.getByRole('button', {name: 'Confirmar pedido', exact: true}).click();
  await page.getByRole('button', {name: 'Retomar a mesma confirmação', exact: true}).click();
  const attempts = await page.evaluate(() => window.smartmenuRequests.filter(request => request.operation === 'confirm').map(request => request.body));
  check(attempts.length === 2 && JSON.stringify(attempts[0]) === JSON.stringify(attempts[1]), 'same idempotent attempt after uncertain response');
  }
  assert.deepEqual(errors, []); assert.equal(externalRequests, 0);
  const report = {passed: checks.length, failed: 0, externalRequests, api: 'simulated in isolated browser fixture', checks, screenshots, photos: photos.length};
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({passed: checks.length, failed: 0, screenshots: screenshots.length, externalRequests}));
} finally {await browser.close(); await new Promise(resolve => server.close(resolve));}
