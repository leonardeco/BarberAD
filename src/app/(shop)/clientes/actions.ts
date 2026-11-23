"use server";

import { revalidatePath } from "next/cache";
import { updateClientNotes } from "@/server/agenda";
import { ShopError } from "@/server/errors";
import { getShopContext } from "@/server/session";

export type NotesState = { ok: boolean; message: string } | null;

export async function saveNotesAction(_prev: NotesState, formData: FormData): Promise<NotesState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await updateClientNotes(ctx, String(formData.get("clientId") ?? ""), String(formData.get("notes") ?? ""));
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/clientes");
  return { ok: true, message: "Notas guardadas." };
}
