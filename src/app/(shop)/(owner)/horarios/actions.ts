"use server";

import { revalidatePath } from "next/cache";
import { saveSchedule } from "@/server/agenda";
import { ShopError } from "@/server/errors";
import { getShopContext } from "@/server/session";

export type ScheduleState = { ok: boolean; message: string } | null;

function minutes(value: FormDataEntryValue | null) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value ?? ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
}

export async function saveScheduleAction(_prev: ScheduleState, formData: FormData): Promise<ScheduleState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  const days = [];
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    if (formData.get(`d${weekday}_on`) !== "on") continue;
    const start = minutes(formData.get(`d${weekday}_start`));
    const endText = String(formData.get(`d${weekday}_end`) ?? "");
    const end = endText === "00:00" ? 1440 : minutes(endText);
    days.push({ weekday, start, end });
  }
  try {
    await saveSchedule(ctx, String(formData.get("memberId") ?? ""), {
      takesAppointments: formData.get("takesAppointments") === "on",
      days,
    });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/horarios");
  revalidatePath("/agenda");
  return { ok: true, message: "Horario guardado." };
}
