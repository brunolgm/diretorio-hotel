import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const { prepareRoomGuides } = await import(
  pathToFileURL(resolve("scripts/prepare-room-guides-core.mjs")).href
);
const manifest = JSON.parse(
  readFileSync("docs/bootstrap/bugan-room-guides-20261030.json", "utf8"),
);
function fixture(
  o: {
    moduleOff?: boolean;
    foreign?: boolean;
    collision?: boolean;
    published?: boolean;
    ambiguous?: boolean;
  } = {},
) {
  const hotelId = manifest.hotelId,
    rows: {
      source_key: string;
      service_id: string;
      revision: number;
      draft: Record<string, unknown>;
      published: unknown;
    }[] = [],
    calls: string[] = [];
  const services = [
    {
      id: "old",
      title: o.collision ? "TV e Canais" : "Existing operational content",
      enabled: true,
    },
  ];
  const profiles = [
    {
      id: "karoline",
      email: "heloisa65@msn.com",
      role: "administrador",
      is_active: true,
    },
    {
      id: "user",
      email: "libguestbugan@yahoo.com",
      role: "administrador",
      is_active: true,
    },
  ];
  const modules = [
    { module_key: "content.services", is_enabled: !o.moduleOff },
    { module_key: "content.languages", is_enabled: true },
  ];
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "user", email: "libguestbugan@yahoo.com" } },
        error: null,
      }),
    },
    from: (name: string) => {
      const filters: Record<string, string> = {};
      const result = () => ({
        data:
          name === "profiles"
            ? filters.id
              ? {
                  hotel_id: o.foreign ? "other" : hotelId,
                  role: "administrador",
                  is_active: true,
                }
              : structuredClone(profiles)
            : name === "hotels"
              ? {
                  id: hotelId,
                  platform_status: "active",
                  slug: "bugan-recife",
                  subdomain: "buganrecife",
                }
              : name === "hotel_sections"
                ? structuredClone(services)
                : name === "hotel_service_guides"
                  ? structuredClone(rows)
                  : [],
        error: null,
      });
      const q = {
        select: () => q,
        eq: (k: string, v: string) => {
          filters[k] = v;
          return q;
        },
        order: () => q,
        single: async () => result(),
        then: (done: (v: unknown) => void) =>
          Promise.resolve(result()).then(done),
      };
      return q;
    },
    rpc: async (name: string, args: { p_service_id: string }) =>
      name === "get_current_hotel_modules"
        ? { data: modules, error: null }
        : {
            data: [
              {
                hotel_id: hotelId,
                ...structuredClone(
                  rows.find((r) => r.service_id === args.p_service_id),
                ),
              },
            ],
            error: null,
          },
  };
  const api = async (
    payload:
      | FormData
      | {
          operation: string;
          source_key: string;
          configuration: Record<string, unknown>;
          title: { pt: string };
        },
  ) => {
    if (payload instanceof FormData) {
      calls.push("save");
      const row = rows.find((r) => r.service_id === payload.get("service_id"))!;
      assert.equal(Number(payload.get("expected_revision")), row.revision);
      row.draft = JSON.parse(String(payload.get("configuration")));
      const steps = row.draft.steps as {
        key: string;
        image_path: string | null;
      }[];
      if (payload.get("image"))
        steps.find((s) => s.key === payload.get("step_key"))!.image_path =
          `${hotelId}/room-guides/${row.service_id}/fixture.webp`;
      row.revision++;
      return { status: "guide_draft_saved" };
    }
    calls.push("create");
    if (o.ambiguous) throw Error("transport");
    const id = "guide-" + rows.length;
    rows.push({
      source_key: payload.source_key,
      service_id: id,
      revision: 1,
      draft: structuredClone(payload.configuration),
      published: o.published ? {} : null,
    });
    services.push({ id, title: payload.title.pt, enabled: false });
    return { status: "guide_prepared", service_id: id };
  };
  const assets = {
    file: async () =>
      new File(["synthetic"], "synthetic.webp", { type: "image/webp" }),
    verifyRemote: async () => true,
  };
  return {
    run: () => prepareRoomGuides({ client, manifest, api, assets }),
    calls,
    rows,
    services,
  };
}
test("draft preparation is idempotent and preserves existing services", async () => {
  const f = fixture();
  const first = await f.run();
  assert.equal(first.created, 4);
  assert.equal(first.imagesUploaded, 2);
  assert.equal(first.channelRecords, 222);
  assert.equal(f.services[0].enabled, true);
  assert.equal(
    f.services.slice(1).every((s) => !s.enabled),
    true,
  );
  const count = f.calls.length;
  const second = await f.run();
  assert.equal(second.created, 0);
  assert.equal(second.imagesUploaded, 0);
  assert.equal(f.calls.length, count);
});
test("all authorization/module/collision checks precede writes", async () => {
  for (const options of [
    { moduleOff: true },
    { foreign: true },
    { collision: true },
  ]) {
    const f = fixture(options);
    await assert.rejects(f.run());
    assert.deepEqual(f.calls, []);
  }
});
test("unexpected publication or transport ambiguity halts without deletion or retry", async () => {
  for (const options of [{ published: true }, { ambiguous: true }]) {
    const f = fixture(options);
    await assert.rejects(f.run());
    assert.deepEqual(f.calls, ["create"]);
  }
});
