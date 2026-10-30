import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import * as guides from "../../lib/room-guides.ts";
import * as image from "../../lib/security/image-upload.ts";
const hotel = "5eb7d695-ccf7-4594-b9df-fc46aaa25695",
  service = "52130000-0000-4000-8000-000000000001";
const manifest = JSON.parse(
  readFileSync("docs/bootstrap/bugan-room-guides-20261030.json", "utf8"),
);
function ready() {
  const c = structuredClone(manifest.guides[0].configuration);
  c.applicability.scope = "all";
  c.channels = c.channels.filter(
    (x: { kind: string }) => x.kind === "application",
  );
  return c;
}
test("legacy inventory stays a draft: 222 unique numbers, explicit HD and Netflix application", () => {
  const c = manifest.guides[0].configuration;
  assert.equal(c.channels.length, 222);
  assert.equal(
    new Set(c.channels.map((x: { number: string }) => Number(x.number))).size,
    222,
  );
  assert.equal(
    c.channels.find((x: { number: string }) => x.number === "680").kind,
    "application",
  );
  assert.equal(
    c.channels.find((x: { number: string }) => x.number === "18").quality,
    "unspecified",
  );
  assert.ok(guides.parseRoomGuide(c, hotel, service));
  assert.equal(guides.parseRoomGuide(c, hotel, service, true), null);
  assert.ok(guides.parseRoomGuide(ready(), hotel, service, true));
});
test("publication rejects missing translations, unreviewed channels, unknown fields and foreign media", () => {
  for (const change of [
    (c: ReturnType<typeof ready>) => {
      c.steps[0].body.en = "";
    },
    (c: ReturnType<typeof ready>) => {
      c.channels[0].kind = "review";
    },
    (c: ReturnType<typeof ready>) => {
      c.steps[0].image_path = "other/room-guides/file.png";
    },
    (c: ReturnType<typeof ready>) => {
      c.extra = true;
    },
  ]) {
    const c = ready();
    change(c);
    assert.equal(guides.parseRoomGuide(c, hotel, service, true), null);
  }
});
test("strict URLs and image paths cannot accept credentials, encodings or arbitrary ownership", () => {
  for (const url of [
    "javascript:alert(1)",
    "https://u:p@example.test",
    "https://shre.ink/a",
    " https://example.test",
    "HTTPS://example.test",
    "https://example.test/\nsecret",
  ])
    assert.equal(guides.guideUrl(url), false);
  assert.equal(guides.guideUrl("https://example.test/manual.pdf"), true);
  assert.equal(
    guides.roomGuideImagePath(
      `${hotel}/room-guides/${service}/------------------------------------.png`,
      hotel,
      service,
    ),
    false,
  );
  assert.equal(
    guides.roomGuideImagePath(
      `${hotel}/room-guides/${service}/${service}.png`,
      hotel,
      service,
    ),
    true,
  );
});
test("CSV preview normalizes numeric keys without inventing quality or publishing applications as linear", () => {
  const x = guides.previewGuideChannels(
    "number;name;quality;category;kind\n018;Globo;;;\n18;Duplicate;HD;;linear\n680;Netflix;;;linear",
  );
  assert.equal(x.rows[0].number, "18");
  assert.equal(x.rows[0].quality, "unspecified");
  assert.equal(x.rows[0].kind, "review");
  assert.equal(x.errors.length, 2);
  assert.equal(guides.previewGuideChannels("0;Invalid").errors.length, 1);
  assert.equal(
    guides.previewGuideChannels("539;SporTV HD;HD;;linear").rows[0].quality,
    "HD",
  );
});
const require = createRequire(import.meta.url),
  ts = require("typescript") as typeof import("typescript");
function harness(
  options: {
    denied?: boolean;
    stale?: boolean;
    code?: string;
    ambiguous?: boolean;
    lost?: boolean;
  } = {},
) {
  const events: string[] = [],
    removed: string[] = [];
  let uploaded = "";
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      events.push(name);
      if (name === "get_current_hotel_service_guide")
        return {
          error: options.denied ? { code: "42501" } : null,
          data: options.denied
            ? null
            : [{ hotel_id: hotel, revision: options.stale ? 2 : 1 }],
        };
      assert.equal(name, "save_current_hotel_service_guide");
      assert.equal(args.p_expected_revision, 1);
      if (options.lost) throw Error("transport");
      return {
        error: options.code ? { code: options.code } : null,
        data: options.ambiguous ? null : [{ revision: 2, is_published: false }],
      };
    },
  };
  const storage = {
    upload: async (
      path: string,
      _bytes: unknown,
      config: { upsert: boolean },
    ) => {
      events.push("upload");
      assert.equal(config.upsert, false);
      assert.ok(guides.roomGuideImagePath(path, hotel, service));
      uploaded = path;
      return { error: null };
    },
    remove: async (paths: string[]) => {
      events.push("remove");
      removed.push(...paths);
      return { error: null };
    },
  };
  const mod = { exports: {} };
  runInNewContext(
    ts.transpileModule(readFileSync("lib/room-guides/save.server.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module: mod,
      exports: mod.exports,
      File,
      console,
      JSON,
      require: (name: string) => {
        if (name === "server-only") return {};
        if (name === "node:crypto") return require(name);
        if (name === "@/lib/room-guides") return guides;
        if (name === "@/lib/security/image-upload") return image;
        if (name === "@/lib/security/identifiers")
          return { isUuid: (s: string) => /^[a-f0-9-]{36}$/.test(s) };
        if (name === "@/lib/supabase/admin")
          return {
            createAdminClient: () => {
              events.push("storage-client");
              return { storage: { from: () => storage } };
            },
          };
        throw Error(name);
      },
    },
  );
  const form = new FormData();
  form.set("service_id", service);
  form.set("expected_revision", "1");
  form.set("configuration", JSON.stringify(manifest.guides[0].configuration));
  form.set("step_key", manifest.guides[0].configuration.steps[0].key);
  form.set(
    "image",
    new File(
      [readFileSync(manifest.assets["smart-remote"].path)],
      "remote.webp",
      { type: "image/webp" },
    ),
  );
  return {
    events,
    removed,
    run: () =>
      (
        mod.exports as {
          saveServiceGuide: (c: unknown, f: FormData) => Promise<unknown>;
        }
      ).saveServiceGuide(client, form),
    path: () => uploaded,
  };
}
test("normal authorization and revision precede every Storage operation", async () => {
  for (const options of [{ denied: true }, { stale: true }]) {
    const h = harness(options);
    await assert.rejects(h.run());
    assert.deepEqual(h.events, ["get_current_hotel_service_guide"]);
  }
});
test("image is associated by normal RPC after upload; never upsert or delete an old file", async () => {
  const h = harness();
  await h.run();
  assert.deepEqual(h.events, [
    "get_current_hotel_service_guide",
    "storage-client",
    "upload",
    "save_current_hotel_service_guide",
  ]);
  assert.deepEqual(h.removed, []);
});
test("definite PT409 compensates only its own new image after DB rollback", async () => {
  const h = harness({ code: "PT409" });
  await assert.rejects(h.run());
  assert.deepEqual(h.removed, [h.path()]);
  assert.ok(
    h.events.indexOf("remove") >
      h.events.indexOf("save_current_hotel_service_guide"),
  );
});
test("ambiguous result, transport loss and server errors conservatively retain uploads", async () => {
  for (const o of [{ ambiguous: true }, { lost: true }, { code: "XX000" }]) {
    const h = harness(o);
    await assert.rejects(h.run());
    assert.equal(h.removed.length, 0);
  }
});
