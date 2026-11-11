// Actual Next -> API -> disposable PostgreSQL. All tenants, rooms and orders are synthetic.
import '../../scripts/bootstrap-runtime.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {seedB23, config} from './fb-b23-seed.mjs';
import {printingLab} from './fb-printing-lab.mjs';

const checks = [];
const check = (value, label) => {assert.ok(value, label); checks.push(label);};
let app, browser;
const contexts = [];
try {
  const lab = await seedB23();
  app = await printingLab(lab.s, 'smartmenu');
  browser = await chromium.launch({channel: 'chrome', headless: true});
  const base = app.base;
  for (const tenant of lab.tenants) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}});
    contexts.push(context);
    await context.route('**/*', route => {
      const host = new URL(route.request().url()).hostname;
      if (!['localhost', '127.0.0.1'].includes(host) && !host.endsWith('.localhost')) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(base + '/hotel/' + tenant.slug + '/room-service');
    await page.locator('[data-smartmenu]').waitFor();
    check(await page.locator('[data-fb-order-outlet]').getAttribute('data-fb-order-outlet') === tenant.room.id, 'dedicated UUID ' + tenant.brand);
    check(await page.getByText('Restaurante Filipe · fixture', {exact: true}).count() === 0, 'Filipe separated ' + tenant.brand);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'actual SSR mobile theme ' + tenant.brand);
    if (tenant.brand !== 'bugan') continue;
    const expand = page.getByRole('button', {name: 'Ver Categoria de homologação', exact: true});
    if (await expand.count()) await expand.click();
    const card = page.locator('[data-fb-order-product="' + tenant.item.id + '"]');
    await card.locator('h3 button').click();
    check(await page.locator('dialog button[type=submit]').isDisabled(), 'server-validated room required without QR');
    await page.getByRole('button', {name: 'Fechar', exact: true}).click();
    await page.goto(base + '/r/' + tenant.roomTokens.valid);
    await page.goto(base + '/hotel/' + tenant.slug + '/room-service');
    await page.getByText('Apartamento validado pelo QR', {exact: true}).waitFor();
    if (await expand.count()) await expand.click();
    await page.locator('[data-fb-order-product="' + tenant.custom.id + '"] h3 button').click();
    await page.locator('dialog button[type=submit]').click();
    check(await page.locator('dialog [role=alert]').isVisible(), 'actual required modifiers enforced');
    await page.getByRole('radio', {name: /Opção A/}).check();
    await page.locator('dialog button[type=submit]').click();
    const quoteResponse = page.waitForResponse(response => response.url().endsWith('/quote'));
    await page.getByRole('button', {name: 'Revisar pedido', exact: true}).click();
    const quote = await (await quoteResponse).json();
    check(quote.total_minor === 1900, 'PostgreSQL authoritative modifier price');
    await page.locator('input[name=first_name]').fill('Hóspede');
    await page.locator('input[name=last_name]').fill('Sintético');
    const confirmResponse = page.waitForResponse(response => response.url().endsWith('/confirm'));
    await page.getByRole('button', {name: 'Confirmar pedido', exact: true}).click();
    const confirmation = await confirmResponse;
    const receipt = await confirmation.json();
    check(confirmation.status() === 200 && receipt.status === 'registered', 'synthetic order persisted before confirmation');
    await page.getByRole('link', {name: 'Acompanhar pedido', exact: true}).click();
    await page.locator('.smartmenu-progress [aria-current=step]').waitFor();
    check(await page.locator('.smartmenu-progress [aria-current=step]').innerText() === 'Registrado — aguardando aceite do hotel', 'actual backend tracking state');
    const tracking = await page.evaluate(async ({id, slug}) => {
      const response = await fetch('/api/fb/orders/' + id + '/' + slug);
      return {status: response.status, data: await response.json()};
    }, {id: receipt.order_id, slug: tenant.slug});
    check(tracking.status === 200 && tracking.data.total_minor === 1900, 'secure receipt access preserved');
    const foreign = lab.tenants.find(other => other.id !== tenant.id);
    const denied = await page.evaluate(async ({id, slug}) => (await fetch('/api/fb/orders/' + id + '/' + slug)).status, {id: receipt.order_id, slug: foreign.slug});
    check([403, 404].includes(denied), 'cross-tenant tracking denied');
    const cancelled = await tenant.admin.client.rpc('cancel_current_hotel_fb_order_v1', {p_order_id: receipt.order_id, p_expected_revision: 1, p_reason_code: 'guest_request'});
    check(!cancelled.error, 'existing staff cancellation contract');
    await page.reload();
    await page.getByText('Pedido cancelado.', {exact: true}).waitFor();
    check(await page.locator('[data-cancellation-contact]').getByText('Pedido cancelado.', {exact: true}).isVisible(), 'cancellation reflects committed backend state');
    // Local operational closure must affect the same dedicated route immediately.
    await config(tenant.admin, 'outlet', {mode: 'native', accepting: false, pickup: false, room_delivery: true, default_sector_id: tenant.kitchen.id}, tenant.room.id, tenant.roomCfg.revision);
    await page.goto(base + '/hotel/' + tenant.slug + '/room-service');
    check(await page.getByRole('button', {name: 'Revisar pedido', exact: true}).isDisabled(), 'closed actual outlet cannot checkout');
  }
  const report = {passed: checks.length, failed: 0, actualPostgreSQL: true, productionAccess: false, syntheticOrderOnly: true, physicalPrinting: false, checks};
  writeFileSync(join(lab.s.dir, 'smartmenu-integration.json'), JSON.stringify(report, null, 2));
  writeFileSync('out/smartmenu-integration.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({passed: checks.length, failed: 0, actualPostgreSQL: true}));
} finally {
  for (const context of contexts) await context.close();
  if (browser) await browser.close();
  if (app) await app.stop();
}
