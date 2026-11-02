"use server";

import { getShopContext } from "@/server/session";
import { completeCheckout } from "@/server/shop";
import { ShopError } from "@/server/errors";
import type { CheckoutReceipt } from "@/server/types";

export async function chargeAction(input: {
  serviceId: string;
  amount: number;
  reason: string;
  tip: number;
  paymentMethod: string;
  clientKey: string;
}): Promise<{ ok: true; receipt: CheckoutReceipt } | { ok: false; message: string }> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    const receipt = await completeCheckout(ctx, input);
    return { ok: true, receipt };
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
}
