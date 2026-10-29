// Run with TOOL_NODE_MODULES pointing to temporary esbuild/playwright packages.
// No project dependencies, credentials, Next server, database or provider required.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
const require = createRequire(import.meta.url);
const toolRequire = createRequire(join(process.env.TOOL_NODE_MODULES, 'package.json'));
const { build } = toolRequire('esbuild');
const { chromium } = require('playwright');
const root = process.cwd();
const output = resolve('out/flight-center-compact');
mkdirSync(output, { recursive: true });
const checkpoint = '88d6877440d669e13e72c0c6005c3cea0952262e';
const changed = ['components/public/guest-flight-manager.tsx', 'components/public/guest-flight-planning.tsx', 'components/public/guest-flight-status.tsx', 'components/public/hotel-public-flight-center.tsx', 'lib/public-flight-center-copy.ts'];
const baseline = Object.fromEntries(changed.map(path => [resolve(path), execFileSync('git', ['show', `${checkpoint}:${path}`], { encoding: 'utf8' })]));
for (const version of ['before', 'after']) {
  await build({ entryPoints: ['tests/browser/flight-center-fixture.tsx'], outfile: join(output, `${version}.js`), bundle: true, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    plugins: [{ name: 'fixture-assets', setup(b) { b.onLoad({ filter: /\.png$/ }, args => ({ contents: `export default ${JSON.stringify({ src: `data:image/png;base64,${readFileSync(args.path).toString('base64')}`, width: 1000, height: 1000 })}`, loader: 'js' })); } }, ...(version === 'before' ? [{ name: 'checkpoint', setup(b) { b.onLoad({ filter: /\.(tsx|ts)$/ }, args => baseline[args.path] ? { contents: baseline[args.path], loader: args.path.endsWith('tsx') ? 'tsx' : 'ts', resolveDir: resolve(args.path, '..') } : undefined); } }] : [])],
  });
}
// Include checkpoint classes so the same generated CSS styles both versions.
writeFileSync(join(output, 'baseline.html'), Object.values(baseline).join('\n'));
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const css = await postcss([tailwind()]).process(readFileSync('app/globals.css', 'utf8') + `\n@source "../out/flight-center-compact/baseline.html";`, { from: resolve('app/globals.css') });
writeFileSync(join(output, 'style.css'), css.css);
const server = createServer((req, res) => {
  const requested = new URL(req.url, 'http://localhost');
  const path = requested.pathname === '/_next/image' ? requested.searchParams.get('url') || '' : requested.pathname;
  if (['/before.js', '/after.js', '/style.css'].includes(path)) {
    res.setHeader('Content-Type', path.endsWith('.css') ? 'text/css' : 'text/javascript');
    res.end(readFileSync(join(output, path.slice(1))));
  } else if (path.startsWith('/brand/') && !path.includes('..') && existsSync(join(root, 'public', path))) {
    res.setHeader('Content-Type', path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/svg+xml'); res.end(readFileSync(join(root, 'public', path)));
  } else {
    const version = path === '/before' ? 'before' : 'after';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'");
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/${version}.js"></script></body></html>`);
  }
});
await new Promise(resolve => server.listen(process.argv.includes('--serve') ? 4173 : 4174, '127.0.0.1', resolve));
console.log('Fixture server: http://127.0.0.1:4173/after');
if (process.argv.includes('--serve')) await new Promise(() => {});
const browser = await chromium.launch({ headless: true,channel:process.env.V3_BROWSER_CHANNEL??'msedge' });
const rows = [];
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  if(process.argv.includes('--form'))await page.clock.install({time:new Date('2026-09-09T18:00:00Z')});else await page.clock.setFixedTime(new Date('2026-09-09T18:00:00Z'));
  async function visit(version, query) {
    await page.goto(`http://127.0.0.1:4174/${version}?${query}`);
    await page.locator('[data-saved-guest-flight]').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-guest-flight-status]')?.getAttribute('aria-busy') === 'false');
    if (!query.includes('generic')) await page.locator('[data-flight-recommendation]').waitFor();
  }
  if(process.argv.includes('--form')){
    const {runFlightForm}=await import('./flight-form-v4.mjs');rows.push(...await runFlightForm({page,output}));
  }else{
  for (const theme of ['grand-mercure', 'novotel', 'mercure', 'default']) for (const lang of ['pt', 'en', 'es']) for (const width of [320, 360, 390, 430, ...(theme === 'grand-mercure' ? [1440] : [])]) {
    await page.setViewportSize({ width, height: 900 });
    const query = new URLSearchParams({ theme, lang, scenario: 'outside' });
    const heights = {};
    for (const version of ['before', 'after']) {
      await visit(version, query.toString());
      heights[version] = await page.locator('[data-saved-guest-flight]').evaluate(el => Math.round(el.getBoundingClientRect().height));
      if (version === 'after') {
        assert.equal(await page.locator('[data-flight-calculation]').getAttribute('open'), null);
        assert.equal(await page.locator('[data-analytics-action="breakfast_box"]').count(), 0);
        assert.equal(await page.locator('[data-flight-service-list] li').count(), 3);
        assert.ok(await page.locator('[data-recommendation-basis]').isVisible());
        assert.ok(await page.locator('[data-flight-recommendation] time').isVisible());
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        const calls = await page.evaluate(() => window.fixtureCalls.length);
        const summary = page.locator('[data-flight-calculation] summary');
        await summary.focus(); await page.keyboard.press('Enter');
        assert.equal(await page.locator('[data-flight-calculation] dl').isVisible(), true);
        await page.keyboard.press('Space');
        assert.equal(await page.locator('[data-flight-calculation] dl').isVisible(), false);
        assert.equal(await page.evaluate(() => window.fixtureCalls.length), calls);
        const service = page.locator('[data-flight-service-list] li').last();
        await service.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        assert.ok(await service.evaluate(el => {
          const r = el.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.bottom - 2);
          return r.top >= 0 && r.bottom <= innerHeight && el.contains(top);
        }), `${theme} ${lang} ${width}: last service obscured`);
      }
      if (theme === 'grand-mercure' && lang === 'pt' || version === 'after' && width === 320) {
        await page.screenshot({ path: join(output, `${version}-${theme}-${lang}-${width}-bottom.png`), fullPage: true });
        await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.grand-mercure-scroll-region')?.scrollTo(0, 0); });
        await page.screenshot({ path: join(output, `${version}-${theme}-${lang}-${width}.png`), fullPage: true });
      }
    }
    rows.push({ theme, lang, width, ...heights, reduction: heights.before - heights.after });
  }
  await page.setViewportSize({ width: 390, height: 900 });
  for (const scenario of ['external', 'not_found', 'service_unavailable', 'rate_limited', 'generic']) {
    await visit('after', `scenario=${scenario}`);
    if (scenario === 'external') {
      assert.equal(await page.locator('[data-manual-flight-summary]').count(), 0);
      assert.match(await page.locator('[data-manual-flight-compact]').innerText(), /23:15/);
      assert.match(await page.locator('[data-flight-operational-status]').innerText(), /Atualização disponível/);
      assert.match(await page.locator('[data-recommendation-basis]').innerText(), /AirLabs/);
      assert.match(await page.locator('[data-guest-flight-status]').innerText(), /23:45/);
      const stored = await page.evaluate(() => localStorage.getItem('libguest:flight:50200000-0000-4000-8000-000000000001:v1'));
      assert.equal(JSON.parse(stored).scheduledDepartureTime, '23:15');
    } else if (scenario !== 'generic') {
      assert.equal(await page.getByText('Status não verificado', { exact: true }).count(), 1);
      const message = { not_found: 'Nenhum voo correspondente', service_unavailable: 'Não foi possível atualizar', rate_limited: 'temporariamente limitadas' }[scenario];
      assert.ok((await page.locator('[data-guest-flight-status]').innerText()).includes(message));
    } else assert.equal(await page.locator('[data-flight-recommendation]').count(), 0);
  }
  for (let count = 0; count <= 4; count++) {
    await visit('after', `services=${count}`);
    assert.equal(await page.locator('[data-flight-service-list] li').count(), count);
  }
  await visit('after', 'scenario=outside');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Adicionar ao calendário' }).click();
  assert.match((await download).suggestedFilename(), /\.ics$/);
  assert.match(await page.getByRole('link', { name: 'Abrir rota para o aeroporto' }).getAttribute('href'), /google.com\/maps\/dir/);
  assert.ok(await page.getByRole('link', { name: 'Consultar voo no site oficial' }).isVisible());
  await page.getByRole('button', { name: 'Editar voo' }).click();
  assert.equal(await page.locator('#guest-flight-flightNumber').inputValue(), '3530');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Remover voo' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('libguest:flight:50200000-0000-4000-8000-000000000001:v1')), null);
  }
  assert.deepEqual(errors, []);
  writeFileSync(join(output, 'measurements.json'), JSON.stringify(rows, null, 2));
  console.log(JSON.stringify({ passed: true, comparisons: rows.length, rows: rows.filter(r => r.theme === 'grand-mercure' && r.lang === 'pt'), browserErrors: errors }, null, 2));
} finally { await browser.close(); server.close(); }
