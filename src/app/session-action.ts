"use server";

import { redirect } from "next/navigation";
import { endSession } from "@/server/session";

export async function endSessionAction() {
  await endSession();
  redirect("/entrar");
}
