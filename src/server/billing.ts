import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { appDb, withShop } from "./db";
import { ShopError } from "./errors";
import { appUrl } from "./mail";
import { FREE_LIMITS, proTotal } from "./plans";
import type { ShopContext } from "./types";

// Cobro del plan con el checkout web de Wompi (Colombia). Se activa con WOMPI_PUBLIC_KEY,
// WOMPI_INTEGRITY_SECRET y WOMPI_EVENTS_SECRET, que salen del panel de Wompi.
export function wompiEnabled() {
  return Boolean(
    process.env.WOMPI_PUBLIC_KEY?.trim() && process.env.WOMPI_INTEGRITY_SECRET?.trim() && process.env.WOMPI_EVENTS_SECRET?.trim(),
  );
}

export function integritySignature(reference: string, amountCents: number, currency = "COP") {
  return createHash("sha256").update(`${reference}${amountCents}${currency}${process.env.WOMPI_INTEGRITY_SECRET!.trim()}`).digest("hex");
}

export type PlanStatus = {
  pro: boolean;
  until: string | null;
  barbers: number;
  onlineBookings: number;
  payments: { reference: string; months: number; amount: number; status: string; createdAt: string }[];
};

export async function planStatus(ctx: ShopContext): Promise<PlanStatus> {
  return withShop(ctx, async (tx) => {
    const [row] = await tx<{ pro: boolean; until: string | null; barbers: number; online: number }[]>`
      select coalesce(s.plan_until > now(), false) as pro,
             case when s.plan_until > now() then to_char(s.plan_until at time zone s.timezone, 'YYYY-MM-DD') end as until,
             (select count(*)::int from shop_members m where m.shop_id = s.id and m.role = 'barber' and m.active) as barbers,
             (select count(*)::int from appointments a where a.shop_id = s.id and a.source = 'public'
                and date_trunc('month', a.created_at at time zone s.timezone) = date_trunc('month', now() at time zone s.timezone)) as online
      from shops s where s.id = ${ctx.shopId}::uuid
    `;
    const payments =
      ctx.role === "owner"
        ? await tx<PlanStatus["payments"]>`
            select reference, months, (amount_cents / 100)::int as amount, status,
                   to_char(created_at, 'YYYY-MM-DD') as "createdAt"
            from payments where shop_id = ${ctx.shopId}::uuid
            order by created_at desc limit 10
          `
        : [];
    return { pro: row.pro, until: row.until, barbers: row.barbers, onlineBookings: row.online, payments };
  });
}

export { FREE_LIMITS };

// Crea el intento de pago y devuelve la dirección del checkout de Wompi.
export async function startProCheckout(ctx: ShopContext, months: number) {
  if (ctx.role !== "owner") throw new ShopError("Solo el dueño puede pagar el plan.");
  if (!wompiEnabled()) throw new ShopError("Los pagos en línea todavía no están activados.");
  const total = proTotal(months);
  if (!total) throw new ShopError("Elige 1, 6 o 12 meses.");
  const amountCents = total * 100;
  const reference = `BAD-${randomBytes(9).toString("base64url")}`;
  await withShop(ctx, (tx) => tx`
    insert into payments (shop_id, reference, amount_cents, months, created_by_member_id)
    values (${ctx.shopId}::uuid, ${reference}, ${amountCents}, ${months}, ${ctx.memberId}::uuid)
  `);
  const url = new URL("https://checkout.wompi.co/p/");
  url.searchParams.set("public-key", process.env.WOMPI_PUBLIC_KEY!.trim());
  url.searchParams.set("currency", "COP");
  url.searchParams.set("amount-in-cents", String(amountCents));
  url.searchParams.set("reference", reference);
  url.searchParams.set("signature:integrity", integritySignature(reference, amountCents));
  url.searchParams.set("redirect-url", `${appUrl()}/plan?ref=${reference}`);
  return url.toString();
}

type WompiEvent = {
  event?: string;
  data?: { transaction?: Record<string, unknown> };
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
};

function pick(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), source);
}

// Verifica la firma del aviso de Wompi: sha256 de los valores indicados en signature.properties,
// tomados de data, más el timestamp y el secreto de eventos.
export function verifyWompiEvent(body: WompiEvent) {
  const secret = process.env.WOMPI_EVENTS_SECRET?.trim();
  const properties = body.signature?.properties;
  const checksum = body.signature?.checksum;
  if (!secret || !Array.isArray(properties) || typeof checksum !== "string" || typeof body.timestamp !== "number") return false;
  const concatenated = properties.map((path) => String(pick(body.data, path) ?? "")).join("") + body.timestamp + secret;
  const expected = createHash("sha256").update(concatenated).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(checksum.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

const statusMap: Record<string, string> = { APPROVED: "approved", DECLINED: "declined", VOIDED: "voided", ERROR: "error" };

export async function handleWompiEvent(body: WompiEvent) {
  if (!verifyWompiEvent(body)) return { ok: false as const, reason: "firma" };
  if (body.event !== "transaction.updated") return { ok: true as const, result: "ignorado" };
  const tx = body.data?.transaction ?? {};
  const status = statusMap[String(tx.status ?? "")];
  if (!status) return { ok: true as const, result: "pendiente" };
  const rows = await appDb()<{ app_apply_payment: string }[]>`
    select app_apply_payment(${String(tx.reference ?? "")}, ${status}, ${String(tx.id ?? "")}, ${Number(tx.amount_in_cents ?? 0)})
  `;
  return { ok: true as const, result: rows[0]?.app_apply_payment ?? "unknown" };
}
