import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

// Renderer evidence only. Authorization is exercised separately against the real server guards.
export async function runV4Reconciliation({ page, origin, output }) {
  const rows = [],
    emptyHero = new Map(),
    views = [
      [360, 640],
      [375, 667],
      [390, 844],
      [430, 932],
      [768, 1024],
      [1024, 768],
      [1440, 900],
      [1536, 864],
    ];
  let requests = 0,
    blockedAnalytics = 0;
  await page.route("**/api/**", (r) => {
    if (new URL(r.request().url()).pathname === "/api/analytics")
      blockedAnalytics++;
    else requests++;
    return r.abort();
  });
  await page.route("https://example.test/banner.png", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><rect width="300" height="180" fill="#e5dbc9"/><text x="20" y="90" fill="#312c28">Fixture banner</text></svg>',
    }),
  );
  for (const [scenario, key] of [
    ["A", "none"],
    ["B", "attention"],
    ["C", "offers"],
    ["D", "updates"],
    ["E", "flight"],
    ["F", "draft"],
  ])
    for (const [width, height] of views) {
      await page.setViewportSize({ width, height });
      await page.goto(origin + "/preview?scope=preview&experience=v4");
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      const params = new URLSearchParams({
        scope: key === "flight" ? "public" : "preview",
        experience: "v4",
        theme: "bugan",
        lang: "pt",
        communications: "1",
        tourism: "coherent",
        scenario: key,
      });
      if (key === "flight") params.set("seedFlight", "1");
      if (key === "draft") params.set("guides", "draft");
      const path =
        key === "flight"
          ? "/hotel/bugan-recife"
          : key === "draft"
            ? "/preview/guias/52130000-0000-4000-8000-000000000001"
            : "/preview";
      await page.goto(origin + path + "?" + params);
      await page.locator("h1").first().waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${scenario} ${width}`,
      );
      assert.equal(
        await page.locator(".v4-saved-flight").count(),
        0,
        "No independent flight strip",
      );
      if (key === "none") {
        emptyHero.set(
          width,
          await page.locator("[data-v3-hero]").boundingBox(),
        );
        assert.equal(
          await page
            .locator(
              "[data-v4-alerts],[data-v4-offers],[data-v4-updates],[data-home-saved-flight]:visible",
            )
            .count(),
          0,
        );
        assert.equal(await page.locator("[data-editorial]").count(), 3);
        assert.equal(await page.locator(".v3-amenities>div").count(), 4);
        assert.equal(await page.locator(".v3-tourism-cards>a").count(), 4);
      }
      if (key === "attention") {
        const notice = page.locator("[data-v4-alerts]");
        assert.ok(
          (await notice.boundingBox()).height <= 66,
          "Single collapsed notice stays thin",
        );
        const header = page.locator(".v3-header"),
          hero = page.locator("[data-v3-hero]");
        const original = emptyHero.get(width),
          current = await hero.boundingBox(),
          band = await notice.boundingBox();
        assert.ok(
          Math.abs(
            current.y +
              current.height -
              original.y -
              original.height -
              band.height,
          ) <= 1,
          "Notice only adds its own height, preserving the hero composition",
        );
        assert.ok(
          (await notice.boundingBox()).y >=
            (await header.boundingBox()).y +
              (await header.boundingBox()).height -
              1,
        );
        assert.ok(
          (await hero.boundingBox()).y >=
            (await notice.boundingBox()).y +
              (await notice.boundingBox()).height -
              1,
        );
      }
      if (key === "offers") {
        assert.equal(
          await page
            .getByRole("heading", {
              name: "Promoções e novidades",
              exact: true,
            })
            .count(),
          1,
        );
        assert.equal(await page.locator("[data-v4-offers] article").count(), 1);
        assert.equal(
          await page.locator("[data-v4-offers] a").getAttribute("href"),
          "https://example.test/offer",
        );
        assert.equal(
          await page.locator("[data-v4-alerts],[data-v4-updates]").count(),
          0,
        );
        await page
          .locator("[data-v4-offers] img")
          .evaluate((img) => img.decode());
      }
      if (key === "updates") {
        assert.equal(
          await page
            .getByRole("heading", {
              name: "Atualizações do hotel",
              exact: true,
            })
            .count(),
          1,
        );
        assert.equal(
          await page.locator("[data-v4-updates] article").count(),
          1,
        );
        assert.equal(
          await page.locator("[data-v4-alerts],[data-v4-offers]").count(),
          0,
        );
      }
      if (key === "flight") {
        const flight = page.locator("[data-home-saved-flight]:visible");
        await flight.waitFor();
        assert.equal(await flight.count(), 1);
        assert.ok((await flight.innerText()).includes("LA 3565"));
        assert.ok((await flight.innerText()).includes("REC → BSB"));
        assert.equal(
          new URL(await flight.getAttribute("href"), origin).searchParams.get(
            "tab",
          ),
          "meu-voo",
        );
        assert.equal(
          await flight.evaluate(
            (el) =>
              !!el.closest(
                innerWidth < 768
                  ? "[data-public-v4-mobile] .public-v4-tasks"
                  : "[data-v3-accesses]",
              ),
          ),
          true,
        );
      }
      if (key === "draft") {
        assert.equal(
          await page.locator("[data-guide-draft-preview]").count(),
          1,
        );
        assert.equal(
          await page
            .locator("[data-guide-channels] .room-guide-channels [data-guide-channel]")
            .count(),
          221,
        );
        assert.ok(
          (await page.locator(".room-guide-draft-notice").innerText()).includes(
            "não publicado",
          ),
        );
        await page
          .locator(".room-guide-step img")
          .evaluate((img) => img.decode());
        assert.equal(
          await page.getByText("Netflix", { exact: true }).count(),
          1,
        );
      }
      await page.evaluate(() => {
        document.activeElement?.blur();
        window.scrollTo(0, 0);
        document.querySelector("[data-public-internal-body]")?.scrollTo(0, 0);
      });
      await page.screenshot({
        path: join(output, `reconciliation-${scenario}-${width}.png`),
        fullPage: key !== "draft",
      });
      if (key === "attention") {
        const link = page.locator(".v4-important-read");
        await link.focus();
        await page.keyboard.press("Enter");
        await page.locator("[data-communication-directory]").waitFor();
        assert.ok(new URL(page.url()).pathname.endsWith("/explorar/comunicados"));
        assert.ok((await page.locator(".public-communication-body").first().innerText()).includes("Operational details"));
      }
      rows.push({ scenario, width, height, passed: true });
    }
  for (const lang of ["pt", "en", "es"])
    for (let i = 1; i <= 4; i++) {
      await page.goto(
        origin +
          `/preview/guias/52130000-0000-4000-8000-00000000000${i}?scope=preview&experience=v4&guides=draft&lang=${lang}`,
      );
      await page.locator("[data-guide-draft-preview]").waitFor();
      const links = await page
        .locator("[data-analytics-language]")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")));
      assert.ok(links.every((h) => h.startsWith("/preview/guias/")));
      rows.push({ draftGuide: i, lang, passed: true });
    }
  await page.goto(
    origin +
      "/preview/guias/52130000-0000-4000-8000-000000000001?scope=public&guides=draft&experience=v4",
  );
  assert.ok((await page.locator("h1").innerText()).includes("404"));
  assert.equal(await page.locator("[data-guide-draft-preview]").count(), 0);
  rows.push({ publicDraftAbsentInRenderer: true, passed: true });
  assert.equal(requests, 0);
  writeFileSync(
    join(output, "reconciliation-scenarios.json"),
    JSON.stringify(
      {
        scope:
          "Isolated renderer; no real authenticated session or production data mutation",
        rows,
        apiRequests: requests,
        blockedAnalytics,
      },
      null,
      2,
    ),
  );
  return rows;
}
