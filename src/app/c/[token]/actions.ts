"use server";

import { revalidatePath } from "next/cache";
import { cancelByClient } from "@/server/reminders";

export async function cancelMineAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  await cancelByClient(token);
  revalidatePath(`/c/${token}`);
}
