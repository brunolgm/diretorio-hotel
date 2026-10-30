import { createHash } from "node:crypto";
export const stable = (x) =>
  JSON.stringify(
    Array.isArray(x)
      ? x.map((v) => JSON.parse(stable(v)))
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map((k) => [k, JSON.parse(stable(x[k]))]),
          )
        : x,
  );
const assert = (ok, code) => {
    if (!ok) throw { code };
  },
  digest = (x) => createHash("sha256").update(stable(x)).digest("hex");
export async function prepareRoomGuides({
  client,
  manifest,
  api,
  assets,
  progress = () => {},
}) {
  let attempted = false,
    created = 0,
    images = 0;
  const state = (stage, operation) =>
    progress({ stage, operation, writesAttempted: attempted });
  const read = async (operation, query) => {
    state(attempted ? "readback" : "preflight", operation);
    const r = await query;
    assert(!r.error, "READ_FAILED");
    return r.data;
  };
  assert(
    manifest.version === 1 &&
      manifest.hotelId === "5eb7d695-ccf7-4594-b9df-fc46aaa25695" &&
      manifest.expectedLifecycle === "active" &&
      manifest.publication === false &&
      manifest.guides.length === 4,
    "MANIFEST_INVALID",
  );
  const user = await client.auth.getUser();
  assert(
    !user.error && user.data.user?.email === "libguestbugan@yahoo.com",
    "ACCOUNT_MISMATCH",
  );
  const profile = await read(
    "profile.read",
    client
      .from("profiles")
      .select("hotel_id,role,is_active")
      .eq("id", user.data.user.id)
      .single(),
  );
  assert(
    profile.hotel_id === manifest.hotelId &&
      profile.role === "administrador" &&
      profile.is_active,
    "AUTHORIZATION_REQUIRED",
  );
  const modules = await read(
    "get_current_hotel_modules",
    client.rpc("get_current_hotel_modules"),
  );
  assert(
    ["content.services", "content.languages"].every((k) =>
      modules.some((m) => m.module_key === k && m.is_enabled === true),
    ),
    "MODULES_REQUIRED",
  );
  const inspect = async () => {
    const hotel = await read(
      "hotel.read",
      client
        .from("hotels")
        .select(
          "id,name,slug,subdomain,brand_code,platform_status,theme_preset",
        )
        .eq("id", manifest.hotelId)
        .single(),
    );
    assert(
      hotel.platform_status === "active" &&
        hotel.slug === "bugan-recife" &&
        hotel.subdomain === "buganrecife",
      "LIFECYCLE_CONFLICT",
    );
    const profiles = await read(
      "administrators.read",
      client
        .from("profiles")
        .select("id,email,role,is_active")
        .eq("hotel_id", manifest.hotelId),
    );
    assert(
      ["heloisa65@msn.com", "libguestbugan@yahoo.com"].every((email) =>
        profiles.some(
          (p) => p.email === email && p.is_active && p.role === "administrador",
        ),
      ),
      "ADMINISTRATORS_CONFLICT",
    );
    const services = await read(
      "services.read",
      client
        .from("hotel_sections")
        .select("*")
        .eq("hotel_id", manifest.hotelId)
        .order("id"),
    );
    const media = await read(
      "media.read",
      client
        .from("hotel_public_experience_media")
        .select("*")
        .eq("hotel_id", manifest.hotelId)
        .order("slot"),
    );
    return { hotel, profiles, services, media };
  };
  const before = await inspect();
  const existing = await read(
    "guides.read",
    client
      .from("hotel_service_guides")
      .select("source_key,service_id,revision,draft,published")
      .eq("hotel_id", manifest.hotelId),
  );
  for (const entry of manifest.guides) {
    assert(
      entry.configuration.applicability.scope === "unconfirmed",
      "MANIFEST_INVALID",
    );
    if (!existing.some((g) => g.source_key === entry.key))
      assert(
        !before.services.some(
          (s) =>
            s.title.trim().toLowerCase() ===
            entry.title.pt.trim().toLowerCase(),
        ),
        "EXISTING_SERVICE_CONFLICT",
      );
  }
  // No writes before all scope/data/media preflights have passed.
  for (const entry of manifest.guides) {
    let row = existing.find((g) => g.source_key === entry.key);
    if (!row) {
      state("prepare", "create_current_hotel_room_guide");
      attempted = true;
      const made = await api({
        operation: "prepare",
        source_key: entry.key,
        title: entry.title,
        content: entry.content,
        configuration: entry.configuration,
      });
      assert(made.status === "guide_prepared", "WRITE_UNCONFIRMED");
      row = { service_id: made.service_id };
      created++;
    }
    const get = async () => {
      const r = await read(
        "get_current_hotel_service_guide",
        client.rpc("get_current_hotel_service_guide", {
          p_service_id: row.service_id,
        }),
      );
      assert(r?.[0]?.hotel_id === manifest.hotelId, "TENANT_CONFLICT");
      return r[0];
    };
    let current = await get();
    assert(!current.published, "PUBLICATION_CONFLICT");
    const stripped = (config) => ({
      ...config,
      steps: config.steps.map((s) => ({ ...s, image_path: null })),
    });
    assert(
      stable(stripped(current.draft)) === stable(entry.configuration),
      "DRAFT_CONFLICT",
    );
    const mapped = {};
    for (const [stepKey, assetKey] of Object.entries(entry.images)) {
      current = await get();
      const step = current.draft.steps.find((s) => s.key === stepKey);
      assert(step, "DRAFT_CONFLICT");
      if (step.image_path) {
        assert(
          await assets.verifyRemote(
            step.image_path,
            row.service_id,
            manifest.assets[assetKey],
          ),
          "MEDIA_CONFLICT",
        );
        mapped[assetKey] = step.image_path;
        continue;
      }
      const config = structuredClone(current.draft),
        target = config.steps.find((s) => s.key === stepKey);
      const form = new FormData();
      form.set("service_id", row.service_id);
      form.set("expected_revision", String(current.revision));
      form.set("publish", "false");
      if (mapped[assetKey]) target.image_path = mapped[assetKey];
      else {
        form.set("step_key", stepKey);
        form.set("image", await assets.file(manifest.assets[assetKey]));
      }
      form.set("configuration", JSON.stringify(config));
      state("images", "save_current_hotel_service_guide");
      attempted = true;
      const saved = await api(form);
      assert(saved.status === "guide_draft_saved", "WRITE_UNCONFIRMED");
      const confirmed = await get();
      const path = confirmed.draft.steps.find(
        (s) => s.key === stepKey,
      )?.image_path;
      assert(
        path &&
          (await assets.verifyRemote(
            path,
            row.service_id,
            manifest.assets[assetKey],
          )),
        "MEDIA_UNCONFIRMED",
      );
      if (!mapped[assetKey]) images++;
      mapped[assetKey] = path;
    }
    current = await get();
    assert(
      !current.published &&
        stable(stripped(current.draft)) === stable(entry.configuration),
      "WRITE_UNCONFIRMED",
    );
  }
  const after = await inspect(),
    beforeIds = new Set(before.services.map((s) => s.id));
  assert(
    digest(after.services.filter((s) => beforeIds.has(s.id))) ===
      digest(before.services),
    "SERVICES_CHANGED",
  );
  assert(
    digest(before.hotel) === digest(after.hotel) &&
      digest(before.profiles) === digest(after.profiles) &&
      digest(before.media) === digest(after.media),
    "PROTECTED_STATE_CHANGED",
  );
  assert(
    after.services
      .filter((s) => !beforeIds.has(s.id))
      .every((s) => s.enabled === false),
    "UNEXPECTED_PUBLICATION",
  );
  const finalModules = await read(
    "get_current_hotel_modules",
    client.rpc("get_current_hotel_modules"),
  );
  assert(digest(modules) === digest(finalModules), "MODULES_CHANGED");
  return {
    status: "room_guides_drafts_confirmed",
    hotelId: manifest.hotelId,
    guides: 4,
    created,
    imagesUploaded: images,
    channelRecords: manifest.guides[0].configuration.channels.length,
    publication: false,
    lifecycle: "active",
    operationalReviewRequired: true,
    existingServicesPreserved: true,
    administratorsPreserved: true,
    googleUsed: false,
    airlabsUsed: false,
  };
}
