"use server";

import { redirect } from "next/navigation";
import { authenticate } from "@/server/auth";
import { ShopError } from "@/server/errors";
import { startSession } from "@/server/session";

export type SignInState = { message: string; email: string } | null;

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  try {
    const ctx = await authenticate(email, String(formData.get("password") ?? ""));
    await startSession(ctx.userId);
  } catch (error) {
    if (error instanceof ShopError) return { message: error.message, email };
    throw error;
  }
  redirect("/hoy");
}
