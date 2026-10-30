import "./bootstrap-runtime.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
import { prepareRoomGuides } from "./prepare-room-guides-core.mjs";
import { parseRoomGuide, roomGuideImagePath } from "../lib/room-guides.ts";
let client,
  state = {
    stage: "plan",
    operation: "validate_assets",
    writesAttempted: false,
  };
const hash = (b) => createHash("sha256").update(b).digest("hex");
const check = (ok, code) => {
  if (!ok) throw { code };
};
try {
  const m = JSON.parse(
    readFileSync("docs/bootstrap/bugan-room-guides-20261030.json", "utf8"),
  );
  check(
    m.projectRef === "micuekfznunwwofxnovw" &&
      m.applicationOrigin === "https://libguest.digital",
    "PROJECT_MISMATCH",
  );
  check(hash(readFileSync(m.pdf.path)) === m.pdf.sha256, "ASSET_MISMATCH");
  const assetBytes = new Map();
  for (const a of Object.values(m.assets)) {
    const path = resolve(a.path),
      root = resolve("docs/references/bugan/public-v3/tv-manual");
    check(path.startsWith(root + sep), "ASSET_PATH_INVALID");
    const b = readFileSync(path);
    check(hash(b) === a.sha256, "ASSET_MISMATCH");
    assetBytes.set(a.path, b);
  }
  for (const g of m.guides)
    check(
      parseRoomGuide(
        g.configuration,
        m.hotelId,
        "00000000-0000-4000-8000-000000000000",
      ),
      "MANIFEST_INVALID",
    );
  if (process.argv.includes("--plan"))
    console.log(
      JSON.stringify({
        status: "review_plan_valid",
        writes: false,
        guides: m.guides.map((g) => ({
          key: g.key,
          title: g.title,
          steps: g.configuration.steps.length,
          channels: g.configuration.channels.length,
        })),
        reviewRequired: m.reviewRequired,
        publication: false,
      }),
    );
  else {
    process.loadEnvFile(".env.local");
    check(
      process.env.NEXT_PUBLIC_SUPABASE_URL ===
        "https://" + m.projectRef + ".supabase.co",
      "PROJECT_MISMATCH",
    );
    state = {
      stage: "authentication",
      operation: "auth.signInWithPassword",
      writesAttempted: false,
    };
    let input = "";
    for await (const part of process.stdin) {
      input += part;
      check(input.length < 16384, "INPUT_INVALID");
    }
    let credentials = JSON.parse(input);
    input = "";
    check(credentials.email === "libguestbugan@yahoo.com", "ACCOUNT_MISMATCH");
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const auth = await client.auth.signInWithPassword(credentials);
    credentials = null;
    check(!auth.error && auth.data.session, "AUTH_FAILED");
    const token = auth.data.session.access_token;
    const api = async (payload) => {
      const multipart = payload instanceof FormData;
      const r = await fetch(m.applicationOrigin + "/api/admin/service-guides", {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: "Bearer " + token,
          ...(!multipart ? { "Content-Type": "application/json" } : {}),
        },
        body: multipart ? payload : JSON.stringify(payload),
      });
      let body;
      try {
        body = await r.json();
      } catch {
        throw { code: "RESPONSE_AMBIGUOUS" };
      }
      if (!r.ok)
        throw { code: body.error === "PT409" ? "PT409" : "API_REJECTED" };
      return body;
    };
    const assets = {
      file: async (a) =>
        new File([assetBytes.get(a.path)], "equipment.webp", {
          type: "image/webp",
        }),
      verifyRemote: async (path, serviceId, a) => {
        check(
          roomGuideImagePath(path, m.hotelId, serviceId) && path !== null,
          "MEDIA_PATH_INVALID",
        );
        const r = await fetch(
          process.env.NEXT_PUBLIC_SUPABASE_URL +
            "/storage/v1/object/public/hotel-assets/" +
            path,
          { redirect: "error" },
        );
        return r.ok && hash(Buffer.from(await r.arrayBuffer())) === a.sha256;
      },
    };
    const result = await prepareRoomGuides({
      client,
      manifest: m,
      api,
      assets,
      progress: (s) => {
        state = s;
      },
    });
    mkdirSync("out", { recursive: true });
    writeFileSync(
      "out/bugan-room-guides-prepare.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  }
} catch (error) {
  const report = {
    status: "interrupted",
    ...state,
    code: /^[A-Z0-9_]{3,50}$/.test(error?.code ?? "")
      ? error.code
      : "UNCONFIRMED",
    instruction:
      "Confira por leitura antes de repetir. Nao envie senha ou token ao chat.",
  };
  mkdirSync("out", { recursive: true });
  writeFileSync(
    "out/bugan-room-guides-prepare.json",
    JSON.stringify(report, null, 2),
  );
  console.error(JSON.stringify(report));
  process.exitCode = 1;
} finally {
  if (client) await client.auth.signOut({ scope: "local" }).catch(() => {});
}
