import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRoomGuide, type RoomGuide } from "../room-guides";
export type ServiceGuideSummary = {
  serviceId: string;
  category: RoomGuide["category"];
};
export async function loadServiceGuideSummaries(
  client: SupabaseClient,
  hotelId: string,
  preview = false,
): Promise<ServiceGuideSummary[]> {
  const result = preview
    ? await client.rpc("get_current_hotel_published_service_guides")
    : await client.rpc("get_public_hotel_service_guides", {
        p_hotel_id: hotelId,
      });
  if (result.error)
    throw new Error("Não foi possível carregar os guias do hotel.");
  return (result.data ?? []).map(
    (r: {
      service_id: string;
      configuration: { category: RoomGuide["category"] };
    }) => ({ serviceId: r.service_id, category: r.configuration.category }),
  );
}
export async function loadPublishedServiceGuide(
  client: SupabaseClient,
  hotelId: string,
  serviceId: string,
  preview = false,
) {
  const result = preview
    ? await client.rpc("get_current_hotel_published_service_guides", {
        p_service_id: serviceId,
      })
    : await client.rpc("get_public_hotel_service_guides", {
        p_hotel_id: hotelId,
        p_service_id: serviceId,
      });
  if (result.error)
    throw new Error("Não foi possível carregar o guia solicitado.");
  const row = result.data?.[0];
  if (!row) return null;
  const guide = parseRoomGuide(row.configuration, hotelId, serviceId, true);
  if (!guide) throw new Error("O guia publicado está indisponível.");
  return guide;
}
