import { createClient } from "@supabase/supabase-js";
import { getRequiredEnvVar } from "@/lib/env";
import {
  saveServiceGuide,
  GuideSaveError,
} from "@/lib/room-guides/save.server";
import { emptyRoomGuide, parseRoomGuide } from "@/lib/room-guides";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" },
    auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ") || auth.length > 8200)
    return Response.json(
      { error: "authentication_required" },
      { status: 401, headers },
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "origin_denied" }, { status: 403, headers });
  const client = createClient(
    getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const user = await client.auth.getUser(auth.slice(7));
  if (user.error || !user.data.user)
    return Response.json(
      { error: "authentication_required" },
      { status: 401, headers },
    );
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 3 * 1024 * 1024)
      throw new GuideSaveError("request", "payload_too_large", 413);
    if (request.headers.get("content-type")?.includes("application/json")) {
      const raw = await request.text();
      if (raw.length > 280000)
        throw new GuideSaveError("validation", "payload_too_large", 413);
      const body = JSON.parse(raw);
      if (
        body.operation !== "prepare" ||
        Object.keys(body).some(
          (k) =>
            ![
              "operation",
              "source_key",
              "title",
              "content",
              "configuration",
            ].includes(k),
        )
      )
        throw new GuideSaveError("validation", "operation_invalid");
      if (
        !parseRoomGuide(
          body.configuration ?? emptyRoomGuide(),
          "00000000-0000-4000-8000-000000000000",
          "00000000-0000-4000-8000-000000000000",
        )
      )
        throw new GuideSaveError("validation", "guide_configuration_invalid");
      const result = await client.rpc("create_current_hotel_room_guide", {
        p_source_key: body.source_key,
        p_title: body.title,
        p_content: body.content,
        p_configuration: body.configuration,
      });
      if (result.error || !result.data?.[0])
        throw new GuideSaveError("prepare", "guide_prepare_denied", 403);
      return Response.json(
        { status: "guide_prepared", ...result.data[0] },
        { headers },
      );
    }
    const form = await request.formData();
    if (
      [...form.keys()].some(
        (k) =>
          ![
            "service_id",
            "expected_revision",
            "configuration",
            "publish",
            "review_confirmed",
            "image",
            "step_key",
          ].includes(k),
      )
    )
      throw new GuideSaveError("validation", "fields_invalid");
    return Response.json(await saveServiceGuide(client, form), { headers });
  } catch (error) {
    const e =
      error instanceof GuideSaveError
        ? error
        : new GuideSaveError("request", "guide_request_failed");
    return Response.json(
      { status: "interrupted", stage: e.stage, error: e.code },
      { status: e.status, headers },
    );
  }
}
