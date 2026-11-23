"use server";

import { consumePasswordReset } from "@/server/auth";
import { requestResetCode, resetWithCode } from "@/server/codes";
import { ShopError } from "@/server/errors";
import { tokenHash } from "@/server/token";
import { clientIp } from "@/server/session";

export type ResetState = { ok: boolean; message: string; email?: string } | null;

export async function requestResetAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@") || email.length > 254) return { ok: false, message: "Escribe un correo válido." };
  // Se responde igual exista o no la cuenta, y pasado el límite no se envía nada.
  await requestResetCode(email, await clientIp());
  return { ok: true, email, message: "Si ese correo tiene cuenta, te enviamos un código de 4 números. Vale 10 minutos." };
}

export async function confirmResetCodeAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "");
  if (String(formData.get("password") ?? "") !== String(formData.get("confirm") ?? "")) {
    return { ok: false, email, message: "Las contraseñas no coinciden." };
  }
  try {
    await resetWithCode(email, String(formData.get("code") ?? ""), String(formData.get("password") ?? ""), await clientIp());
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, email, message: error.message };
    throw error;
  }
  return { ok: true, message: "Listo. Ya puedes entrar con tu contraseña nueva." };
}

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) {
    return { ok: false, message: "Las contraseñas no coinciden." };
  }
  try {
    await consumePasswordReset(tokenHash(token), password);
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  return { ok: true, message: "Listo. Ya puedes entrar con tu contraseña nueva." };
}
