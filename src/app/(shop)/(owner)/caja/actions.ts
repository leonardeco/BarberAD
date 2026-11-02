"use server";

import { revalidatePath } from "next/cache";
import { ShopError } from "@/server/errors";
import { readPesos } from "@/server/money";
import { getShopContext } from "@/server/session";
import { closeDrawer } from "@/server/shop";

export async function closeDrawerAction(_prev: { message: string } | null, formData: FormData) {
  const ctx = await getShopContext();
  if (!ctx) return { message: "Tu sesión venció. Entra de nuevo." };
  try {
    const result = await closeDrawer(ctx, readPesos(formData.get("countedCash")));
    revalidatePath("/caja");
    revalidatePath("/hoy");
    revalidatePath("/cobrar");
    return {
      message: `Caja cerrada. Diferencia ${result.difference} pesos.`,
    };
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message };
    throw error;
  }
}
