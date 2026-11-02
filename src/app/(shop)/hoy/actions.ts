"use server";

import { revalidatePath } from "next/cache";
import { getShopContext } from "@/server/session";
import { setGuideHidden } from "@/server/shop";

export async function hideGuideAction() {
  const ctx = await getShopContext();
  if (!ctx) return;
  await setGuideHidden(ctx, true);
  revalidatePath("/hoy");
}
