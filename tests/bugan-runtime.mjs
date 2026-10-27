/* Local synthetic component QA, never a production route or an authenticated tenant test.
 * Requires Playwright (BUGAN_PLAYWRIGHT_MODULE may point to a temporary installation)
 * and Edge. Installs a temporary dev-only fixture route, starts local Next, then removes it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.BUGAN_PLAYWRIGHT_MODULE
  ? pathToFileURL(path.join(process.env.BUGAN_PLAYWRIGHT_MODULE, 'index.mjs')).href
  : 'playwright');
const root = process.cwd();
const route = path.join(root, 'app/bugan-qa-local/page.tsx');
const output = path.join(root, 'docs/evidence/bugan');
const origin = 'http://127.0.0.1:3107';
const fixture = fs.readFileSync(path.join(root, 'tests/fixtures/bugan-visual-page.tsx'));

async function main() {
  // An already running QA server may be reused for an interactive local iteration.
  const reuse = process.argv.includes('--reuse');
  if (!reuse && fs.existsSync(route)) throw Error('QA route already exists; refusing to overwrite');
  if (!reuse) { fs.mkdirSync(path.dirname(route), { recursive: true }); fs.writeFileSync(route, fixture); }
  let server;
  let browser;
  const results = [];
  const errors = [];
  try {
    if (!reuse) {
      server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3107'], {
        cwd: root, stdio: 'ignore', windowsHide: true,
        env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-visual-fixture' },
      });
      let ready = false;
      for (let i = 0; i < 60; i++) {
        try { if ((await fetch(`${origin}/bugan-qa-local`)).ok) { ready = true; break; } } catch { /* local server is still starting */ }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      assert.ok(ready, 'local dev server did not start');
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (request) => {
      const url = new URL(request.request().url());
      // No APIs, analytics, third-party assets or remote writes in this harness.
      return url.origin === origin && !url.pathname.startsWith('/api/') ? request.continue() : request.abort();
    });
    fs.mkdirSync(output, { recursive: true });
    const visit = async (query, width = 390, height = 844) => {
      await page.setViewportSize({ width, height });
      const response = await page.goto(`${origin}/bugan-qa-local?${query}`);
      assert.equal(response.status(), 200);
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' }); // dev toolbar only
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow: ${query}, ${width}`);
    };
    for (const [name, width, height, query] of [
      ['public-390', 390, 844, 'banner=yes&flights=yes&room=yes'],
      ['public-430', 430, 932, 'lang=es&banner=yes&image=yes'],
      ['public-desktop', 1440, 900, 'lang=en&full=yes&banner=yes'],
      ['admin-390', 390, 844, 'admin=yes'],
      ['admin-desktop', 1440, 900, 'admin=yes'],
    ]) {
      await visit(query, width, height);
      await page.screenshot({ path: path.join(output, `${name}.png`) });
      results.push({ name, width, height, status: 200, overflow: false });
      if (name === 'admin-390') {
        const trigger = page.getByRole('button', { name: 'Abrir menu administrativo' });
        await trigger.click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor({ state: 'visible' });
        await page.waitForFunction(() => Boolean(document.activeElement.closest('[role="dialog"]')));
        for (let i = 0; i < 25; i++) {
          await page.keyboard.press('Tab');
          // The dialog's focus guards settle on the next animation frame.
          await page.waitForFunction(() => Boolean(document.activeElement.closest('[role="dialog"]')), null, { timeout: 2000 });
        }
        await page.screenshot({ path: path.join(output, 'admin-drawer-390.png') });
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.ok(await trigger.evaluate((element) => element === document.activeElement), 'focus not restored');
        results.push({ drawerEscape: true, focusTrapped: true, focusRestored: true });
      }
    }
    for (const width of [320, 360, 390, 430]) for (const lang of ['pt', 'en', 'es']) for (const cards of [1, 2, 3, 4, 5, 6]) {
      await visit(`lang=${lang}&cards=${cards}&full=yes`, width);
      assert.equal(await page.locator('.public-compact-experience .hotel-theme-card').count(), cards);
    }
    for (const query of ['empty=yes', 'area=informacoes', 'area=turismo', 'flightpage=yes', 'subdomain=yes', 'theme=grand-mercure', 'theme=novotel', 'theme=mercure', 'theme=midnight-slate']) {
      await visit(query);
      results.push({ query, status: 200, overflow: false });
    }
    await visit('empty=yes');
    assert.equal(await page.locator('[data-public-flight-home-card]').count(), 0);
    assert.equal(await page.locator('iframe[src*="gptmaker"]').count(), 0);
    await visit('flights=yes');
    assert.equal(await page.locator('[data-public-flight-home-card]').count(), 1);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    assert.ok(await page.evaluate(() => document.querySelector('footer').getBoundingClientRect().bottom <= document.querySelector('.public-bottom-dock').getBoundingClientRect().top), 'dock covers footer');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'runtime.json'), JSON.stringify({ fixtureOnly: true, viewportLanguageCardCombinations: 72, results, errors }, null, 2) + '\n');
    console.log('PASS: 72 viewport/language/card cases, 5 themes, drawer focus/Escape, optional flights, dock; synthetic fixtures only');
  } finally {
    await browser?.close();
    if (server) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else server.kill();
    }
    if (!reuse && fs.existsSync(route) && fs.readFileSync(route).equals(fixture)) {
      fs.unlinkSync(route);
      fs.rmdirSync(path.dirname(route));
      // Next dev caches imports for removed routes; remove only this generated
      // validator when it still refers to our temporary fixture.
      const validator = path.join(root, '.next/dev/types/validator.ts');
      if (fs.existsSync(validator) && fs.readFileSync(validator, 'utf8').includes('/bugan-qa-local')) fs.unlinkSync(validator);
    }
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
