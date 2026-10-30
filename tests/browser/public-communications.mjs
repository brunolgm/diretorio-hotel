import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { join } from "node:path";
export async function runCommunicationsAndFlight({ page, origin, output }) {
  const rows = [];
  let statuses = 0;
  await page.route("**/api/**", (r) => {
    if (new URL(r.request().url()).pathname === "/api/flights/status")
      statuses++;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.route("https://example.test/**", (r) =>
    r.request().url().endsWith("/banner.png")
      ? r.fulfill({
          contentType: "image/png",
          body: readFileSync(
            "docs/references/bugan/public-v3/hero-piscina-real.png",
          ),
        })
      : r.abort(),
  );
  for (const theme of [
    "bugan",
    "grand-mercure",
    "deep-ocean",
    "novotel",
    "mercure",
    "default",
  ])
    for (const lang of ["pt", "en", "es"])
      for (const [width, height] of [
        [360, 640],
        [375, 667],
        [390, 645],
        [390, 844],
        [430, 932],
        [768, 1024],
        [1440, 900],
        [1536, 864],
      ]) {
        console.log(JSON.stringify({ theme, lang, width }));
        await page.setViewportSize({ width, height });
        await page.goto(
          origin +
            "/preview?" +
            new URLSearchParams({
              scope: "preview",
              experience: "v4",
              tourism: "coherent",
              theme,
              lang,
              communications: "1",
            }),
        );
        await page
          .locator("[data-v4-alerts]")
          .waitFor({ timeout: 5000 })
          .catch(async (error) => {
            console.error(
              await page.evaluate(() => ({
                experience: document
                  .querySelector("[data-public-experience]")
                  ?.getAttribute("data-public-experience"),
                body: document.body.innerText.slice(-600),
                markers: [
                  ...document.querySelectorAll(
                    "[data-v4-alerts],[data-v4-offers],[data-v4-updates]",
                  ),
                ].map((e) => ({
                  tag: e.tagName,
                  html: e.outerHTML.slice(0, 100),
                  display: getComputedStyle(e).display,
                  box: e.getBoundingClientRect().toJSON(),
                })),
              })),
            );
            throw error;
          });
        assert.equal(await page.locator("[data-v4-alerts] article").count(), 1);
        assert.equal(
          await page.locator("[data-v4-updates] article").count(),
          2,
        );
        assert.equal(await page.locator("[data-v4-offers] article").count(), 2);
        assert.ok(
          !/DRAFT MUST|EXPIRED MUST|FOREIGN MUST/.test(
            await page.locator("body").innerText(),
          ),
        );
        const overflow = await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter(
              (e) =>
                e.getBoundingClientRect().right > innerWidth + 1 &&
                getComputedStyle(e).position !== "fixed",
            )
            .slice(0, 15)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              right: e.getBoundingClientRect().right,
              width: e.getBoundingClientRect().width,
            })),
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          JSON.stringify(overflow),
        );
        assert.equal(
          await page.locator("[data-home-saved-flight]").count(),
          0,
          "private preview must not read browser personal flight",
        );
        if (theme === "bugan" && lang === "pt")
          await page.screenshot({
            path: join(output, "communications-" + width + ".png"),
            fullPage: true,
          });
        rows.push({
          theme,
          lang,
          width,
          height,
          communications: true,
          passed: true,
        });
      }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    origin +
      "/hotel/bugan-recife?scope=public&experience=v4&theme=bugan&lang=pt&seedFlight=1",
  );
  const card = page.locator("[data-home-saved-flight]:visible");
  await card.waitFor();
  assert.ok((await card.innerText()).includes("LA 3565"));
  assert.equal(statuses, 0, "Home never queries status");
  await page.screenshot({
    path: join(output, "home-saved-flight.png"),
    fullPage: true,
  });
  await page.evaluate(() =>
    window.fixtureFlight.remove(window.fixtureFlight.hotelId),
  );
  await card.waitFor({ state: "hidden" });
  assert.equal(await page.locator("[data-home-saved-flight]").count(), 0);
  await page.goto(
    origin +
      "/hotel/bugan-recife?scope=public&experience=v4&theme=bugan&lang=en&seedFlight=1",
  );
  await card.waitFor();
  const href = await card.locator("a").getAttribute("href");
  assert.ok(href.includes("voos") && href.includes("lang=en"));
  assert.equal(statuses, 0);
  rows.push({
    savedFlight: true,
    remove: true,
    manualOnly: true,
    passed: true,
  });
  await page.evaluate(() => {
    const a = window.fixtureFlight,
      other = "52100000-0000-4000-8000-000000000002";
    a.remove(a.hotelId);
    const created = a.create(other, {
      airline: "AD",
      flightNumber: "4277",
      departureAirport: "REC",
      arrivalAirport: "CGH",
      departureDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      scheduledDepartureTime: "16:40",
    });
    if (created.ok) a.save(other, created.flight);
  });
  await card.waitFor({ state: "hidden" });
  rows.push({ tenantIsolation: true, passed: true });
  // Edit, BFCache-style return and canonical 12h expiry with the browser clock.
  await page.clock.install({ time: new Date() });
  await page.evaluate(() => {
    const a = window.fixtureFlight,
      d = new Date(Date.now() - 12 * 3600000 + 120000),
      pad = (n) => String(n).padStart(2, "0"),
      date =
        d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const f = a.create(a.hotelId, {
      airline: "AD",
      flightNumber: "4277",
      departureAirport: "REC",
      arrivalAirport: "CGH",
      departureDate: date,
      scheduledDepartureTime: pad(d.getHours()) + ":" + pad(d.getMinutes()),
    });
    if (!f.ok) throw Error("fixture expired");
    a.save(a.hotelId, f.flight);
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await card.waitFor();
  assert.ok((await card.innerText()).includes("AD 4277"));
  await page.clock.fastForward(180000);
  await card.waitFor({ state: "hidden" });
  assert.equal(statuses, 0);
  rows.push({ edit: true, bfcacheReturn: true, expiry12h: true, passed: true });
  return rows;
}
