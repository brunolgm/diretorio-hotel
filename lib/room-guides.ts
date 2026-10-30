export type GuideText = { pt: string; en: string; es: string };
export type GuideChannel = {
  number: string;
  name: string;
  quality: "SD" | "HD" | "unspecified";
  category: string | null;
  kind: "linear" | "application" | "review";
};
export type RoomGuide = {
  version: 1;
  category: "tv" | "shower" | "air_conditioning" | "voice_assistant" | "other";
  applicability: {
    scope: "unconfirmed" | "all" | "categories";
    label: GuideText;
    categories: string[];
  };
  steps: {
    key: string;
    title: GuideText;
    body: GuideText;
    image_path: string | null;
    alt: GuideText;
  }[];
  channels: GuideChannel[];
  source: { url: string | null; sha256: string | null };
  manual_url: string | null;
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).length === allowed.length &&
  allowed.every((k) => Object.hasOwn(v, k));
const text = (v: unknown, max: number, required = false): v is string =>
  typeof v === "string" &&
  v.length <= max &&
  !/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v) &&
  (!required || !!v.trim());
function localized(v: unknown, max: number, required = false): v is GuideText {
  return (
    record(v) &&
    keys(v, ["pt", "en", "es"]) &&
    ["pt", "en", "es"].every((l) => text(v[l], max, required))
  );
}
export function guideUrl(v: unknown) {
  if (v === null) return true;
  if (
    typeof v !== "string" ||
    v.length > 2048 ||
    !/^https:\/\/[^/@\s<>]+([/?#][^\s<>]*)?$/.test(v) ||
    /[\x00-\x1f]/.test(v)
  )
    return false;
  try {
    const u = new URL(v);
    return !u.username && !u.password && u.hostname !== "shre.ink";
  } catch {
    return false;
  }
}
export function roomGuideImagePath(
  path: unknown,
  hotelId: string,
  serviceId: string,
) {
  return (
    path === null ||
    (typeof path === "string" &&
      new RegExp(
        "^" +
          hotelId +
          "/room-guides/" +
          serviceId +
          "/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$",
      ).test(path))
  );
}
export function parseRoomGuide(
  v: unknown,
  hotelId: string,
  serviceId: string,
  published = false,
): RoomGuide | null {
  if (
    !record(v) ||
    JSON.stringify(v).length > 262144 ||
    !keys(v, [
      "version",
      "category",
      "applicability",
      "steps",
      "channels",
      "source",
      "manual_url",
    ]) ||
    v.version !== 1 ||
    !["tv", "shower", "air_conditioning", "voice_assistant", "other"].includes(
      String(v.category),
    ) ||
    !guideUrl(v.manual_url)
  )
    return null;
  const a = v.applicability;
  if (
    !record(a) ||
    !keys(a, ["scope", "label", "categories"]) ||
    !["unconfirmed", "all", "categories"].includes(String(a.scope)) ||
    (published && a.scope === "unconfirmed") ||
    !localized(a.label, 240, published && a.scope === "categories") ||
    !Array.isArray(a.categories) ||
    a.categories.length > 30 ||
    a.categories.some((x) => !text(x, 100, true)) ||
    (a.scope === "categories" && !a.categories.length)
  )
    return null;
  const source = v.source;
  if (
    !record(source) ||
    !keys(source, ["url", "sha256"]) ||
    !guideUrl(source.url) ||
    !(
      source.sha256 === null ||
      (typeof source.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(source.sha256))
    )
  )
    return null;
  if (
    !Array.isArray(v.steps) ||
    v.steps.length > 20 ||
    (published && !v.steps.length) ||
    !Array.isArray(v.channels) ||
    v.channels.length > 500
  )
    return null;
  const stepKeys = new Set();
  for (const s of v.steps) {
    if (
      !record(s) ||
      !keys(s, ["key", "title", "body", "image_path", "alt"]) ||
      typeof s.key !== "string" ||
      !/^[a-z0-9-]{1,50}$/.test(s.key) ||
      stepKeys.has(s.key) ||
      !localized(s.title, 180, published) ||
      !localized(s.body, 3000, published) ||
      !roomGuideImagePath(s.image_path, hotelId, serviceId) ||
      !localized(s.alt, 240, published && s.image_path !== null)
    )
      return null;
    stepKeys.add(s.key);
  }
  const numbers = new Set();
  for (const c of v.channels) {
    if (
      !record(c) ||
      !keys(c, ["number", "name", "quality", "category", "kind"]) ||
      typeof c.number !== "string" ||
      !/^\d{1,4}$/.test(c.number) ||
      Number(c.number) < 1 ||
      numbers.has(Number(c.number)) ||
      !text(c.name, 160, true) ||
      !["SD", "HD", "unspecified"].includes(String(c.quality)) ||
      !(c.category === null || text(c.category, 100, true)) ||
      !["linear", "application", "review"].includes(String(c.kind)) ||
      (published && c.kind === "review") ||
      (/netflix/i.test(c.name) && c.kind === "linear")
    )
      return null;
    numbers.add(Number(c.number));
  }
  return v as unknown as RoomGuide;
}
export function emptyRoomGuide(): RoomGuide {
  return {
    version: 1,
    category: "tv",
    applicability: {
      scope: "unconfirmed",
      label: { pt: "", en: "", es: "" },
      categories: [],
    },
    steps: [],
    channels: [],
    source: { url: null, sha256: null },
    manual_url: null,
  };
}
export function guideText(v: GuideText, l: "pt" | "en" | "es") {
  return v[l]?.trim() || v.pt;
}
export function previewGuideChannels(csv: string) {
  const lines = csv
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((x) => x.trim()),
    rows: GuideChannel[] = [],
    errors: string[] = [],
    seen = new Set<number>();
  if (lines.length > 501) return { rows, errors: ["Máximo de 500 registros."] };
  for (const [index, line] of lines.entries()) {
    if (index === 0 && /^number[;,\t]/i.test(line)) continue;
    const [number, name, quality, category, kind] = line
      .split(/[;\t]/)
      .map((x) => x.trim());
    if (
      !/^\d{1,4}$/.test(number ?? "") ||
      Number(number) < 1 ||
      !text(name, 160, true)
    ) {
      errors.push("Linha " + (index + 1) + ": número/nome inválido.");
      continue;
    }
    if (seen.has(Number(number))) {
      errors.push("Linha " + (index + 1) + ": número duplicado.");
      continue;
    }
    seen.add(Number(number));
    if (
      (quality && !["SD", "HD", "unspecified"].includes(quality)) ||
      (kind && !["linear", "application", "review"].includes(kind))
    ) {
      errors.push("Linha " + (index + 1) + ": formato/tipo inválido.");
      continue;
    }
    const channel: GuideChannel = {
      number: String(Number(number)),
      name,
      quality: (quality || "unspecified") as GuideChannel["quality"],
      category: category || null,
      kind: (kind || "review") as GuideChannel["kind"],
    };
    if (/netflix/i.test(name) && channel.kind === "linear") {
      errors.push(
        "Linha " + (index + 1) + ": aplicativo não pode ser canal linear.",
      );
      continue;
    }
    rows.push(channel);
  }
  return { rows, errors };
}
