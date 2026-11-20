"use server";

import { revalidatePath } from "next/cache";
import { getShopContext } from "@/server/session";
import { setGuideHidden, voidCheckout } from "@/server/shop";
import { ShopError } from "@/server/errors";

export async function hideGuideAction() {
  const ctx = await getShopContext();
  if (!ctx) return;
  await setGuideHidden(ctx, true);
  revalidatePath("/hoy");
}

export type VoidState = { ok: boolean; message: string } | null;

export async function voidCheckoutAction(_prev: VoidState, formData: FormData): Promise<VoidState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await voidCheckout(ctx, String(formData.get("checkoutId") ?? ""), String(formData.get("reason") ?? ""));
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/hoy");
  revalidatePath("/caja");
  revalidatePath("/agenda");
  return { ok: true, message: "Cobro anulado." };
}
