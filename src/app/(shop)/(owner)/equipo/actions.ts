"use server";

import { revalidatePath } from "next/cache";
import { addBarberAccount } from "@/server/auth";
import { ShopError } from "@/server/errors";
import { getShopContext } from "@/server/session";
import { deactivateMember } from "@/server/shop";

export async function addBarberAction(_prev: { message: string } | null, formData: FormData) {
  const ctx = await getShopContext();
  if (!ctx) return { message: "Tu sesión venció. Entra de nuevo." };
  try {
    await addBarberAccount(ctx, {
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      commissionPercent: Number(formData.get("commissionPercent")),
    });
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message };
    throw error;
  }
  revalidatePath("/equipo");
  return { message: "Barbero creado. Entrégale la contraseña que acabas de escribir." };
}

export async function deactivateMemberAction(formData: FormData) {
  const ctx = await getShopContext();
  if (!ctx) return;
  try {
    await deactivateMember(ctx, String(formData.get("memberId") ?? ""));
  } catch (error) {
    if (error instanceof ShopError) return;
    throw error;
  }
  revalidatePath("/equipo");
}
