"use server";

import { redirect } from "next/navigation";
import { startProCheckout } from "@/server/billing";
import { ShopError } from "@/server/errors";
import { getShopContext } from "@/server/session";

export type PlanState = { message: string } | null;

export async function buyProAction(_prev: PlanState, formData: FormData): Promise<PlanState> {
  const ctx = await getShopContext();
  if (!ctx) return { message: "Tu sesión venció. Entra de nuevo." };
  let url: string;
  try {
    url = await startProCheckout(ctx, Number(formData.get("months")));
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message };
    throw error;
  }
  redirect(url);
}
