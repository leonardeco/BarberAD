"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminOwnerOf, adminState, createCourtesyShop, grantPro, userEmail } from "@/server/admin";
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

export type GrantState = { ok: boolean; message: string } | null;

export async function grantProAction(_prev: GrantState, formData: FormData): Promise<GrantState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    const until = await grantPro(ctx, String(formData.get("shopId") ?? ""), Number(formData.get("months")), String(formData.get("note") ?? ""));
    revalidatePath("/admin");
    return { ok: true, message: `Listo: Pro de cortesía hasta el ${until}.` };
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
}

export type CourtesyState = {
  ok: boolean;
  message: string;
  email?: string;
  code?: string;
  values?: { ownerName: string; shopName: string; email: string; phone: string; note: string };
} | null;

export async function createCourtesyShopAction(_prev: CourtesyState, formData: FormData): Promise<CourtesyState> {
  const ctx = await getShopContext();
  const values = {
    ownerName: String(formData.get("ownerName") ?? ""),
    shopName: String(formData.get("shopName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo.", values };
  try {
    const result = await createCourtesyShop(ctx, { ...values, months: Number(formData.get("months")) });
    revalidatePath("/admin");
    return { ok: true, message: `Barbería creada con Pro de cortesía hasta el ${result.until}.`, email: result.email, code: result.code };
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message, values };
    throw error;
  }
}
