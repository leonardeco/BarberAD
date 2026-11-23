"use server";

import { revalidatePath } from "next/cache";
import { ShopError } from "@/server/errors";
import { formatCop } from "@/server/money";
import { payBarber } from "@/server/reports";
import { getShopContext } from "@/server/session";

export type PayState = { ok: boolean; message: string } | null;

export async function payBarberAction(_prev: PayState, formData: FormData): Promise<PayState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    const result = await payBarber(ctx, String(formData.get("memberId") ?? ""));
    revalidatePath("/liquidar");
    return { ok: true, message: `Pago registrado: ${formatCop(result.total)} por ${result.cuts === 1 ? "1 corte" : `${result.cuts} cortes`}.` };
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
}
