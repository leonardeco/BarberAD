"use server";

import { revalidatePath } from "next/cache";
import { changePassword } from "@/server/auth";
import { ShopError } from "@/server/errors";
import { currentSessionHash, getShopContext } from "@/server/session";
import { updateShopProfile } from "@/server/shop";

export type AccountState = { ok: boolean; message: string } | null;

export async function changePasswordAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const ctx = await getShopContext();
  const hash = await currentSessionHash();
  if (!ctx || !hash) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  const next = String(formData.get("next") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) {
    return { ok: false, message: "Las contraseñas nuevas no coinciden." };
  }
  try {
    await changePassword(ctx, {
      current: String(formData.get("current") ?? ""),
      next,
      keepSessionHash: hash,
    });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  return { ok: true, message: "Contraseña cambiada. Se cerró la sesión en los otros dispositivos." };
}

export async function updateProfileAction(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await updateShopProfile(ctx, {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      address: String(formData.get("address") ?? ""),
      about: String(formData.get("about") ?? ""),
      instagram: String(formData.get("instagram") ?? ""),
    });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  revalidatePath("/r/[slug]", "page");
  return { ok: true, message: "Datos guardados." };
}
