"use server";

import { revalidatePath } from "next/cache";
import { ShopError } from "@/server/errors";
import { markReminderSent, saveTemplates, type ReminderKind } from "@/server/reminders";
import { getShopContext } from "@/server/session";

const kinds = new Set<ReminderKind>(["tomorrow", "soon", "thanks", "comeback"]);

export async function markSentAction(kind: ReminderKind, id: string) {
  const ctx = await getShopContext();
  if (!ctx || !kinds.has(kind)) return;
  try {
    await markReminderSent(ctx, kind, id);
  } catch (error) {
    if (!(error instanceof ShopError)) throw error;
  }
  revalidatePath("/avisos");
  revalidatePath("/hoy");
}

export type TemplatesState = { ok: boolean; message: string } | null;

export async function saveTemplatesAction(_prev: TemplatesState, formData: FormData): Promise<TemplatesState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await saveTemplates(ctx, {
      reminder: String(formData.get("reminder") ?? ""),
      thanks: String(formData.get("thanks") ?? ""),
      comeback: String(formData.get("comeback") ?? ""),
    });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/avisos");
  return { ok: true, message: "Mensajes guardados." };
}
