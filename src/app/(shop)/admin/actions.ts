"use server";

import { redirect } from "next/navigation";
import { adminOwnerOf, adminState, userEmail } from "@/server/admin";
import { issueOwnerResetCode, sendAdminCode, verifyAdminCode } from "@/server/codes";
import { ShopError } from "@/server/errors";
import { clientIp, currentSessionHash, getShopContext } from "@/server/session";

export type AdminCodeState = { sent?: string; message?: string } | null;

export async function sendAdminCodeAction(): Promise<AdminCodeState> {
  const ctx = await getShopContext();
  if (!ctx) return { message: "Tu sesión venció. Entra de nuevo." };
  try {
    const email = await userEmail(ctx.userId);
    if (!email) return { message: "No encontramos tu cuenta." };
    return { sent: await sendAdminCode(ctx.userId, email) };
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message };
    throw error;
  }
}

export async function verifyAdminCodeAction(_prev: AdminCodeState, formData: FormData): Promise<AdminCodeState> {
  const ctx = await getShopContext();
  const hash = await currentSessionHash();
  if (!ctx || !hash) return { message: "Tu sesión venció. Entra de nuevo." };
  if ((await adminState(ctx)) === "no") return { message: "Esta cuenta no es de administrador." };
  try {
    await verifyAdminCode(hash, ctx.userId, String(formData.get("code") ?? ""), await clientIp());
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message };
    throw error;
  }
  redirect("/admin");
}

export type OwnerCodeState = { ok: boolean; message: string; code?: string } | null;

// Soporte: genera un código para el dueño de una barbería que no puede recuperar su contraseña.
export async function ownerResetCodeAction(_prev: OwnerCodeState, formData: FormData): Promise<OwnerCodeState> {
  const ctx = await getShopContext();
  if (!ctx || (await adminState(ctx)) !== "ok") return { ok: false, message: "Verifica tu código de administrador primero." };
  try {
    const owner = await adminOwnerOf(String(formData.get("shopId") ?? ""));
    if (!owner) return { ok: false, message: "No encontramos al dueño de esa barbería." };
    const code = await issueOwnerResetCode(owner.user_id);
    return { ok: true, code, message: `Código para ${owner.email}. Vale 10 minutos.` };
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
}
