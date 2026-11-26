// Uses the CSS emitted by `next build`, including production optimization.
// Raw PostCSS/dev CSS masked the original independent-translate regression.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';
import { chromium, webkit, devices } from 'playwright';

const out = resolve('out/guest-service-sheet-hotfix');
mkdirSync(out, { recursive: true });
const before = process.env.SHEET_MODE === 'before';
const cssFiles = readdirSync('.next/static/chunks').filter(f => f.endsWith('.css'));
const cssFile = cssFiles.find(f => readFileSync(join('.next/static/chunks', f), 'utf8').includes('.guest-service-sheet['));
assert.ok(cssFile, 'Run next build before responsive verification');
const css = before ? readFileSync(join(out, 'before-production.css'), 'utf8') : readFileSync(join('.next/static/chunks', cssFile), 'utf8');
const bundle = before ? 'fixture-before.js' : 'fixture.js';
await build({ entryPoints: ['tests/browser/guest-service-sheet-fixture.tsx'], bundle: true, outfile: join(out, bundle), platform: 'browser', loader: { '.png': 'dataurl' }, jsx: 'automatic', tsconfig: 'tsconfig.json', define: { 'process.env': '{}', 'process.env.NODE_ENV': JSON.stringify('production') }, alias: { 'node:crypto': resolve('tests/browser/public-v3-crypto-stub.ts'), 'next/image': resolve('tests/browser/public-v3-next-stubs.tsx'), 'next/link': resolve('tests/browser/public-v3-link-stub.tsx'), 'next/navigation': resolve('tests/browser/public-v3-next-stubs.tsx') } });
writeFileSync(join(out, before ? 'fixture-before.css' : 'fixture.css'), css);
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  const assets = { '/fixture.js': join(out, bundle), '/fixture.css': join(out, before ? 'fixture-before.css' : 'fixture.css'), '/assets/logo.png': resolve('docs/references/bugan/public-v3/bugan-logo-oficial.png') };
  if (assets[path]) { res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'image/png'); res.end(readFileSync(assets[path])); return; }
  if (path.startsWith('/api/')) { res.writeHead(403); res.end(); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
});
await new Promise(r => server.listen(4341, '127.0.0.1', r));
const origin = 'http://127.0.0.1:4341';
const services = ['Room Service', 'Lavanderia', 'Menu de travesseiros', 'Academia', 'Spa dos Pés'];
const rows = [], extras = [], errors = [], captures = [];
let browser, failurePage, currentCase;

async function settle(dialog) {
  await dialog.waitFor();
  // Wait for natural CSS animations/transitions AND stable final geometry; never fast-forward screenshots.
  await dialog.evaluate(async el => {
    let stable = 0, previous = '';
    for (let i = 0; i < 180; i++) {
      await new Promise(r => requestAnimationFrame(r));
      const b = el.getBoundingClientRect(), signature = [b.x, b.y, b.width, b.height].map(n => n.toFixed(2)).join(',');
      const running = el.getAnimations({ subtree: true }).some(a => a.playState === 'running' || a.pending);
      stable = !running && !el.hasAttribute('data-starting-style') && signature === previous ? stable + 1 : 0;
      previous = signature;
      if (stable >= 4) return;
    }
    throw Error('Dialog animation/geometry did not settle');
  });
}
async function geometry(dialog) {
  return dialog.evaluate(el => {
    const r = el.getBoundingClientRect(), s = getComputedStyle(el), v = window.visualViewport;
    const viewport = { left: v.offsetLeft, top: v.offsetTop, width: v.width, height: v.height };
    const close = el.querySelector('[data-slot=dialog-close]');
    return { rect: r.toJSON(), viewport, translate: s.translate, transform: s.transform, position: s.position, radius: s.borderTopLeftRadius, paddingBottom: s.paddingBottom, overflowY: s.overflowY, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, close: close?.getBoundingClientRect().toJSON(), horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, ancestors: [el.parentElement, el.parentElement?.parentElement].filter(Boolean).map(p => getComputedStyle(p).transform) };
  });
}
function contained(g, label) {
  const { rect: r, viewport: v } = g, tolerance = 1;
  assert.ok(r.left >= v.left - tolerance && r.right <= v.left + v.width + tolerance && r.top >= v.top - tolerance && r.bottom <= v.top + v.height + tolerance, label + ': ' + JSON.stringify(g));
  assert.ok(!g.horizontalOverflow && g.scrollWidth <= g.clientWidth + 1, label + ': horizontal overflow');
}
async function listingPosition(page) {
  return page.evaluate(() => ({ x: scrollX, y: scrollY, region: document.querySelector('[data-public-internal-body]')?.scrollTop || 0 }));
}
function samePosition(a, b) {
  for (const key of ['x', 'y', 'region']) assert.ok(Math.abs(a[key] - b[key]) <= 2, 'Listing scroll moved: ' + JSON.stringify({ a, b }));
}
function opener(page, service) {
  return service === 'Room Service' ? page.getByRole('button', { name: 'Informações sobre Room Service', exact: true }) : page.locator('.guest-service-row').filter({ has: page.getByText(service, { exact: true }) }).getByRole('button').first();
}
async function capture(page, filename) {
  await page.screenshot({ path: join(out, filename) });
  captures.push(filename);
}

