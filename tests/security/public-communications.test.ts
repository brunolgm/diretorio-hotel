import test from "node:test";
import assert from "node:assert/strict";
import {
  publicCommunications,
  communicationEligible,
  publicCommunicationUrl,
} from "../../lib/public-communications.ts";
import type {
  PublicHotelAnnouncement,
  PublicHotelPromotionalBanner,
} from "../../lib/public-hotel-data.ts";
const now = Date.parse("2026-10-30T10:00:00Z");
const row = {
  id: "a",
  hotel_id: "hotel-a",
  title: "Notice",
  body: "Details",
  category: "informativo",
  is_active: true,
  starts_at: null,
  ends_at: null,
  created_at: "2026-10-29",
  updated_at: "2026-10-29",
} as PublicHotelAnnouncement;
test("categories remain distinct, alerts never share a promotion carousel", () => {
  const rows = ["alerta", "manutencao", "informativo", "promocao"].map(
    (category) => ({ ...row, category }),
  );
  const model = publicCommunications("hotel-a", rows, [], now);
  assert.deepEqual(
    model.alerts.map((x) => x.category),
    ["alerta"],
  );
  assert.deepEqual(
    model.updates.map((x) => x.category),
    ["manutencao", "informativo"],
  );
  assert.equal(model.promotions.length, 1);
});
test("tenant, publication, date boundaries, malformed date, scheduled and expired are fail closed", () => {
  for (const changes of [
    { hotel_id: "b" },
    { is_active: false },
    { starts_at: "2026-11-01" },
    { ends_at: "2026-10-20" },
    { starts_at: "garbage" },
  ])
    assert.equal(
      communicationEligible({ ...row, ...changes }, "hotel-a", now),
      false,
    );
  assert.equal(
    communicationEligible(
      {
        ...row,
        starts_at: new Date(now).toISOString(),
        ends_at: new Date(now).toISOString(),
      },
      "hotel-a",
      now,
    ),
    true,
  );
});
test("empty does not manufacture content; similar texts are not deduplicated without canonical relation", () => {
  assert.deepEqual(publicCommunications("hotel-a", [], [], now), {
    alerts: [],
    updates: [],
    promotions: [],
    banners: [],
  });
  assert.equal(
    publicCommunications("hotel-a", [row, { ...row, id: "b" }], [], now).updates
      .length,
    2,
  );
});
test("banner cap is preserved and links reject scripts, credentials and arbitrary browser input", () => {
  assert.equal(
    publicCommunications(
      "hotel-a",
      [],
      Array.from(
        { length: 4 },
        (_, i) =>
          ({
            ...row,
            id: String(i),
          }) as unknown as PublicHotelPromotionalBanner,
      ),
      now,
    ).banners.length,
    3,
  );
  for (const x of [
    "javascript:alert(1)",
    "data:text/html,bad",
    "https://user:pass@example.test/",
    "http://example.test/",
  ])
    assert.equal(publicCommunicationUrl(x), null);
  assert.equal(
    publicCommunicationUrl("https://example.test/offers"),
    "https://example.test/offers",
  );
});
