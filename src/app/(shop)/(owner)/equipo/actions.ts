"use server";

import { revalidatePath } from "next/cache";
import { addBarberAccount } from "@/server/auth";
import { ShopError } from "@/server/errors";
import { getShopContext } from "@/server/session";
import { deactivateMember } from "@/server/shop";

export type TeamState = { ok: boolean; message: string } | null;

export async function addBarberAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await addBarberAccount(ctx, {
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      commissionPercent: Number(formData.get("commissionPercent")),
    });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/equipo");
  return { ok: true, message: "Barbero creado. Entrégale el correo y la contraseña que acabas de escribir." };
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
