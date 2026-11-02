"use server";

import { revalidatePath } from "next/cache";
import { ShopError } from "@/server/errors";
import { readPesos } from "@/server/money";
import { getShopContext } from "@/server/session";
import { createService, deactivateService } from "@/server/shop";

export async function createServiceAction(_prev: { message: string } | null, formData: FormData) {
  const ctx = await getShopContext();
  if (!ctx) return { message: "Tu sesión venció. Entra de nuevo." };
  try {
    await createService(ctx, {
      name: String(formData.get("name") ?? ""),
      durationMin: Number(formData.get("durationMin")),
      listPrice: readPesos(formData.get("listPrice")),
    });
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message };
    throw error;
  }
  revalidatePath("/servicios");
  revalidatePath("/cobrar");
  return { message: "" };
}

export async function deactivateServiceAction(formData: FormData) {
  const ctx = await getShopContext();
  if (!ctx) return;
  await deactivateService(ctx, String(formData.get("serviceId") ?? ""));
  revalidatePath("/servicios");
  revalidatePath("/cobrar");
}
