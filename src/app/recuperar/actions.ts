"use server";

import { consumePasswordReset, createPasswordReset } from "@/server/auth";
import { ShopError } from "@/server/errors";
import { appUrl, sendPasswordReset } from "@/server/mail";
import { newToken, tokenHash } from "@/server/token";

export type ResetState = { ok: boolean; message: string } | null;

export async function requestResetAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { ok: false, message: "Escribe un correo válido." };
  const token = newToken();
  if (await createPasswordReset(email, tokenHash(token))) {
    await sendPasswordReset(email, `${appUrl()}/recuperar/${token}`);
  }
  return {
    ok: true,
    message: "Si ese correo tiene cuenta, te llega un enlace para crear una contraseña nueva. Vence en 30 minutos.",
  };
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
