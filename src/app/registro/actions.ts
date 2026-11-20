"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readPending } from "@/server/google";
import { createOwnerAccount } from "@/server/auth";
import { ShopError } from "@/server/errors";
import { startSession } from "@/server/session";

export type RegisterState = {
  message: string;
  values: { ownerName: string; shopName: string; email: string; phone: string };
} | null;

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = {
    ownerName: String(formData.get("ownerName") ?? ""),
    shopName: String(formData.get("shopName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };
  try {
    const ctx = await createOwnerAccount({
      ...values,
      password: String(formData.get("password") ?? ""),
      takesAppointments: formData.get("takesAppointments") === "on",
    });
    await startSession(ctx.userId);
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message, values };
    throw error;
  }
  redirect("/hoy");
}

export type GoogleSignupState = { message: string } | null;

export async function completeGoogleSignupAction(_prev: GoogleSignupState, formData: FormData): Promise<GoogleSignupState> {
  const jar = await cookies();
  const pending = readPending(jar.get("barberad_google_signup")?.value);
  if (!pending) return { message: "Pasaron más de 10 minutos. Vuelve a tocar Continuar con Google." };
  try {
    const ctx = await createOwnerAccount({
      ownerName: String(formData.get("ownerName") ?? ""),
      shopName: String(formData.get("shopName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: pending.email,
      // Contraseña al azar que nadie conoce: entra con Google, o crea una con "¿Olvidaste tu contraseña?".
      password: randomBytes(32).toString("base64url"),
      takesAppointments: formData.get("takesAppointments") === "on",
      googleSub: pending.sub,
    });
    await startSession(ctx.userId);
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message };
    throw error;
  }
  jar.delete({ name: "barberad_google_signup", path: "/registro" });
  redirect("/hoy");
}
