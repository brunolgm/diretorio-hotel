import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateImageUpload,
  IMAGE_UPLOAD_POLICIES,
} from "@/lib/security/image-upload";
import { parseRoomGuide, roomGuideImagePath } from "@/lib/room-guides";
import { isUuid } from "@/lib/security/identifiers";
export class GuideSaveError extends Error {
  constructor(
    public stage: string,
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export async function saveServiceGuide(client: SupabaseClient, form: FormData) {
  const serviceId = String(form.get("service_id") ?? ""),
    revision = Number(form.get("expected_revision")),
    raw = String(form.get("configuration") ?? "");
  if (
    !isUuid(serviceId) ||
    !Number.isInteger(revision) ||
    revision < 0 ||
    raw.length > 262144
  )
    throw new GuideSaveError("validation", "guide_request_invalid");
  const current = await client.rpc("get_current_hotel_service_guide", {
    p_service_id: serviceId,
  });
  if (current.error || !current.data?.[0])
    throw new GuideSaveError("authorization", "guide_access_denied", 403);
  const scope = current.data[0];
  if (scope.revision !== revision)
    throw new GuideSaveError("revision", "PT409", 409);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new GuideSaveError("validation", "guide_json_invalid");
  }
  const guide = parseRoomGuide(json, scope.hotel_id, serviceId);
  if (!guide)
    throw new GuideSaveError("validation", "guide_configuration_invalid");
  const publish = form.get("publish") === "true",
    review =
      form.get("review_confirmed") === "on" ||
      form.get("review_confirmed") === "true";
  if (
    publish &&
    (!review || !parseRoomGuide(guide, scope.hotel_id, serviceId, true))
  )
    throw new GuideSaveError("review", "guide_publication_incomplete");
  const file = form.get("image"),
    stepKey = String(form.get("step_key") ?? "");
  let uploaded: string | null = null;
  if (file instanceof File && file.size) {
    const step = guide.steps.find((s) => s.key === stepKey);
    if (!step) throw new GuideSaveError("validation", "guide_step_invalid");
    if (publish && Object.values(step.alt).some((v) => !v.trim()))
      throw new GuideSaveError("review", "guide_image_alt_required");
    const checked = await validateImageUpload(
      file,
      IMAGE_UPLOAD_POLICIES.tourism,
    );
    if (!checked.ok)
      throw new GuideSaveError(
        "image_validation",
        "guide_image_" + checked.reason,
      );
    uploaded =
      scope.hotel_id +
      "/room-guides/" +
      serviceId +
      "/" +
      randomUUID() +
      "." +
      checked.value.extension;
    const storage = createAdminClient();
    const result = await storage.storage
      .from("hotel-assets")
      .upload(uploaded, checked.value.bytes, {
        contentType: checked.value.mimeType,
        upsert: false,
      });
    if (result.error)
      throw new GuideSaveError("upload", "guide_image_upload_failed");
    step.image_path = uploaded;
  }

  const result = await client.rpc("save_current_hotel_service_guide", {
    p_service_id: serviceId,
    p_expected_revision: revision,
    p_configuration: guide,
    p_publish: publish,
    p_review_confirmed: review,
  });
  if (result.error) {
    if (
      uploaded &&
      ["PT409", "22023", "42501", "23514"].includes(result.error.code) &&
      roomGuideImagePath(uploaded, scope.hotel_id, serviceId)
    ) {
      await createAdminClient().storage.from("hotel-assets").remove([uploaded]);
    }
    throw new GuideSaveError(
      "association",
      result.error.code === "PT409" ? "PT409" : "guide_save_failed",
      result.error.code === "PT409" ? 409 : 400,
    );
  }
  if (
    !result.data?.[0] ||
    result.data[0].revision !== revision + 1 ||
    result.data[0].is_published !== publish
  )
    throw new GuideSaveError("confirmation", "guide_result_ambiguous", 409);
  return {
    status: publish ? "guide_published" : "guide_draft_saved",
    revision: result.data[0].revision,
    serviceId,
  };
}
