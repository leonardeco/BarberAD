"use server";

import { redirect } from "next/navigation";
import { createOwnerAccount } from "@/server/auth";
import { ShopError } from "@/server/errors";
import { startSession } from "@/server/session";

export type RegisterState = {
  message: string;
  values: { ownerName: string; shopName: string; email: string };
} | null;

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = {
    ownerName: String(formData.get("ownerName") ?? ""),
    shopName: String(formData.get("shopName") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  try {
    const ctx = await createOwnerAccount({ ...values, password: String(formData.get("password") ?? "") });
    await startSession(ctx.userId);
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message, values };
    throw error;
  }
  redirect("/hoy");
}
