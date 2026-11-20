"use server";

import { bookPublic, freeSlots, publicShop, type Slot } from "@/server/agenda";
import { ShopError } from "@/server/errors";

export async function slotsAction(input: {
  slug: string;
  serviceId: string;
  memberId: string | null;
  day: string;
}): Promise<Slot[]> {
  const shop = await publicShop(input.slug);
  if (!shop) return [];
  return freeSlots({ shopId: shop.id, timezone: shop.timezone, ...input });
}

export type BookResult =
  | { ok: true; memberName: string; startsAt: string; token: string }
  | { ok: false; message: string };

export async function bookAction(input: {
  slug: string;
  serviceId: string;
  memberId: string | null;
  startsAt: string;
  name: string;
  phone: string;
}): Promise<BookResult> {
  try {
    const result = await bookPublic(input);
    return { ok: true, memberName: result.memberName, startsAt: result.startsAt, token: result.token };
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, message: error.message };
    console.error("[BarberAD] No se pudo reservar:", error);
    return { ok: false, message: "No se pudo reservar. Inténtalo de nuevo." };
  }
}
