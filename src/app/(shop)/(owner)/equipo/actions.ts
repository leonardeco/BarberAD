"use server";

import { revalidatePath } from "next/cache";
import { addBarberAccount, resetMemberPassword } from "@/server/auth";
import { ShopError } from "@/server/errors";
import { readInt } from "@/server/money";
import { getShopContext } from "@/server/session";
import { deactivateMember, updateCommission } from "@/server/shop";

export type TeamState = { ok: boolean; message: string } | null;

export async function addBarberAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await addBarberAccount(ctx, {
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      commissionPercent: readInt(formData.get("commissionPercent")),
    });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/equipo");
  return { ok: true, message: "Barbero creado. Entrégale el correo y la contraseña que acabas de escribir." };
}

export async function updateCommissionAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await updateCommission(ctx, String(formData.get("memberId") ?? ""), readInt(formData.get("commissionPercent")));
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/equipo");
  return { ok: true, message: "Comisión actualizada. Aplica desde el próximo cobro." };
}

export async function resetPasswordAction(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await resetMemberPassword(ctx, String(formData.get("memberId") ?? ""), String(formData.get("password") ?? ""));
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  return { ok: true, message: "Contraseña cambiada. El barbero debe entrar de nuevo con la nueva." };
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
