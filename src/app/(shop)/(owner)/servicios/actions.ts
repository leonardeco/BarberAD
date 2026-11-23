"use server";

import { revalidatePath } from "next/cache";
import { ShopError } from "@/server/errors";
import { readInt, readPesos } from "@/server/money";
import { getShopContext } from "@/server/session";
import { createService, deactivateService, listServices, updateService } from "@/server/shop";

export type ServiceFormState = { ok: boolean; message: string } | null;

function readService(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    durationMin: readInt(formData.get("durationMin")),
    listPrice: readPesos(formData.get("listPrice")),
    commissionPercent: String(formData.get("commissionPercent") ?? "").trim() === "" ? null : readInt(formData.get("commissionPercent")),
  };
}

function refresh() {
  revalidatePath("/servicios");
  revalidatePath("/cobrar");
  revalidatePath("/hoy");
}

export async function createServiceAction(_prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await createService(ctx, readService(formData));
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true, message: "Servicio agregado." };
}

export async function updateServiceAction(_prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const ctx = await getShopContext();
  if (!ctx) return { ok: false, message: "Tu sesión venció. Entra de nuevo." };
  try {
    await updateService(ctx, String(formData.get("serviceId") ?? ""), readService(formData));
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    throw error;
  }
  refresh();
  return { ok: true, message: "Cambios guardados. Aplican desde el próximo cobro." };
}

export async function addTemplateAction(formData: FormData) {
  const ctx = await getShopContext();
  if (!ctx) return;
  try {
    const input = readService(formData);
    // Un doble toque no debe dejar el mismo servicio repetido.
    const current = await listServices(ctx, true);
    if (current.some((item) => item.name.toLowerCase() === input.name.trim().toLowerCase())) return;
    await createService(ctx, input);
  } catch (error) {
    if (error instanceof ShopError) return;
    throw error;
  }
  refresh();
}

export async function deactivateServiceAction(formData: FormData) {
  const ctx = await getShopContext();
  if (!ctx) return;
  await deactivateService(ctx, String(formData.get("serviceId") ?? ""));
  refresh();
}
