"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminAccess } from "@/lib/auth";
import { requireHotelModule } from "@/lib/admin-entitlements";
import { createClient } from "@/lib/supabase/server";
import {
  saveServiceGuide,
  GuideSaveError,
} from "@/lib/room-guides/save.server";
export async function saveServiceGuideAction(form: FormData) {
  await requireAdminAccess("operador");
  await requireHotelModule("content.services");
  let result;
  try {
    result = await saveServiceGuide(await createClient(), form);
  } catch (error) {
    const e =
      error instanceof GuideSaveError
        ? error
        : new GuideSaveError("save", "guide_save_failed");
    redirect(
      "/admin/servicos/" +
        encodeURIComponent(String(form.get("service_id"))) +
        "?error=" +
        encodeURIComponent(
          e.code === "PT409"
            ? "O guia foi alterado. Recarregue antes de salvar."
            : "Não foi possível salvar o guia: " + e.code,
        ),
    );
  }
  revalidatePath("/admin/servicos");
  revalidatePath("/admin/servicos/" + result.serviceId);
  revalidatePath("/", "layout");
  redirect(
    "/admin/servicos/" +
      result.serviceId +
      "?success=" +
      encodeURIComponent(
        result.status === "guide_published"
          ? "Guia publicado após revisão."
          : "Rascunho salvo; a versão publicada foi preservada.",
      ),
  );
}
