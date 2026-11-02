"use server";

import { redirect } from "next/navigation";
import { createOwnerAccount } from "@/server/auth";
import { ShopError } from "@/server/errors";
import { startSession } from "@/server/session";

export async function registerAction(_prev: { message: string } | null, formData: FormData) {
  try {
    const ctx = await createOwnerAccount({
      ownerName: String(formData.get("ownerName") ?? ""),
      shopName: String(formData.get("shopName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    await startSession(ctx.userId);
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message };
    throw error;
  }
  redirect("/hoy");
}
