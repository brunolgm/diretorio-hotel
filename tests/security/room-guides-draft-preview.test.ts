import { state } from "./preview-runtime.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { default: destination } = await import(
  "../../app/preview/[...path]/page.tsx"
);
const id = "52130000-0000-4000-8000-000000000001",
  foreign = "52130000-0000-4000-8000-000000000002";
const manifest = JSON.parse(
  readFileSync("docs/bootstrap/bugan-room-guides-20261030.json", "utf8"),
);
function reset() {
  state.user = true;
  state.active = true;
  state.role = "administrador";
  state.status = "active";
  state.queries = [];
  state.failTable = null;
  state.modules = [
    "core.directory",
    "experience.preview",
    "content.services",
    "content.languages",
  ];
  state.tables = {
    hotel_sections: [
      {
        id,
        hotel_id: "own",
        enabled: false,
        title: "TV source",
        content: "Private native Service description. ".repeat(4),
        service_action_type: "standard",
        url: null,
      },
      { id: foreign, hotel_id: "other", enabled: false },
    ],
    hotel_service_guides: [
      {
        hotel_id: "own",
        service_id: id,
        draft: structuredClone(manifest.guides[0].configuration),
        published: null,
        revision: 6,
      },
      {
        hotel_id: "other",
        service_id: foreign,
        draft: structuredClone(manifest.guides[0].configuration),
        revision: 1,
      },
    ],
    hotel_section_translations: [
      {
        section_id: id,
        language: "en",
        title: "TV draft EN",
        content: "English technical draft. ".repeat(4),
      },
      {
        section_id: id,
        language: "es",
        title: "TV borrador ES",
        content: "Borrador técnico. ".repeat(4),
      },
    ],
  };
}
const visit = (serviceId = id, lang = "pt") =>
  destination({
    params: Promise.resolve({ path: ["guias", serviceId] }),
    searchParams: Promise.resolve({ lang }),
  });
test("disabled own guide is previewed as a draft in PT/EN/ES without changing publication", async () => {
  for (const status of ["active", "suspended"])
    for (const lang of ["pt", "en", "es"]) {
      reset();
      state.status = status;
      const before = JSON.stringify(state.tables);
      const view = await visit(id, lang);
      assert.equal(view.props.guideDraftPreview, true);
      assert.equal(view.props.section.enabled, false);
      assert.equal(view.props.roomGuide.channels.length, 222);
      assert.equal(view.props.roomGuide.channels[0].kind, "review");
      assert.equal(view.props.language, lang);
      assert.equal(
        view.props.section.title,
        lang === "pt"
          ? "TV source"
          : lang === "en"
            ? "TV draft EN"
            : "TV borrador ES",
      );
      assert.equal(view.props.hotel.id, "own");
      assert.equal(JSON.stringify(state.tables), before);
      assert.ok(
        !state.queries.some((q) =>
          String((q as { rpc?: string }).rpc ?? "").startsWith("save"),
        ),
      );
    }
});
test("anonymous, operator, viewer, editor, inactive and archived users cannot open draft preview", async () => {
  for (const role of [
    "anonymous",
    "operador",
    "editor",
    "visualizador",
    "inactive",
    "archived",
  ]) {
    reset();
    if (role === "anonymous") state.user = false;
    else if (role === "inactive") state.active = false;
    else if (role === "archived") state.status = "archived";
    else state.role = role;
    await assert.rejects(() => visit(), /REDIRECT:/);
    assert.ok(
      !state.queries.some(
        (q) =>
          (q as { rpc?: string }).rpc === "get_current_hotel_service_guide",
      ),
    );
  }
});
test("all required modules are checked and foreign/missing/invalid IDs cannot select a tenant", async () => {
  for (const moduleKey of [
    "core.directory",
    "experience.preview",
    "content.services",
    "content.languages",
  ]) {
    reset();
    state.modules = state.modules.filter((k) => k !== moduleKey);
    await assert.rejects(() => visit(), /REDIRECT:/);
  }
  for (const serviceId of [
    foreign,
    "missing",
    "52130000-0000-4000-8000-000000000003",
  ]) {
    reset();
    await assert.rejects(() => visit(serviceId), /NOT_FOUND/);
  }
});
test("draft helper is read only, normal-session scoped and never falls back to service role", () => {
  const source = readFileSync(
    "lib/room-guides/draft-preview.server.ts",
    "utf8",
  );
  assert.match(source, /requireAdminAccess\(['"]administrador['"]\)/);
  assert.match(source, /get_current_hotel_service_guide/);
  assert.match(source, /profile.hotel_id/);
  assert.doesNotMatch(
    source,
    /\.insert\(|\.update\(|\.delete\(|fetch\(|createAdminClient|service_role|p_publish/,
  );
});

test("communication read failure is never represented as an empty optional section", async () => {
 for (const table of ["hotel_announcements", "hotel_promotional_banners"]) {
  reset();state.failTable = table;
  try { await assert.rejects(() => visit(), /Não foi possível carregar as comunicações/); }
  finally {state.failTable = null;}
 }
});
