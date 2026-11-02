"use server";

import { revalidatePath } from "next/cache";
import { ShopError } from "@/server/errors";
import { formatCop, readPesos } from "@/server/money";
import { getShopContext } from "@/server/session";
import { closeDrawer } from "@/server/shop";

export type CloseState = { ok: boolean; message: string } | null;

export async function closeDrawerAction(_prev: CloseState, formData: FormData): Promise<CloseState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    const result = await closeDrawer(ctx, readPesos(formData.get("countedCash")));
    revalidatePath("/caja");
    revalidatePath("/hoy");
    revalidatePath("/cobrar");
    const gap =
      result.difference === 0
        ? "Cuadró exacto."
        : result.difference > 0
          ? `Sobran ${formatCop(result.difference)}.`
          : `Faltan ${formatCop(-result.difference)}.`;
    return { ok: true, message: `Caja cerrada. ${gap}` };
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
}
