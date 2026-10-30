import "server-only";
import { notFound } from "next/navigation";
import { requireAdminAccess } from "@/lib/auth";
import { requireHotelModule } from "@/lib/admin-entitlements";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/security/identifiers";
import { parseRoomGuide } from "@/lib/room-guides";
import { translatedText } from "@/lib/translation-fallback";
import { canRenderServiceDetailPage } from "@/lib/service-destinations";
import type { SupportedPublicLanguage } from "@/lib/public-language";

/** Read-only draft projection. Tenant always comes from the genuine session. */
export async function getAuthenticatedRoomGuideDraft(
  serviceId: string,
  language: SupportedPublicLanguage,
) {
  const { profile } = await requireAdminAccess("administrador");
  for (const key of [
    "experience.preview",
    "core.directory",
    "content.services",
    "content.languages",
  ] as const)
    await requireHotelModule(key);
  if (!isUuid(serviceId)) notFound();
  const client = await createClient();
  const result = await client.rpc("get_current_hotel_service_guide", {
    p_service_id: serviceId,
  });
  if (result.error) {
    if (result.error.code === "42501") notFound();
    throw new Error("Não foi possível carregar o rascunho do guia.");
  }
  const row = result.data?.[0];
  if (!row || row.hotel_id !== profile.hotel_id) notFound();
  const guide = parseRoomGuide(row.draft, profile.hotel_id, serviceId);
  if (!guide) notFound();
  const sectionResult = await client
    .from("hotel_sections")
    .select("*")
    .eq("hotel_id", profile.hotel_id)
    .eq("id", serviceId)
    .maybeSingle();
  if (sectionResult.error)
    throw new Error("Não foi possível carregar o Serviço do rascunho.");
  const section = sectionResult.data;
  if (
    !section ||
    !canRenderServiceDetailPage(section) ||
    section.service_action_type !== "standard"
  )
    notFound();
  const tr =
    language === "pt"
      ? { data: null, error: null }
      : await client
          .from("hotel_section_translations")
          .select("title,content,cta,category")
          .eq("section_id", serviceId)
          .eq("language", language)
          .maybeSingle();
  if (tr.error)
    throw new Error("Não foi possível carregar as traduções do rascunho.");
  return {
    hotelId: profile.hotel_id,
    revision: row.revision,
    guide,
    section: {
      ...section,
      title: translatedText(section.title, tr.data?.title),
      content: translatedText(section.content, tr.data?.content),
      cta: translatedText(section.cta, tr.data?.cta),
      category: translatedText(section.category, tr.data?.category),
    },
  };
}