try {
  for (const engine of before ? ['chrome'] : ['chrome', 'webkit']) {
    browser = await (engine === 'chrome' ? chromium.launch({ channel: 'chrome', headless: true }) : webkit.launch({ headless: true }));
    const version = browser.version();
    for (const width of before ? [390] : process.env.SHEET_WIDTHS ? process.env.SHEET_WIDTHS.split(',').map(Number) : [320, 360, 390, 412, 430, 768, 1440]) {
      const height = width === 320 ? 568 : width === 768 ? 1024 : width === 1440 ? 900 : 844;
      const mobile = width < 1025;
      const device = engine === 'chrome' ? devices['Pixel 7'] : devices['iPhone 13'];
      const context = await browser.newContext({ ...(mobile ? device : {}), viewport: { width, height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      failurePage = page;
      page.on('pageerror', e => errors.push({ engine, width, error: e.message }));
      await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
      for (const length of before ? ['short'] : ['short', 'long']) {
        await page.goto(origin + '/?hotel=4&length=' + length);
        await page.locator('.guest-service-row').first().waitFor();
        for (const service of before ? ['Room Service'] : services) {
          currentCase = { engine, width, length, service };
          const button = opener(page, service);
          await button.scrollIntoViewIfNeeded();
          const position = await listingPosition(page);
          await button.click();
          const dialog = page.getByRole('dialog');
          await settle(dialog);
          const g = await geometry(dialog);
          if (before) {
            assert.ok(g.rect.left < -100, 'Baseline must reproduce the clipped production sheet');
            await capture(page, 'before-local-production-css.png');
            rows.push({ engine, version, width, height, service, length, reproduced: true, ...g });
            break;
          }
          contained(g, engine + '/' + width + '/' + length + '/' + service);
          assert.equal(g.position, 'fixed');
          if (width < 768) {
            assert.ok(Math.abs(g.rect.width - g.viewport.width) <= 1, 'Mobile sheet fills viewport width');
            assert.ok(Math.abs(g.rect.bottom - (g.viewport.top + g.viewport.height)) <= 1, 'Mobile sheet is bottom anchored');
            assert.ok(['none', '0px', '0px 0px'].includes(g.translate), 'No desktop translation remains on mobile');
            assert.ok(parseFloat(g.radius) >= 20 && parseFloat(g.paddingBottom) >= 24, 'Rounded top and safe-area padding preserved');
          } else {
            assert.ok(Math.abs(g.rect.left + g.rect.width / 2 - (g.viewport.left + g.viewport.width / 2)) <= 1, 'Desktop/tablet horizontal centering');
            assert.ok(Math.abs(g.rect.top + g.rect.height / 2 - (g.viewport.top + g.viewport.height / 2)) <= 1, 'Desktop/tablet vertical centering');
            assert.ok(g.rect.width <= 560 + 1, 'Desktop width preserved');
          }
          await page.keyboard.press('Tab');
          await page.waitForFunction(() => document.querySelector('[role=dialog]')?.contains(document.activeElement), null, { timeout: 2000 });
          if (length === 'long') {
            assert.ok(g.scrollHeight > g.clientHeight, 'Long content scrolls internally');
            await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
            await page.waitForFunction(() => document.querySelector('[role=dialog]').scrollTop > 0);
            const scrolled = await geometry(dialog);contained(scrolled, 'Scrolled sheet');
            assert.ok(scrolled.close.top >= scrolled.viewport.top && scrolled.close.bottom <= scrolled.viewport.top + scrolled.viewport.height + 1, 'Close remains accessible after internal scroll');
            const end = await dialog.evaluate(el => {
              const paragraphs = el.querySelectorAll('.guest-service-description');
              const node = paragraphs[paragraphs.length - 1].firstChild;
              const marker = node.textContent.includes('FIM_DAS_CONDICOES') ? 'FIM_DAS_CONDICOES' : 'FIM_DAS_ORIENTACOES';
              const range = document.createRange();range.setStart(node, node.textContent.lastIndexOf(marker));range.setEnd(node, node.textContent.length);
              return range.getBoundingClientRect().toJSON();
            });
            assert.ok(end.top >= g.viewport.top && end.bottom <= g.viewport.top + g.viewport.height + 1 && end.left >= 0 && end.right <= g.viewport.width + 1, 'End of long content is geometrically reachable');
            samePosition(position, await listingPosition(page));
          }
          if ((width === 390 || width === 1440) || (length === 'long' && service === 'Room Service')) await capture(page, `${engine}-${width}-${length}-${services.indexOf(service)}.png`);
          const closeMethod = services.indexOf(service) % 3;
          if (closeMethod === 0) await page.getByRole('button', { name: 'Fechar', exact: true }).click();
          else if (closeMethod === 1) await page.goBack();
          else await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
          await page.waitForFunction(() => !history.state?.guestServiceDetail);
          samePosition(position, await listingPosition(page));
          assert.ok(await button.evaluate(el => el === document.activeElement), 'Focus returns to the originating row');
          rows.push({ engine, version, width, height, service, length, closeMethod: ['button', 'back', 'escape'][closeMethod], passed: true, ...g });
        }
      }
      if (!before) {
        // The default Dialog remains unchanged, including its ordinary mobile presentation.
        await page.goto(origin + '/?standard=1');await page.getByRole('button', { name: 'Abrir modal padrão' }).click();await settle(page.getByRole('dialog'));
        const standard = await geometry(page.getByRole('dialog'));contained(standard, 'Unchanged default dialog');
        assert.ok(Math.abs(standard.rect.left + standard.rect.width / 2 - width / 2) <= 1);
        assert.ok(Math.abs(standard.rect.top + standard.rect.height / 2 - height / 2) <= 1);
        await page.getByRole('button', { name: 'Close', exact: true }).click();await page.getByRole('dialog').waitFor({ state: 'hidden' });
        extras.push({ engine, width, check: 'default Dialog stays centered', passed: true });
      }
      await context.close();
      console.log(`${engine} ${width}: ${before ? 'baseline reproduced' : 'short/long, five services, geometry and lifecycle passed'}`);
    }
    if (!before) {
      const device = engine === 'chrome' ? devices['Pixel 7'] : devices['iPhone 13'];
      const context = await browser.newContext({ ...device, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      const page = await context.newPage();failurePage = page;page.on('pageerror', e => errors.push({ engine, error: e.message }));
      await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
      for (const hotel of [0, 1, 2, 3, 4]) {
        await page.goto(origin + '/?hotel=' + hotel + '&length=short&transformed=1');
        await opener(page, 'Spa dos Pés').click();await settle(page.getByRole('dialog'));
        const g = await geometry(page.getByRole('dialog'));contained(g, 'Shared tenant ' + hotel);
        assert.ok(g.ancestors.every(t => t === 'none'), 'Portal escapes transformed application ancestor');
        await page.getByRole('button', { name: 'Fechar', exact: true }).click();await page.getByRole('dialog').waitFor({ state: 'hidden' });
        extras.push({ engine, hotel, check: 'shared layout and transformed ancestor isolation', passed: true });
      }
      // Preserve an actual nonzero list scroll together with both query and category.
      await page.goto(origin + '/?hotel=4&volume=1');
      const category = page.getByRole('button', { name: 'Experiências locais', exact: true });
      await category.click();await page.getByRole('searchbox').fill('synthetic');
      const count = await page.locator('.guest-service-row').count();assert.ok(count > 12);
      const button = page.locator('.guest-service-row').nth(12).getByRole('button').first();
      await button.scrollIntoViewIfNeeded();const position = await listingPosition(page);assert.ok(position.y > 0 || position.region > 0);
      await button.click();await settle(page.getByRole('dialog'));await page.goBack();await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('searchbox').inputValue(), 'synthetic');
      assert.equal(await category.getAttribute('aria-pressed'), 'true');assert.equal(await page.locator('.guest-service-row').count(), count);
      samePosition(position, await listingPosition(page));extras.push({ engine, check: 'back preserves query, category and nonzero list scroll', passed: true, position });
      // A smaller available viewport and rotation must reflow an already open popup.
      await page.goto(origin + '/?hotel=4&length=long');await opener(page, 'Room Service').click();
      for (const viewport of [{ width: 412, height: 600 }, { width: 844, height: 390 }, { width: 320, height: 480 }]) {
        await page.setViewportSize(viewport);await settle(page.getByRole('dialog'));const g = await geometry(page.getByRole('dialog'));contained(g, 'Resize/rotation');
        assert.ok(g.close.top >= 0 && g.close.bottom <= g.viewport.height + 1);extras.push({ engine, check: 'available viewport change with dialog open', viewport, passed: true });
      }
      await capture(page, engine + '-320-short-viewport-long.png');await page.getByRole('button', { name: 'Fechar', exact: true }).click();await page.getByRole('dialog').waitFor({ state: 'hidden' });
      for (const height of [900, 844]) {
        await page.setViewportSize({ width: 390, height });await page.goto(origin + '/?hotel=4');await page.locator('.guest-service-row').first().waitFor();
        const fold = await page.locator('.guest-service-row').evaluateAll(nodes => {const b = document.querySelector('[data-public-internal-body]').getBoundingClientRect();return { total: nodes.length, complete: nodes.filter(el => {const r = el.getBoundingClientRect();return r.top >= b.top && r.bottom <= Math.min(innerHeight, b.bottom);}).length };});
        assert.equal(fold.total, 8);assert.ok(fold.complete >= 7, 'Approved listing density');await capture(page, engine + '-listing-390-' + height + '.png');
        extras.push({ engine, check: 'approved listing density', height, ...fold, passed: true });
      }
      await context.close();
      const reduced = await browser.newContext({ ...device, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const reducedPage = await reduced.newPage();await reducedPage.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
      await reducedPage.goto(origin + '/?length=short');await opener(reducedPage, 'Menu de travesseiros').click();await settle(reducedPage.getByRole('dialog'));
      contained(await geometry(reducedPage.getByRole('dialog')), 'Reduced motion');assert.equal(await reducedPage.getByRole('dialog').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
      extras.push({ engine, check: 'reduced motion', passed: true });await reduced.close();
    }
    await browser.close();browser = null;
  }
  assert.deepEqual(errors, []);
  writeFileSync(join(out, before ? 'baseline-responsive-report.json' : 'responsive-report.json'), JSON.stringify({ cssSource: before ? 'before-production.css' : '.next/static/chunks/' + cssFile, actualOptimizedProductionCss: true, scope: 'Actual shared public renderer and Dialog. Historical safe text plus synthetic short/long variants; no external requests, database access or production changes.', rows, extras, captures, errors, passed: rows.length + extras.length }, null, 2));
  console.log(`PASS ${rows.length} service cases and ${extras.length} preservation cases`);
} catch (e) {
  const active = failurePage && !failurePage.isClosed() ? await failurePage.evaluate(() => document.activeElement?.outerHTML).catch(() => null) : null;
  if (failurePage && !failurePage.isClosed()) await failurePage.screenshot({ path: join(out, 'responsive-failure.png') }).catch(() => {});
  writeFileSync(join(out, 'responsive-failure.json'), JSON.stringify({ before, currentCase, active, rows, extras, errors, error: e.message }, null, 2));throw e;
} finally { if (browser) await browser.close();await new Promise(r => server.close(r)); }
