import assert from "node:assert/strict";
import { join } from "node:path";
export async function runRoomGuides({ page, origin, output }) {
  const rows = [],
    views = [
      [360, 640],
      [375, 667],
      [390, 645],
      [390, 844],
      [430, 932],
      [768, 1024],
      [1440, 900],
      [1536, 864],
    ];
  for (const theme of [
    "bugan",
    "grand-mercure",
    "deep-ocean",
    "novotel",
    "mercure",
    "default",
  ])
    for (const lang of ["pt", "en", "es"])
      for (const [width, height] of views) {
        await page.setViewportSize({ width, height });
        await page.goto(
          origin +
            "/preview/servicos/52130000-0000-4000-8000-000000000001?" +
            new URLSearchParams({
              scope: "preview",
              experience: "v4",
              guides: "1",
              theme,
              lang,
            }),
        );
        await page.locator("[data-room-guide]").waitFor();
        const guide = page.locator("[data-room-guide]");
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        const image = guide.locator("img");
        await image.waitFor();
        await image.evaluate(async (img) => {
          await img.decode();
        });
        assert.ok(await image.evaluate((img) => img.naturalHeight > 400));
        const next =
          lang === "en" ? "Next" : lang === "es" ? "Siguiente" : "Próximo";
        await guide.getByRole("button", { name: next, exact: true }).click();
        assert.ok(
          (await guide.locator("[role=status]").first().innerText()).includes(
            "2",
          ),
        );
        assert.equal(
          await guide
            .locator("h3")
            .evaluate((e) => document.activeElement === e),
          true,
        );
        const search = guide.getByRole("searchbox");
        await search.fill("539");
        assert.equal(await guide.locator(".room-guide-channels li").count(), 1);
        assert.ok(
          (await guide.locator(".room-guide-channels").innerText()).includes(
            "SporTV HD",
          ),
        );
        await search.fill("Globo");
        assert.ok(
          (await guide.locator(".room-guide-channels li").count()) >= 2,
        );
        await guide.locator("select").selectOption("HD");
        assert.ok(
          (await guide.locator(".room-guide-channels li").count()) >= 1,
        );
        await guide.locator("select").selectOption("SD");
        assert.equal(await guide.locator(".room-guide-channels li").count(), 1);
        await search.fill("Netflix");
        assert.equal(await guide.locator(".room-guide-channels li").count(), 0);
        assert.ok(await guide.getByText("Netflix", { exact: true }).count());
        await search.fill("");
        await guide.locator("select").selectOption("all");
        if (theme === "bugan" && lang === "pt")
          await page.screenshot({
            path: join(output, `room-guide-${width}x${height}.png`),
            fullPage: true,
          });
        rows.push({
          theme,
          lang,
          width,
          height,
          steps: true,
          channels: true,
          passed: true,
        });
      }
  for (let i = 2; i <= 4; i++) {
    await page.goto(
      origin +
        `/preview/servicos/52130000-0000-4000-8000-00000000000${i}?scope=preview&experience=v4&guides=1`,
    );
    await page.locator("[data-room-guide]").waitFor();
    assert.ok(!(await page.locator("body").innerText()).includes("404"));
    rows.push({ guide: i, passed: true });
  }
  await page.goto(
    origin + "/preview?scope=preview&experience=v4&guideEditor=1",
  );
  await page.locator("[data-guide-editor] summary").click();
  const csv = page.getByLabel("CSV: number;name;quality;category;kind");
  await csv.fill("18;Globo;SD;;linear\n018;Duplicate;HD;;linear");
  await page.getByRole("button", { name: "Validar e pré-visualizar" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Aplicar ao rascunho" })
      .isDisabled(),
    true,
  );
  await csv.fill(
    "18;Globo;SD;;linear\n501;Globo HD;HD;;linear\n680;Netflix;unspecified;;application",
  );
  await page.getByRole("button", { name: "Validar e pré-visualizar" }).click();
  await page.getByRole("button", { name: "Aplicar ao rascunho" }).click();
  await page
    .getByRole("button", { name: "Salvar rascunho", exact: true })
    .click();
  await page.waitForFunction(() => document.body.dataset.guideSaved);
  const saved = JSON.parse(
    await page.locator("body").getAttribute("data-guide-saved"),
  );
  assert.equal(saved.channels.length, 3);
  assert.equal(saved.channels[2].kind, "application");
  assert.equal(saved.applicability.scope, "unconfirmed");
  rows.push({
    adminImportPreview: true,
    duplicates: true,
    draftOnly: true,
    passed: true,
  });
  return rows;
}
