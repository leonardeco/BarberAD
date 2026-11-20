"use server";

import { revalidatePath } from "next/cache";
import { cancelAppointment, createStaffAppointment } from "@/server/agenda";
import { ShopError } from "@/server/errors";
import { getShopContext } from "@/server/session";

export type AgendaState = { ok: boolean; message: string } | null;

export async function createAppointmentAction(_prev: AgendaState, formData: FormData): Promise<AgendaState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await createStaffAppointment(ctx, {
      memberId: String(formData.get("memberId") ?? ""),
      serviceId: String(formData.get("serviceId") ?? ""),
      day: String(formData.get("day") ?? ""),
      time: String(formData.get("time") ?? ""),
      clientName: String(formData.get("clientName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  revalidatePath("/agenda");
  revalidatePath("/clientes");
  return { ok: true, message: "Cita agendada." };
}

export async function cancelAppointmentAction(formData: FormData) {
  const ctx = await getShopContext();
  if (!ctx) return;
  try {
    await cancelAppointment(ctx, String(formData.get("appointmentId") ?? ""));
  } catch (error) {
    if (!(error instanceof ShopError)) throw error;
  }
  revalidatePath("/agenda");
}
