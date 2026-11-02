"use server";

import { redirect } from "next/navigation";
import { authenticate } from "@/server/auth";
import { ShopError } from "@/server/errors";
import { startSession } from "@/server/session";

export async function signInAction(_prev: { message: string } | null, formData: FormData) {
  try {
    const ctx = await authenticate(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
    await startSession(ctx.userId);
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message };
    throw error;
  }
  redirect("/hoy");
}
